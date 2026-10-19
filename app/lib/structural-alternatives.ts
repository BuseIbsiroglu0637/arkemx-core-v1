import { calculateStructuralConcept, SYSTEM_LABELS, type StructuralConceptInput, type StructuralSystem } from "./engineering";

export type StructuralAlternative = {
  system: StructuralSystem;
  label: string;
  massIndex: number;
  embodiedCarbonProxy: number;
  criticalChecks: number;
  reviewChecks: number;
  maxSpan: number;
  material: {
    concreteM3: number;
    reinforcementT: number;
    steelT: number;
  };
};

export function compareStructuralConcepts(input: StructuralConceptInput): StructuralAlternative[] {
  const systems: StructuralSystem[] = ["concrete", "steel", "light", "hybrid", "precast"];
  const calculated = systems.map((system) => {
    const result = calculateStructuralConcept({ ...input, system });
    const embodiedCarbonProxy =
      result.quantities.concreteVolume * 300
      + (result.quantities.reinforcementTonnage + result.quantities.steelTonnage) * 1_800;
    return {
      system,
      label: SYSTEM_LABELS[system],
      seismicWeight: result.loads.seismicWeight,
      embodiedCarbonProxy,
      criticalChecks: result.checks.filter((check) => check.state === "block").length,
      reviewChecks: result.checks.filter((check) => check.state === "review").length,
      maxSpan: result.geometry.maxSpan,
      material: {
        concreteM3: result.quantities.concreteVolume,
        reinforcementT: result.quantities.reinforcementTonnage,
        steelT: result.quantities.steelTonnage,
      },
    };
  });
  const minimumWeight = Math.max(1, Math.min(...calculated.map((item) => item.seismicWeight)));
  return calculated.map(({ seismicWeight, ...item }) => ({
    ...item,
    massIndex: seismicWeight / minimumWeight * 100,
  }));
}
