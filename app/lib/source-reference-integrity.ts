type Data = Record<string, unknown>;
const data = (v: unknown): Data => v && typeof v === "object" && !Array.isArray(v) ? v as Data : {};
const validIds = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(id => typeof id === "string" && !!id.trim()) && new Set(v).size === v.length;

function canonical(v: unknown, depth = 0): unknown {
  if (depth > 40) throw new Error("Source content too deep");
  if (Array.isArray(v)) return v.map(item => canonical(item, depth + 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([,value]) => value !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => [key,canonical(value, depth + 1)]));
  return v;
}

export function planGeometrySnapshot(value: unknown) {
  const p = data(value);
  return { level: p.level, floorCount: p.floorCount, baysX: p.baysX, baysY: p.baysY, spanX: p.spanX, spanY: p.spanY,
    floorPlates: Array.isArray(p.floorPlates) ? [...p.floorPlates].sort((a,b) => Number(data(a).level) - Number(data(b).level)) : p.floorPlates ?? [],
    ...(p.floorCoordination === undefined ? {} : { floorCoordination: p.floorCoordination }) };
}

// Consistency of the actual local source only. This is not a calculation registry,
// document graph, cryptographic hash or engineering approval.
export function inspectStructuralSourceReferences(project: unknown) {
  const p = data(project), modules = data(p.modules), structure = data(modules["structural-concept"]), plan = data(modules["plan-editor"]);
  const issues: string[] = [], pending: string[] = [];
  const ids = structure.inputElementIds, revision = structure.sourceRevision;
  if (!validIds(ids)) {
    if (ids === undefined || ids === null) pending.push("input element references unavailable");
    else issues.push("input element identities invalid or duplicated");
  }
  if (typeof revision !== "string" || !revision.trim()) pending.push("source revision unavailable");
  else {
    if (revision !== p.revision) issues.push("source revision conflicts with project revision");
    if (revision !== data(plan._kernel).projectRevision) issues.push("source revision conflicts with plan revision");
    if (data(plan._kernel).projectId !== p.id) issues.push("source plan project identity conflict");
  }
  if (validIds(ids)) {
    const actual = Array.isArray(plan.elements) ? plan.elements.map(data) : [];
    const byId = new Map(actual.map(element => [element.id, element]));
    if (byId.size !== actual.length) issues.push("source plan element identities duplicated");
    for (const id of ids) if (!byId.has(id)) issues.push("unknown source element: " + id);
    const snapshot = structure.inputElementSnapshot;
    if (snapshot === undefined || snapshot === null) pending.push("source element content snapshot unavailable");
    else if (!Array.isArray(snapshot)) issues.push("source snapshot unsupported");
    else {
      const recorded = snapshot.map(data), recordedIds = recorded.map(element => element.id);
      if (byId.size !== ids.length) issues.push("source element set changed");
      if (!validIds(recordedIds) || recordedIds.length !== ids.length || ids.some(id => !recordedIds.includes(id))) issues.push("snapshot and input element identities conflict");
      try {
        for (const element of recorded) if (byId.has(element.id) && JSON.stringify(canonical(element)) !== JSON.stringify(canonical(byId.get(element.id)))) issues.push("source element content changed: " + element.id);
      } catch { issues.push("source content unsupported"); }
    }
    const geometry = structure.inputGeometrySnapshot;
    try {
      const actualPlates = planGeometrySnapshot(plan).floorPlates;
      const contextPlates = planGeometrySnapshot({ floorPlates: data(structure.modelContext).floorPlates }).floorPlates;
      if (JSON.stringify(canonical(actualPlates)) !== JSON.stringify(canonical(contextPlates))) issues.push("structural context conflicts with current source floor geometry");
    } catch { issues.push("current source floor geometry unsupported"); }
    if (geometry === undefined || geometry === null) pending.push("source geometry snapshot unavailable");
    else {
      try {
        if (JSON.stringify(canonical(planGeometrySnapshot(geometry))) !== JSON.stringify(canonical(planGeometrySnapshot(plan)))) issues.push("source plan geometry changed");
        const contextPlates = planGeometrySnapshot({ floorPlates: data(structure.modelContext).floorPlates }).floorPlates;
        if (JSON.stringify(canonical(contextPlates)) !== JSON.stringify(canonical(data(geometry).floorPlates))) issues.push("structural context conflicts with source floor geometry");
      } catch { issues.push("source geometry content unsupported"); }
    }
  }
  return { status: issues.length ? "invalid" as const : pending.length ? "pending" as const : "consistent" as const, issues, pending, calculationVerification: false, technicalApproval: false };
}

export function structuralAnalysisBlockers(value: unknown) {
  const structure = data(value), context = data(structure.modelContext), issues: string[] = [];
  if (context.floorCoordination !== undefined || data(structure.inputGeometrySnapshot).floorCoordination !== undefined) issues.push("floor coordination whole-building analysis unsupported");
  if (String(data(structure.geometrySupport).status).startsWith("unsupported")) issues.push("structural analysis explicitly unsupported");
  const plates = context.floorPlates;
  if (plates !== undefined && plates !== null && !Array.isArray(plates)) issues.push("floor plate collection unsupported");
  if (Array.isArray(plates) && plates.length) {
    const rows = plates.map(data);
    if (rows.some(p => typeof p.width !== "number" || !Number.isFinite(p.width) || p.width <= 0 || typeof p.depth !== "number" || !Number.isFinite(p.depth) || p.depth <= 0 || !Number.isInteger(p.level) || Number(p.level) < 1) || new Set(rows.map(p => p.level)).size !== rows.length) issues.push("floor plate geometry invalid");
    if (new Set(rows.map(p => `${p.width}/${p.depth}`)).size > 1) issues.push("nonuniform floor analysis unsupported");
  }
  return issues;
}

export function runSupportedStructuralAnalysis<T>(source: unknown, calculate: () => T): T | null {
  return structuralAnalysisBlockers(source).length ? null : calculate();
}
