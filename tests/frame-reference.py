"""Independent OpenSees reference oracle; synthetic software evidence only."""
import json
import sys
import openseespy.opensees as ops

model = json.load(sys.stdin)
node_tags = {n["id"]: i + 1 for i, n in enumerate(model["nodes"])}
cases = []
for case in model["cases"]:
    ops.wipe()
    ops.model("basic", "-ndm", 3, "-ndf", 6)
    for node in model["nodes"]:
        ops.node(node_tags[node["id"]], node["x"], node["y"], node["z"])
    for support in model["supports"]:
        ops.fix(node_tags[support["nodeId"]], *[int(v) for v in support["fixed"]])
    for i, member in enumerate(model["members"]):
        material = next(m for m in model["materials"] if m["id"] == member["materialId"])
        section = next(s for s in model["sections"] if s["id"] == member["sectionId"])
        ops.geomTransf("Linear", i + 1, *member["localZ"])
        ops.element("elasticBeamColumn", i + 1, node_tags[member["start"]], node_tags[member["end"]], section["A"], material["E"], material["G"], section["J"], section["Iy"], section["Iz"], i + 1)
    ops.timeSeries("Linear", 1)
    ops.pattern("Plain", 1, 1)
    for load in case["loads"]:
        ops.load(node_tags[load["nodeId"]], *load["values"])
    ops.constraints("Plain")
    ops.numberer("RCM")
    ops.system("BandSPD")
    ops.algorithm("Linear")
    ops.integrator("LoadControl", 1.0)
    ops.analysis("Static")
    if ops.analyze(1) != 0:
        raise RuntimeError("OpenSees reference analysis failed")
    ops.reactions()
    cases.append({"id": case["id"], "nodes": [{"id": n["id"], "displacements": ops.nodeDisp(node_tags[n["id"]]), "reactions": ops.nodeReaction(node_tags[n["id"]])} for n in model["nodes"]], "members": [{"id": m["id"], "localEndForces": ops.eleResponse(i + 1, "localForce")} for i, m in enumerate(model["members"])]})
print(json.dumps({"engine": "OpenSees", "version": ops.version(), "cases": cases}))
