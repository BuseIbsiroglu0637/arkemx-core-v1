# B06 visible calculation PDF

Date: 2026-10-09. The common-floor PDF previously showed geometry while numeric results were available only in the embedded manifest and JSON. Solved exports now append tables for every load case: applied nodal loads, restrained-node reactions, and all six displacement/rotation components. Force and moment units are kN/kNm; translation and rotation units are m/rad. The tables use the same verified calculation record as the embedded manifest.

Each continuation page repeats column headings, load case, calculation identity and scope warning. Rows paginate in groups of 26. Unsolved geometry exports remain one page. Synthetic examples retain their explicit example warning; software checks do not constitute engineering approval.

Validation: Q=7/H=10 sample produces 13 pages; Q vertical reactions are 1050 kN per support, and H applied horizontal load is 10 kN. Unit coverage checks these values, six-component node coverage, and the 53-row pagination boundary. Browser coverage checks a downloaded PDF has all 13 pages and the embedded example manifest. Local typecheck and changed-file lint pass. GitHub CI result is recorded separately after this commit runs.

Open: real project inputs and authorized engineering assessment; no full-building, capacity or seismic approval is claimed.
