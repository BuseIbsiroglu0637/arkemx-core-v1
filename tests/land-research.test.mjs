import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseLandCriteria,normalizeLandCandidate,assessLandCandidate,readLandResearch,landCriteriaKey,safeListingUrl} from '../app/lib/land-research.ts';
import {searchLandCandidates,landProviderStatus,LandProviderError} from '../app/lib/land-candidate-provider.ts';
import {buildLandAgentRequest,readLandAgentCandidates} from '../app/lib/land-research-agent.ts';
import {LAND_QUOTA_TABLE,LAND_QUOTA_RESERVATION} from '../app/lib/land-search-quota.ts';
import {deriveProjectThread} from '../app/lib/project-graph.ts';
import {deriveGuidedProjectRoadmap} from '../app/lib/guided-project.ts';

const criteria={province:'Kastamonu',district:'Merkez',tenure:'sale',minArea:2000,maxArea:5000,maxPrice:10000000,use:'industrial',needs:['Tır erişimi']};
const url='https://www.sahibinden.com/ilan/emlak-arsa-satilik-sentetik-test-123456789/detay';
const listing={title:'Sentetik sağlayıcı test kaydı',url,source:'Sentetik sağlayıcı',province:'Kastamonu',district:'Merkez',tenure:'sale',areaM2:3000,priceTRY:9000000,use:'industrial',propertyType:'land',active:true};
const candidate=normalizeLandCandidate(listing,'2026-10-05T10:00:00Z');
const feed={feedUrl:'https://authorized-provider.example/search',feedToken:'TEST_ONLY_NOT_A_SECRET'};
const intake={name:'Test Ark',projectType:'new',usage:'industrial',location:'Kastamonu Merkez',parcelStatus:'unknown',targetArea:1200,floors:2,floorHeight:4,system:'undecided',priorities:['cost'],budget:'undecided',timeline:'flexible',documents:[],experienceMode:'guided'};
function aiResponse(candidates=[listing],sources=[url]) {return {status:'completed',output:[{type:'web_search_call',action:{sources:sources.map(url=>({type:'url',url}))}},{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({candidates})}]}]};}
const response=data=>async()=>Response.json(data);

test('criteria: reject negative/infinite values, reversed areas and search operator injection',()=>{
 assert.ok(parseLandCriteria(criteria));
 for(const patch of [{maxPrice:-1},{minArea:Infinity},{minArea:6000},{province:'Kastamonu site:evil.com'},{tenure:'other'},{use:'warehouse'}]) assert.equal(parseLandCriteria({...criteria,...patch}),null);
 assert.ok(parseLandCriteria({...criteria,maxArea:0}));
});
test('criteria: absent maximum means unbounded; needs are deduplicated',()=>{
 const c=parseLandCriteria({...criteria,maxArea:0,maxPrice:0,needs:['Tır erişimi','Tır erişimi','made-up']});assert.deepEqual(c.needs,['Tır erişimi']);assert.equal(c.maxArea,0);
});
test('criteria identity is stable across server normalization and property order',()=>{
 assert.equal(landCriteriaKey(criteria),landCriteriaKey(parseLandCriteria(criteria)));
});
test('candidate: reject unsafe URLs and normalize tracking URLs',()=>{
 for(const url of ['javascript:alert(1)','http://example.com/x','https://user:pass@example.com/x','https://127.0.0.1/x']) assert.equal(safeListingUrl(url),null);
 assert.equal(safeListingUrl(url+'?utm_source=x#top'),url);
});
test('candidate: source icon glyphs are removed from visible listing text',()=>{
 const c=normalizeLandCandidate({...listing,title:'\uE001 Garanti Emlak arsa \uFFFC',description:'\uE010 temiz açıklama'},'2026-10-05');
 assert.equal(c.title,'Garanti Emlak arsa');assert.equal(c.description,'temiz açıklama');
});
test('candidate: unavailable values remain unknown, never a budget match',()=>{
 const c=normalizeLandCandidate({...listing,province:'',district:'',tenure:null,areaM2:null,priceTRY:null,use:''},'2026-10-05');const a=assessLandCandidate(c,criteria);
 assert.equal(a.matchesDeclaredCriteria,false);assert.equal(a.unitPrice,null);assert.equal(a.missing.length,6);
});
test('assessment: asking price per square metre and infrastructural needs remain unverified',()=>{
 const a=assessLandCandidate(candidate,criteria);assert.equal(a.unitPrice,3000);assert.equal(a.matchesDeclaredCriteria,true);assert.ok(a.review.includes('Tır erişimi: doğrulama bekliyor'));assert.ok(a.review.includes('Parsel ve imar doğrulanmadı'));
});
test('assessment: fractional or cooperative ownership is blocked from parcel handoff',()=>{
 const risky={...candidate,title:'Kastamonu Merkezde Yatırımlık Koop Hisseleri',description:'Kooperatif hissesi satılıktır'};
 const a=assessLandCandidate(risky,criteria);
 assert.ok(a.mismatch.some(item=>item.includes('Hisseli / kooperatif')));
 const research={schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[risky],selectedId:risky.id};
 assert.equal(deriveProjectThread({'decision-assistant':{input:intake,landResearch:research}}).nextAction.route,'/arsa-arastirma');
});
test('assessment: rent is compared to rent budget, not purchase budget',()=>{
 const a=assessLandCandidate({...candidate,tenure:'rent',priceTRY:100000},{...criteria,tenure:'rent',maxPrice:90000});assert.deepEqual(a.mismatch,['Arsa bütçesini aşıyor']);
});
test('saved shortlist: unique URLs and invalid selections are normalized',()=>{
 const saved=readLandResearch({schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[candidate,candidate,{...candidate,url:'javascript:x'}],selectedId:'invented'});assert.equal(saved.shortlist.length,1);assert.equal(saved.selectedId,null);
});
test('routing: unknown/searching land starts research, identified land starts parcel verification',()=>{
 for(const parcelStatus of ['unknown','searching']) {
  assert.equal(deriveProjectThread({'decision-assistant':{input:{...intake,parcelStatus}}}).nextAction.route,'/arsa-arastirma');
  assert.equal(deriveGuidedProjectRoadmap({...intake,parcelStatus}).nextAction.route,'/arsa-arastirma');
 }
 assert.match(deriveProjectThread({'decision-assistant':{input:{...intake,parcelStatus:'identified'}}}).nextAction.route,/stage=locate/);
 assert.equal(deriveGuidedProjectRoadmap({...intake,projectType:'demolition'}).nextAction.route,'/yikim-karar-studyosu');
});
test('guided roadmap uses live prototype workspaces and ARKEMX analysis state',()=>{
 const roadmap=deriveGuidedProjectRoadmap({...intake,parcelStatus:'identified'});
 assert.match(roadmap.nextAction.route,/stage=locate/);
 assert.equal(roadmap.gates.find(g=>g.id==='system').status,'analysis');
 assert.equal(roadmap.gates.find(g=>g.id==='system').route,'/sistem-karsilastirma');
 assert.equal(roadmap.gates.find(g=>g.id==='budget').route,'/proje-takibi');
 assert.equal(roadmap.gates.find(g=>g.id==='coordination').route,'/bim-koordinasyon');
 assert.equal(roadmap.gates.find(g=>g.id==='delivery').route,'/bilgi-teslim-plani');
});
test('routing: shortlist alone does not advance; selected candidate advances only to parcel review',()=>{
 const research={schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[candidate],selectedId:null};
 assert.equal(deriveProjectThread({'decision-assistant':{input:intake,landResearch:research}}).nextAction.route,'/arsa-arastirma');
 const thread=deriveProjectThread({'decision-assistant':{input:intake,landResearch:{...research,selectedId:candidate.id}}});
 assert.match(thread.nextAction.route,/stage=locate/);assert.equal(thread.nodes.find(n=>n.id==='geo-parcel').milestoneComplete,false);assert.equal(thread.canonical.site.parcelArea,0);
});
test('routing: selected candidate conflicting with revised criteria returns to research',()=>{
 assert.equal(deriveProjectThread({'decision-assistant':{input:intake,landResearch:{schema:'ARKEM-LAND-RESEARCH/1.0',criteria:{...criteria,maxPrice:1000},shortlist:[candidate],selectedId:candidate.id}}}).nextAction.route,'/arsa-arastirma');
});
test('routing: verified actual parcel overrides an old research status',()=>{
 const thread=deriveProjectThread({'decision-assistant':{input:intake},'geo-parcel':{metrics:{geometryValid:true,area:3000}}});assert.notEqual(thread.nextAction.route,'/arsa-arastirma');
});
test('provider: missing access and unlicensed Brave storage fail closed without any fetch',async()=>{
 let calls=0;for(const config of [{},{braveKey:'test'}]) await assert.rejects(searchLandCandidates(criteria,config,async()=>{calls++;throw Error();}),e=>e instanceof LandProviderError&&e.code==='not-configured');assert.equal(calls,0);
});
test('feed: send criteria and filter inactive, wrong property, duplicate and over-budget listings',async()=>{
 let query;const out=await searchLandCandidates(criteria,feed,async(endpoint,options)=>{query=JSON.parse(options.body);assert.equal(endpoint,feed.feedUrl);assert.equal(options.redirect,'error');return Response.json({schema:'ARKEM-LAND-FEED/1.0',listings:[listing,listing,{...listing,url:url+'?x=2',priceTRY:11000000},{...listing,url:url+'?x=3',active:false},{...listing,url:url+'?x=4',propertyType:'home'}]});});
 assert.deepEqual(query.criteria,criteria);assert.equal(out.candidates.length,1);assert.equal(out.criteriaKey,landCriteriaKey(criteria));assert.equal(out.candidates[0].basis,'provider-listing');
});
test('feed: missing fields kept as explicit review leads, never assumed to match',async()=>{
 const out=await searchLandCandidates(criteria,feed,response({schema:'ARKEM-LAND-FEED/1.0',listings:[{...listing,areaM2:null,priceTRY:null}]}));assert.equal(out.candidates.length,1);assert.equal(assessLandCandidate(out.candidates[0],criteria).matchesDeclaredCriteria,false);
});
test('provider: access, quota, broken schema, network errors and oversized replies are distinct errors',async()=>{
 for(const [status,code] of [[401,'access-denied'],[403,'access-denied'],[429,'rate-limited'],[500,'unavailable']]) await assert.rejects(searchLandCandidates(criteria,feed,async()=>new Response('',{status})),e=>e.code===code);
 for(const fetcher of [response({listings:[]}),async()=>{throw Error('secret upstream details');},async()=>new Response(' '.repeat(1000001))]) await assert.rejects(searchLandCandidates(criteria,feed,fetcher),e=>e.code==='unavailable'&&!e.message.includes('secret'));
});
test('provider: genuinely empty result remains empty',async()=>{
 const out=await searchLandCandidates(criteria,feed,response({schema:'ARKEM-LAND-FEED/1.0',listings:[]}));assert.deepEqual(out.candidates,[]);
});
test('Brave: individual listing URLs only, without inventing location or transaction data',async()=>{
 const out=await searchLandCandidates(criteria,{braveKey:'test',storageRights:'1'},response({web:{results:[{title:'Test',url,description:'test'},{title:'Category',url:'https://www.sahibinden.com/arsa'},{title:'Wrong domain',url:'https://sahibinden.com.evil.test/ilan/emlak-arsa-x-123456789/detay'}]}}));
 assert.equal(out.candidates.length,1);assert.equal(out.candidates[0].tenure,null);assert.equal(out.candidates[0].province,'');assert.equal(out.candidates[0].priceTRY,null);
});
test('agent: bounded web tool, domain restriction, structured schema and no server key in prompt',()=>{
 const request=buildLandAgentRequest(criteria);assert.equal(request.max_tool_calls,3);assert.equal(request.store,false);assert.equal(request.text.format.strict,true);assert.deepEqual(request.tools[0].filters.allowed_domains,['sahibinden.com']);assert.deepEqual(JSON.parse(request.input).criteria,criteria);
});
test('agent: rejects invented, category and non-source URLs',()=>{
 const wrong='https://www.sahibinden.com/ilan/emlak-arsa-invented-987654321/detay';const rows=readLandAgentCandidates(aiResponse([listing,{...listing,url:wrong},{...listing,url:'https://www.sahibinden.com/arsa'}],[url,'https://www.sahibinden.com/arsa']));assert.equal(rows.length,1);assert.equal(rows[0].basis,'ai-search');
});
test('agent: refusal, unfinished response and missing JSON fail closed',()=>{
 assert.throws(()=>readLandAgentCandidates({...aiResponse(),status:'incomplete'}));assert.throws(()=>readLandAgentCandidates({status:'completed',output:[]}));assert.throws(()=>readLandAgentCandidates({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal'}]}]}));
});
test('agent: server invokes Responses API and preserves source-linked results',async()=>{
 let sent;const out=await searchLandCandidates(criteria,{openaiKey:'TEST_ONLY_NOT_A_SECRET'},async(endpoint,options)=>{assert.equal(endpoint,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return Response.json(aiResponse());});
 assert.equal(sent.store,false);assert.equal(out.candidates.length,1);assert.equal(out.candidates[0].basis,'ai-search');assert.equal(out.candidates[0].priceTRY,9000000);
});
test('quota: actual atomic SQLite query limits each owner/day to ten reservations',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(LAND_QUOTA_TABLE);const reserve=db.prepare(LAND_QUOTA_RESERVATION);for(let i=1;i<=10;i++) assert.equal(reserve.get('a','2026-10-05').requests,i);assert.equal(reserve.get('a','2026-10-05'),undefined);assert.equal(reserve.get('b','2026-10-05').requests,1);assert.equal(reserve.get('a','2026-10-06').requests,1);}finally{db.close();}
});


import { estimateMinimumLandArea, readLandAreaSizing } from '../app/lib/land-area-sizing.ts';
test('land size considers both gross area capacity and approximate footprint, rounding upward', () => {
 const residential=estimateMinimumLandArea(1000,10);
 assert.equal(residential.footprint,100);assert.equal(residential.minimumArea,700);
 const lowRise=estimateMinimumLandArea(1200,2);
 assert.equal(lowRise.minimumArea,2000);
 assert.equal(estimateMinimumLandArea(1000,10,{mode:'auto',coverage:0.4,far:1}).minimumArea,1000);
 for(const [area,floors] of [[0,2],[1000,0],[1000,1.5],[NaN,2],[Infinity,2],['1000',2]]) assert.equal(estimateMinimumLandArea(area,floors),null);
 for(const assumptions of [{mode:'auto',coverage:0,far:1.5},{mode:'auto',coverage:1.1,far:1.5},{mode:'auto',coverage:0.3,far:NaN}]) assert.equal(estimateMinimumLandArea(1000,10,assumptions),null);
});
test('automatic and manually chosen search sizing persist as assumptions separate from parcel evidence', () => {
 const areaSizing={mode:'manual',coverage:0.3,far:1.5};
 const stored=readLandResearch({schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[],selectedId:null,areaSizing});
 assert.deepEqual(stored.areaSizing,areaSizing);
 assert.equal(readLandAreaSizing({mode:'verified',coverage:0.3,far:1.5}),null);
 assert.equal(readLandResearch({schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[]}).areaSizing,null);
});
