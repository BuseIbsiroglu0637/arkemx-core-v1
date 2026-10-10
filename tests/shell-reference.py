"""Independent OpenSees 3.7.1 shell oracle; source declarations only, no ARKEMX mesh/results."""
import json, sys
import openseespy.opensees as ops
request = json.load(sys.stdin)
s = request["source"]
p, m, mesh = s["plate"], s["material"], s["mesh"]
nx, ny = mesh["nx"], mesh["ny"]
tag = lambda i,j: 1+j*(nx+1)+i
ops.wipe()
ops.model("basic","-ndm",3,"-ndf",6)
for j in range(ny+1):
    for i in range(nx+1):
        ops.node(tag(i,j),p["origin"][0]+p["width"]*i/nx,p["origin"][1]+p["depth"]*j/ny,p["origin"][2])
        if request.get("patch"):
            fixed = [i==0 and j==0,j==0 and i in (0,nx),True,True,True,False]
        else:
            ex,ey = i in (0,nx),j in (0,ny)
            fixed = [i==0 and j==0,j==0 and i in (0,nx),ex or ey,
                ex or ey if s["supports"]["preset"]=="CL" else ex,
                ex or ey if s["supports"]["preset"]=="CL" else ey,False]
        if any(fixed):
            ops.fix(tag(i,j),*[int(v) for v in fixed])
# rho=0: gamma is weight per volume, not dynamic mass density.
ops.section("ElasticMembranePlateSection",1,m["E"],m["nu"],p["thickness"],0)
for j in range(ny):
    for i in range(nx):
        ops.element("ShellMITC4",1+j*nx+i,tag(i,j),tag(i+1,j),tag(i+1,j+1),tag(i,j+1),1)
ops.timeSeries("Linear",1)
ops.pattern("Plain",1,1)
loads = [[0.0]*6 for _ in range((nx+1)*(ny+1))]
if request.get("patch"):
    patch=request["patch"]
    for j in range(ny+1):
        weight=p["depth"]/ny*(.5 if j in (0,ny) else 1)
        for i,sign in [(0,-1),(nx,1)]:
            loads[tag(i,j)-1][0 if patch=="MEM-X" else 1] += sign*weight
    if patch=="MEM-XY":
        for i in range(nx+1):
            weight=p["width"]/nx*(.5 if i in (0,nx) else 1)
            for j,sign in [(0,-1),(ny,1)]:
                loads[tag(i,j)-1][0] += sign*weight
else:
    # Exact consistent load for a uniform pressure on a rectangular bilinear element.
    f=-request["pressure"]*p["width"]*p["depth"]/nx/ny/4
    for j in range(ny):
        for i in range(nx):
            for k in (tag(i,j),tag(i+1,j),tag(i+1,j+1),tag(i,j+1)):
                loads[k-1][2]+=f
for k,load in enumerate(loads):
    ops.load(k+1,*load)
ops.constraints("Plain")
ops.numberer("RCM")
ops.system("BandSPD")
ops.algorithm("Linear")
ops.integrator("LoadControl",1)
ops.analysis("Static")
if ops.analyze(1)!=0:
    raise RuntimeError("Independent shell oracle failed")
ops.reactions()
nodes=[{"tag":k+1,"displacements":ops.nodeDisp(k+1),"reactions":ops.nodeReaction(k+1)} for k in range(len(loads))]
elements=[{"tag":k+1,"stresses":ops.eleResponse(k+1,"stresses")} for k in range(nx*ny)]
print(json.dumps({"engine":"OpenSees-ShellMITC4","version":ops.version(),"nodes":nodes,"elements":elements}))
