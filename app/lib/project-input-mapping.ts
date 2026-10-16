import { moduleRecord } from './module-draft.ts';

const usageAliases: Record<string, string> = {
  residential:'konut', konut:'konut', 'konut / villa':'konut', 'konut / karma yaşam':'konut',
  industrial:'sanayi', storage:'sanayi', sanayi:'sanayi', 'sanayi / üretim':'sanayi',
  'sanayi / depo':'sanayi', 'depo / lojistik':'sanayi',
  commercial:'ticari', office:'ticari', mixed:'ticari', ticari:'ticari',
  'ofis / ticari':'ticari', 'ticari / sosyal':'ticari',
  agricultural:'tarimsal', tarimsal:'tarimsal', 'tarımsal yapı':'tarimsal',
};
export function projectUsageKey(value: unknown) {
  return typeof value === 'string' ? usageAliases[value.trim().toLocaleLowerCase('tr-TR')] : undefined;
}
export function deliveryUsageKey(value: unknown): 'konut'|'sanayi'|'ticari'|undefined {
  const key = projectUsageKey(value);
  return key === 'tarimsal' ? 'sanayi' : key as 'konut'|'sanayi'|'ticari'|undefined;
}
const systemAliases: Record<string,string> = {
  undecided:'kararsiz',kararsiz:'kararsiz',concrete:'betonarme',betonarme:'betonarme',
  precast:'prefabrik',prefabrik:'prefabrik',steel:'celik',celik:'celik',light:'hafif-celik',
  'hafif-celik':'hafif-celik',hybrid:'karma',karma:'karma',
};
const priorityAliases: Record<string,string> = {
  time:'sure',sure:'sure',cost:'butce',butce:'butce',safety:'guvenlik',guvenlik:'guvenlik',
  flexibility:'esneklik',esneklik:'esneklik',energy:'enerji',enerji:'enerji',
  carbon:'karbon',karbon:'karbon',operation:'isletme',isletme:'isletme',
};
const documentAliases: Record<string,string> = {
  arsa:'arsa','title-deed':'arsa','parcel-id':'arsa',zoning:'arsa',
  mimari:'mimari','existing-plan':'mimari',soil:'zemin',zemin:'zemin',statik:'statik',gorsel:'gorsel',
};
const mappedList = (value: unknown, aliases: Record<string,string>) => Array.isArray(value)
  ? [...new Set(value.flatMap(item => typeof item === 'string' && aliases[item] ? [aliases[item]] : []))] : [];

// Only known enum values can affect scoring. Keep the original payload in the module.
export function decisionAssistantInput(value: unknown) {
  const input = moduleRecord(value);
  const guided = typeof input.projectType === 'string';
  const goal = typeof input.goal === 'string' && ['konut','sanayi','ticari','tarimsal','mevcut','yikim'].includes(input.goal)
    ? input.goal : guided && input.projectType === 'demolition' ? 'yikim'
    : guided && input.projectType === 'existing' ? 'mevcut' : projectUsageKey(input.usage) ?? '';
  return {
    goal,
    stage: typeof input.stage === 'string' && ['fikir','on-proje','ruhsat','teklif','santiye','mevcut'].includes(input.stage)
      ? input.stage : guided ? input.projectType === 'existing' ? 'mevcut' : 'fikir' : '',
    system: typeof input.system === 'string' ? systemAliases[input.system] ?? 'kararsiz' : 'kararsiz',
    location: typeof input.location === 'string' ? input.location : '',
    area: typeof input.area === 'string' ? input.area : typeof input.area === 'number' && Number.isFinite(input.area)
      ? String(input.area) : typeof input.targetArea === 'number' && Number.isFinite(input.targetArea) ? String(input.targetArea) : '',
    documents: mappedList(input.documents,documentAliases),
    priorities: mappedList(input.priorities,priorityAliases),
  };
}
