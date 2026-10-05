import test from "node:test";
import assert from "node:assert/strict";
import { assessParcelEdgeSetbacks } from "../app/lib/zoning-massing.ts";
import { buildingFootprint, fromLocalMeters } from "../app/lib/geo.ts";

const origin = { lat: 41.0, lng: 33.0 };
const parcel = [
  fromLocalMeters(-20, -15, origin),
  fromLocalMeters(20, -15, origin),
  fromLocalMeters(20, 15, origin),
  fromLocalMeters(-20, 15, origin),
];

test("north front edge applies 5 m front, 3 m side and 3 m rear independently", () => {
  const building = buildingFootprint(origin, 10, 10, 0, 0, 6);
  const result = assessParcelEdgeSetbacks({
    parcel,
    building,
    frontEdge: "north",
    front: 5,
    side: 3,
    rear: 3,
  });

  assert.equal(result.buildingFits, true);
  assert.equal(result.pass, false);
  assert.equal(result.governing?.role, "front");
  assert.equal(result.governing?.required, 5);
  assert.ok((result.governing?.distance ?? 99) < 5);
});

test("same placement passes when north edge is rear with 3 m requirement", () => {
  const building = buildingFootprint(origin, 10, 10, 0, 0, 6);
  const result = assessParcelEdgeSetbacks({
    parcel,
    building,
    frontEdge: "south",
    front: 5,
    side: 3,
    rear: 3,
  });

  assert.equal(result.buildingFits, true);
  assert.equal(result.pass, true);
  const north = result.edges.find((edge) => edge.cardinal === "north");
  assert.equal(north?.role, "rear");
  assert.equal(north?.required, 3);
});

test("side setback is evaluated as 3 m instead of inheriting 5 m front setback", () => {
  const building = buildingFootprint(origin, 10, 10, 0, 12, 0);
  const result = assessParcelEdgeSetbacks({
    parcel,
    building,
    frontEdge: "north",
    front: 5,
    side: 3,
    rear: 3,
  });

  assert.equal(result.pass, true);
  const east = result.edges.find((edge) => edge.cardinal === "east");
  assert.equal(east?.role, "side");
  assert.equal(east?.required, 3);
  assert.ok(Math.abs((east?.distance ?? 0) - 3) < 0.1);
});
