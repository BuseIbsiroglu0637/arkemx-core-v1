type Plan = Record<string, unknown>;
export function generatedPlanGeometry(plan: Plan) {
  return { floorCount: plan.floorCount, baysX: plan.baysX, baysY: plan.baysY,
    spanX: plan.spanX, spanY: plan.spanY, floorPlates: plan.floorPlates };
}

/** Refresh only when both generated objects and their grid remain untouched. */
export function canRefreshGeneratedPlan(plan: Plan) {
  const elements = Array.isArray(plan.elements) ? plan.elements : [];
  if (!elements.length) return true;
  const context = plan.programContext as Plan | undefined;
  const snapshot = context?.generatedPlanSnapshot as Plan | undefined;
  return Boolean(snapshot && JSON.stringify(elements) === JSON.stringify(snapshot.elements)
    && JSON.stringify(generatedPlanGeometry(plan)) === JSON.stringify(snapshot.geometry));
}
