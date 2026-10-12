// Program plates are stored in metres (3 decimals) and m² (2 decimals).
export const FLOOR_PLATE_LENGTH_DECIMALS = 3;
export const FLOOR_PLATE_AREA_DECIMALS = 2;

const onGrid = (value: number, decimals: number) => {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
};

/** Product error from rounding both lengths and the independently declared area. */
export function floorPlateAreaCheck(width: number, depth: number, declaredArea: number) {
  const computedArea = width * depth;
  const roundedSource = onGrid(width, FLOOR_PLATE_LENGTH_DECIMALS) && onGrid(depth, FLOOR_PLATE_LENGTH_DECIMALS) && onGrid(declaredArea, FLOOR_PLATE_AREA_DECIMALS);
  const lengthError = .5 * 10 ** -FLOOR_PLATE_LENGTH_DECIMALS;
  const areaError = .5 * 10 ** -FLOOR_PLATE_AREA_DECIMALS;
  const tolerance = roundedSource ? (Math.abs(width) + Math.abs(depth)) * lengthError + lengthError ** 2 + areaError : .01;
  const difference = declaredArea - computedArea;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(declaredArea), Math.abs(computedArea)) * 8;
  const valid = [width, depth, declaredArea, computedArea].every(Number.isFinite) && width > 0 && depth > 0 && declaredArea > 0 && Math.abs(difference) <= tolerance + epsilon;
  return { valid, declaredArea, computedArea, difference, tolerance, basis: roundedSource ? "length-3dp-area-2dp-rounding-bound" : "unrounded-source-strict-0.01m2", roundingAccepted: valid && Math.abs(difference) > .01 + epsilon };
}
