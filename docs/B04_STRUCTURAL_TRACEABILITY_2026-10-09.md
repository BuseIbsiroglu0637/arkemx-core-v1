# B04 structural concept traceability — 2026-10-09

The supported uniform-floor concept workspace previously carried real plan
element IDs but left calculationId null. Its JSON export lacked a calculation
registry, and PDF/DXF/CSV did not carry a complete calculation/source link.

The workspace now records the actual executed concept calculation with project
identity, revision, units, complete source element and floor-geometry snapshots,
architectural scheme, all calculation inputs/settings, engine contract versions,
result and system-comparison studio outputs. A CALC identifier uses SHA-256 of
deterministic content. Verification recomputes both the digest and actual
calculation against the current source. Rehashed fabricated results, changed
inputs/sources, foreign projects and outdated revisions are rejected.

The calculationRegistry and documentRegistry remain in structural-concept and
are carried by normal project persistence/export. New entries retain previous
records; input/revision changes create new calculation identities. A corrupt
existing entry under the expected ID is preserved for review and blocks linked
exports, rather than being silently replaced.

JSON contains the source/calculation/document manifest; PDF contains the same
manifest and calculation record as an embedded UTF-8 JSON file and exposes
identifiers in its metadata; DXF uses a standard 999 comment; CSV rows include
project/revision/calculation/document/source IDs. All downloaded bytes are hashed
into DOC records, including CSV's Excel BOM. File hashes are stored in the project
ledger after file generation, outside the file itself to avoid circular hashes.
The asynchronous export path rejects a project/input change before saving.

Document reference validation additionally checks actual calculation-to-element
bindings. Legacy documents without a content digest retain existing fingerprints.
Unknown sources, invalid units, source geometry conflicts and unsupported
nonuniform floors do not create linked calculation records. Standalone or legacy
studies retain their existing concept outputs with pending/unsupported references.

Scope: this is the local versioned source → executed concept model calculation →
document chain for supported structural outputs. Source elements are linked as
the model input set, not as individual finite-element/member design results.
SHA-256 consistency and re-execution are software checks, not authentication,
digital signatures, licensed engineering verification or official acceptance.
Engine contract identifiers must be updated when engine semantics change.
B06 nonuniform-floor analysis, production/service version matching and authorized
technical acceptance remain separate open work.

Validation: 49 G05/B04 unit checks; 136 general UI checks and build; 16 isolated
browser checks (7 existing reload, 4 existing review, 2 UI contracts, 3 B04).
B04 browser scenarios download all four actual file types, decode and compare
the PDF attachment, check delivered-byte hashes, reload persisted registries,
change the live load and verify history, and reject a corrupted saved calculation.
Node 24.19.0/Edge local results and Linux/Chromium CI results are separate evidence.
TypeScript passes. The two modified React components have the same existing lint
counts as their baseline: ProjectKernel one error; StructuralDesigner one error
and one warning. No new lint findings remain in the changed code.
