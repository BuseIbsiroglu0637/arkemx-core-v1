# B06 S4-B: shared frame–shell numerical pilot

Date: 2026-10-11. Scope: synthetic software verification. Real LHM slab dimensions and signed engineering acceptance were not supplied. B06 remains open.

## Implemented

The Euler–Bernoulli frame and existing rectangular MITC shell kernels now assemble into a single global stiffness matrix. Explicit common node IDs share `[ux, uy, uz, rx, ry, rz]`. Shell pressure, nodal forces/moments and consistent uniform member loads are solved together; frame end forces and shell Gauss resultants use that same displacement solution. Shell reactions are not independently calculated and then transferred to a second frame solve.

Actual user-declared supports alone enter the common matrix. Frame geometry validation uses validation-only support entries to reuse the existing frame contract; those entries never enter the physical solution. Supports, force/moment balance and mechanisms are checked on the assembled common model.

The contract rejects coincident independent IDs, nonrectangular/nonhorizontal shells, overlapping plates, nonconforming shell nodes, unsplit members crossing an intermediate node, disconnected shell regions, repeated loads, invalid references and unknown fields. Self weight is not automatically inserted. This avoids an implicit additional gravity term; the caller must explicitly prepare its pressure and member loads.

Limits: at most 160 total nodes, 100 rectangular shell cells, 12 cases, and the existing frame submodel limits of 60 nodes / 150 members. No automatic snapping, eccentric connections, end releases, nonlinear analysis, dynamics or design checks.

## Demonstration

`/ornek-kabuk-modeli` now includes an independent synthetic common-solution panel, alongside the existing independent plate panel. Lower floor: 4 × 3 m; optional upper floor: 2 × 3 m; heights: 3 m. Explicit slab thickness: 0.18 m. G pressure: 5 kN/m², Q: 2 kN/m²; no additional automatic self weight. Columns reach the declared base supports; upper columns land on explicitly segmented lower beams where required.

The panel shows base reactions, maximum vertical displacement and separate load cases. JSON download contains the exact synthetic model and full numerical fields, marked `fixture=synthetic`, `fullBuildingAnalysis=false`, `technicalApproval=false`. Edits clear old results. Reload clears the example result. Existing project data is preserved. It is not a project-bound calculation record or a portable project backup.

## Verification and unresolved convergence

22 meaningful unit tests cover load transfer, superposition, order independence, stiffness sensitivity, zero loads, numerical overflow/underflow and rejection paths. The independent Python oracle builds OpenSees ShellMITC4 + elasticBeamColumn elements directly from declared inputs, with the same explicitly shared nodes and actual supports. Pinned reference: OpenSees 3.7.1 (`openseespy==3.7.1.2`). Ten mesh/building configurations × six load cases = 60 comparisons. All pass predeclared field tolerances: displacement/reaction/member forces 1%, shell resultants 5%, with dimensional absolute tolerances. Maximum observed absolute field difference was approximately 1.99e-11 across these models; this is not a global engineering accuracy guarantee.

Mesh refinement is assessed separately. Thresholds remain 1% displacement and 3% sampled interior moment field change; they were not loosened to obtain acceptance:

| Comparison | Maximum vertical displacement change | Interior moment field change | Accepted |
| --- | ---: | ---: | --- |
| One floor, 8 → 10 cells per direction | 0.7368% | 3.3192% | No |
| Two distinct floors, 6 → 8 lower-floor cells per direction | 1.7110% | 12.5382% | No |

Independent solver agreement validates the tested discrete models. It does not establish mesh convergence. The UI explicitly states that mesh acceptance is absent. CI's new reference step tests independent discrete-model agreement; the result JSON independently preserves `refinementAcceptance=false`. Do not report the CI step as a passed convergence gate.

Seven browser checks verify real solves, source edits, case selection, JSON download, preservation of an existing seeded project and reload behavior. Browser output is in `test-artifacts/g05/coupled-browser-result.json`. Full-field oracle data, load definitions and refinement results are in `coupled-reference-result.json` and the per-model JSON files in the same directory. These are local tests; no successful remote CI for this new change is claimed.

## Remaining

1. Investigate and resolve common-model mesh convergence, including the lower-beam transfer region; preserve the current failed gate and compare appropriately refined meshes. Any larger-model extension needs explicit memory/performance limits and validation.
2. Bind the common model to actual project/revision/element/material/support/load provenance. The existing S4-A04 independent plate package must not be mislabeled as a common-solution package.
3. Add worker execution, verified restoration and project JSON/PDF/DXF binding for the common solution before treating it as a supported project flow.
4. Resolve LHM +7.50 surface geometry, thickness, supports, loads and drawing/report revision mismatch with source evidence.
5. Establish scoped independent real-project comparison and authorized engineering acceptance; verify the actual production revision separately.

The user explicitly selected software tests while LHM inputs are unavailable. No real LHM model, signature, approval or deployment was inferred. Synced references and frozen MCP records were not edited.
