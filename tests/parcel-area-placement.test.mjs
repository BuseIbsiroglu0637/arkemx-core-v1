import assert from "node:assert/strict";
import test from "node:test";
import { fromLocalMeters, pointInPolygon, polygonEdgesCross } from "../app/lib/geo.ts";
import { createParcelRecord } from "../app/lib/parcel-record.ts";

const origin = {lat: 41.345, lng: 33.764};
const polygon = (pairs) => pairs.map(([east,north]) => fromLocalMeters(east,north,origin));

test("concave parcel: reject building edge crossing even if every corner is inside", () => {
  const lot = polygon([[0,0],[8,0],[8,8],[6,8],[6,2],[2,2],[2,8],[0,8]]);
  const bridge = polygon([[1,1],[7,1],[7,7],[1,7]]);
  assert.equal(bridge.every((corner) => pointInPolygon(corner, lot)), true);
  assert.equal(polygonEdgesCross(lot, bridge), true);
  const safe = polygon([[3,.5],[5,.5],[5,1.5],[3,1.5]]);
  assert.equal(polygonEdgesCross(lot, safe), false);
});

test("reported cadastral area stays separate from computed local-plane area", () => {
  const lot = polygon([[0,0],[40,0],[40,40],[0,40]]);
  const record = createParcelRecord({
    identity: {province:"Kastamonu",district:"Merkez",neighborhood:"Budamış",block:"210",parcelNo:"15"},
    geometry:lot,
    source:{kind:"tkgm-open-service",authority:"TKGM",label:"Synthetic",capturedAt:"2026-09-28T09:00:00Z",url:"",reportedArea:1605.42}
  });
  assert.equal(record.geometry.reportedArea,1605.42);
  assert.ok(record.geometry.computedArea > 1590 && record.geometry.computedArea < 1610);
  assert.ok(record.geometry.areaVariancePercent !== null);
  assert.equal(record.evidence.officialCadastre,false);
});
