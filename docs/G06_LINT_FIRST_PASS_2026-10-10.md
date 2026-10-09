# G06 lint cleanup, first pass

Date: 2026-10-10 (Turkey). This is a software maintenance step after B06's visible calculation PDF. Frozen project records were read through MCP and remain unchanged; they describe an older commit, not the current branch. The live task service returned only the separate connection-test task.

The current source scan found 18 ESLint errors and 23 warnings. Ten errors were removed without disabling rules: four writes to React refs during rendering, three JSX apostrophes and three uses of the reserved `module` variable name in tests. Latest listing/research/zoning refs now update in committed effects before their consuming effects. The displayed text and test assertions retain their prior meaning. ESLint excludes generated Vinext/Wrangler/build/test output and the generated Cloudflare declaration file.

Eight `react-hooks/set-state-in-effect` errors and 23 warnings remain. They concern account suppression hydration, zoning panel selection, building draft synchronization, candidate replacement, project storage reconciliation, active-brief restoration, numeric draft restoration and module restoration. These need a separate behavioral change with persistence and project-switch regression coverage; this pass does not claim lint is fully green.

The additional existing land-research browser test initially stopped before the changed parcel screens: its fixture had no module source stamp, and the current B04 protection correctly rejected writes to that legacy source. Synthetic fixture generation now explicitly stamps known project/revision/source identities; the injected plan/program fixtures also declare their test units. Source protection and existing value assertions are unchanged. The test supports an explicit browser executable for Windows verification.

Local TypeScript and 40 relevant unit tests pass. Full lint measurement is 8 errors / 23 warnings after this pass. Browser and exact-commit GitHub CI results are recorded in the accompanying progress evidence after execution; no engineering or production approval is implied.
