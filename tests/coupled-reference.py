"""Independent shared-node OpenSees model; only declared synthetic inputs."""
import json, sys
import openseespy.opensees as ops
model = json.load(sys.stdin)
tags = {n['id']: i+1 for i,n in enumerate(model['nodes'])}
cases = []
for case in model['cases']:
    ops.wipe()
    ops.model('basic', '-ndm', 3, '-ndf', 6)
    for n in model['nodes']:
        ops.node(tags[n['id']], n['x'], n['y'], n['z'])
    for s in model['supports']:
        ops.fix(tags[s['nodeId']], *[int(v) for v in s['fixed']])
    for i,m in enumerate(model['members']):
        mat = next(x for x in model['materials'] if x['id']==m['materialId'])
        sec = next(x for x in model['sections'] if x['id']==m['sectionId'])
        ops.geomTransf('Linear', i+1, *m['localZ'])
        ops.element('elasticBeamColumn', i+1, tags[m['start']], tags[m['end']], sec['A'], mat['E'], mat['G'], sec['J'], sec['Iy'], sec['Iz'], i+1)
    offset = len(model['members'])+1
    for i,s in enumerate(model['shells']):
        ops.section('ElasticMembranePlateSection', i+1, s['E'], s['nu'], s['thickness'], 0)
        ops.element('ShellMITC4', offset+i, *[tags[n] for n in s['nodeIds']], i+1)
    ops.timeSeries('Linear',1)
    ops.pattern('Plain',1,1)
    for l in case['loads']:
        ops.load(tags[l['nodeId']], *l['values'])
    for l in case.get('memberLoads',[]):
        tag = next(i+1 for i,m in enumerate(model['members']) if m['id']==l['memberId'])
        qx,qy,qz = l['values']
        ops.eleLoad('-ele',tag,'-type','-beamUniform',qy,qz,qx)
    for l in case['shellPressures']:
        s = next(s for s in model['shells'] if s['id']==l['shellId'])
        a,b,c,d = [next(n for n in model['nodes'] if n['id']==id) for id in s['nodeIds']]
        f = -l['pressure']*(b['x']-a['x'])*(d['y']-a['y'])/4
        for id in s['nodeIds']:
            ops.load(tags[id],0,0,f,0,0,0)
    ops.constraints('Plain')
    ops.numberer('RCM')
    ops.system('BandSPD')
    ops.algorithm('Linear')
    ops.integrator('LoadControl',1)
    ops.analysis('Static')
    if ops.analyze(1)!=0:
        raise RuntimeError('Independent coupled reference failed')
    ops.reactions()
    cases.append({'id':case['id'],'nodes':[{'id':n['id'],'displacements':ops.nodeDisp(tags[n['id']]),'reactions':ops.nodeReaction(tags[n['id']])} for n in model['nodes']],
        'members':[{'id':m['id'],'localEndForces':ops.eleResponse(i+1,'localForce')} for i,m in enumerate(model['members'])],
        'elements':[{'id':s['id'],'stresses':ops.eleResponse(offset+i,'stresses')} for i,s in enumerate(model['shells'])]})
print(json.dumps({'engine':'OpenSees-shared-ShellMITC4-elasticBeamColumn','version':ops.version(),'cases':cases}))
