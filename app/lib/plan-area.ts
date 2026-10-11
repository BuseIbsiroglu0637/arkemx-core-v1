/** Use individual plates whenever present; legacy plans use their repeated floor. */
export function planGrossArea(plan: Record<string, unknown>): number {
  const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  if (Array.isArray(plan.floorPlates) && plan.floorPlates.length) {
    return plan.floorPlates.reduce((sum, value) => {
      const plate = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return sum + positive(plate.width) * positive(plate.depth);
    }, 0);
  }
  const metrics = plan.metrics && typeof plan.metrics === "object" ? plan.metrics as Record<string, unknown> : {};
  return positive(metrics.floorArea) * positive(plan.floorCount);
}
