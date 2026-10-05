const object = (value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export function architecturePlacementPending(value:unknown):boolean {
  const geo=object(value), zoning=object(geo.zoning), metrics=object(geo.metrics);
  const numericKeys=['taks','kaks','hmax','frontSetback','sideSetback','rearSetback'];
  if(!numericKeys.every(key=>typeof zoning[key]==='number' && Number.isFinite(zoning[key]) && Number(zoning[key])>=0)
    || !zoning.planScale || !zoning.buildingOrder) return true;
  const positive=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>0;
  const nonnegative=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0;
  return metrics.geometryValid!==true || metrics.setbackPass!==true
    || !positive(metrics.area) || !positive(metrics.allowedFootprint) || !positive(metrics.allowedGross)
    || !nonnegative(metrics.footprint) || !nonnegative(metrics.gross) || !nonnegative(metrics.buildingHeight)
    || Number(metrics.footprint)>Number(metrics.allowedFootprint)+.01
    || Number(metrics.gross)>Number(metrics.allowedGross)+.01
    || Number(metrics.buildingHeight)>Number(zoning.hmax)+.01;
}
export function architectureSiteContext(geo:unknown,existing:unknown):Record<string,unknown> {
  const current={...object(existing)};
  if(architecturePlacementPending(geo)) {
    delete current.massingModel;
    delete current.selectedMassingId;
  }
  return current;
}
