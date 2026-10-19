/** Fit all box corners with a uniform camera; model axes are never stretched. */
export function modelFitDistance(size: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, fov: number, aspect: number, padding = 1.12) {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  const d = { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  const rLength = Math.hypot(d.z, d.x) || 1;
  const r = { x: d.z / rLength, y: 0, z: -d.x / rLength };
  const u = { x: d.y * r.z, y: d.z * r.x - d.x * r.z, z: -d.y * r.x };
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * Math.max(.2, aspect);
  let distance = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = size.x * sx / 2, y = size.y * sy / 2, z = size.z * sz / 2;
    const depth = x*d.x + y*d.y + z*d.z;
    distance = Math.max(distance, depth + padding * Math.max(Math.abs(x*r.x+y*r.y+z*r.z)/tanH, Math.abs(x*u.x+y*u.y+z*u.z)/tanV));
  }
  return Math.max(distance, .1);
}
