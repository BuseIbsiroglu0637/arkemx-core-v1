import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeProjectEnvelope,
  encodeProjectEnvelope,
  loadProjectFromStorage,
  PROJECT_STORAGE_KEY,
  PROJECT_BACKUP_KEY,
  PROJECT_RECOVERY_KEY,
  reconcileProjectSnapshots,
  saveProjectToStorage,
  supplementMissingProjectModules,
} from "../app/lib/project-storage.ts";

class MemoryStorage {
  #data = new Map();
  get length() { return this.#data.size; }
  clear() { this.#data.clear(); }
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  key(index) { return [...this.#data.keys()][index] ?? null; }
  removeItem(key) { this.#data.delete(key); }
  setItem(key, value) { this.#data.set(key, String(value)); }
}

function moduleAt(recordedAt, value = {}) {
  return {
    ...value,
    _kernel: {
      schema: "ARKEM-MODULE-LINK/1.0",
      projectId: "ARK-TEST",
      projectRevision: "P01",
      sourceModule: "test",
      recordedAt,
      action: "updated",
    },
  };
}

function project(updatedAt, modules, events = []) {
  return {
    schema: "ARKEM-PROJECT/1.0",
    id: "ARK-TEST",
    name: "Test Project",
    revision: "P01",
    phase: "Ön fizibilite",
    coordinateReference: "WGS84 / EPSG:4326",
    updatedAt,
    experience: { mode: "technical", autoHandoff: false, lastSynchronizedAt: "" },
    modules,
    events,
  };
}

test("stale-tab save preserves modules from the richer stored project", () => {
  const storage = new MemoryStorage();
  const rich = project("2026-10-01T15:00:00.000Z", {
    "geo-parcel": moduleAt("2026-10-01T14:00:00.000Z", { value: "rich-geo" }),
    "plan-editor": moduleAt("2026-10-01T14:10:00.000Z", { baysX: 6 }),
    "structural-concept": moduleAt("2026-10-01T14:20:00.000Z", { system: "light" }),
    "engineering-coordination": moduleAt("2026-10-01T14:30:00.000Z", { openIssues: [] }),
  });
  saveProjectToStorage(storage, rich, "2026-10-01T15:00:00.000Z");

  const staleTab = project("2026-10-01T15:05:00.000Z", {
    "geo-parcel": moduleAt("2026-10-01T15:05:00.000Z", { value: "fresh-geo" }),
  });
  const result = saveProjectToStorage(storage, staleTab, "2026-10-01T15:05:00.000Z");

  assert.equal(result.reconciled, true);
  assert.deepEqual(Object.keys(result.payload.modules).sort(), [
    "engineering-coordination",
    "geo-parcel",
    "plan-editor",
    "structural-concept",
  ]);
  assert.equal(result.payload.modules["geo-parcel"].value, "fresh-geo");
  assert.equal(result.payload.modules["plan-editor"].baysX, 6);

  const primary = decodeProjectEnvelope(storage.getItem(PROJECT_STORAGE_KEY));
  assert.equal(Object.keys(primary.value.modules).length, 4);
  assert.ok(storage.getItem(PROJECT_RECOVERY_KEY));
  assert.ok(storage.getItem(PROJECT_BACKUP_KEY));
});

test("explicit remove event acts as a tombstone during snapshot reconciliation", () => {
  const stored = project("2026-10-01T15:00:00.000Z", {
    "plan-editor": moduleAt("2026-10-01T14:10:00.000Z", { baysX: 6 }),
    "geo-parcel": moduleAt("2026-10-01T14:00:00.000Z"),
  });
  const incoming = project("2026-10-01T15:10:00.000Z", {
    "geo-parcel": moduleAt("2026-10-01T15:10:00.000Z"),
  }, [{
    id: "remove-plan",
    module: "plan-editor",
    action: "remove",
    revision: "P01",
    timestamp: "2026-10-01T15:09:00.000Z",
  }]);

  const merged = reconcileProjectSnapshots(incoming, stored);
  assert.equal("plan-editor" in merged.modules, false);
  assert.equal("geo-parcel" in merged.modules, true);
});

test("loader can recover missing modules from legacy or recovery snapshots of the same project", () => {
  const storage = new MemoryStorage();
  const stale = project("2026-10-01T17:35:00.000Z", {
    "decision-assistant": moduleAt("2026-09-30T18:22:00.000Z"),
    "geo-parcel": moduleAt("2026-10-01T17:35:00.000Z"),
    "architectural-program": moduleAt("2026-10-01T17:33:00.000Z"),
    "system-comparison": moduleAt("2026-10-01T17:23:00.000Z"),
  });
  const richLegacy = project("2026-10-01T16:00:00.000Z", {
    ...stale.modules,
    "plan-editor": moduleAt("2026-10-01T15:00:00.000Z"),
    "structural-concept": moduleAt("2026-10-01T15:10:00.000Z"),
    "engineering-coordination": moduleAt("2026-10-01T15:20:00.000Z"),
    "project-os": moduleAt("2026-10-01T15:30:00.000Z"),
  });

  storage.setItem(PROJECT_STORAGE_KEY, encodeProjectEnvelope(stale, "2026-10-01T17:35:00.000Z"));
  storage.setItem("arkem-project-kernel-v1", JSON.stringify(richLegacy));

  const loaded = loadProjectFromStorage(storage, "arkem-project-kernel-v1");
  assert.equal(loaded.source, "reconciled");
  assert.equal(Object.keys(loaded.value.modules).length, 8);
  assert.equal(loaded.value.modules["geo-parcel"]._kernel.recordedAt, "2026-10-01T17:35:00.000Z");
  assert.ok(loaded.value.modules["plan-editor"]);
  assert.ok(loaded.value.modules["structural-concept"]);
  assert.ok(loaded.value.modules["engineering-coordination"]);
  assert.ok(loaded.value.modules["project-os"]);
});


test("recovery snapshot never replaces an overlapping primary module", () => {
  const primary = project("2026-10-02T06:00:00.000Z", {
    "plan-editor": moduleAt("2026-10-01T18:50:00.000Z", { floorArea: 476.9, state: "coordinated" }),
    "engineering-coordination": moduleAt("2026-10-01T19:05:00.000Z", { openIssues: 1 }),
  });
  const recovery = project("2026-10-02T05:55:00.000Z", {
    "plan-editor": moduleAt("2026-10-02T05:50:00.000Z", { floorArea: 325.75, state: "stale-restored" }),
    "engineering-coordination": moduleAt("2026-10-02T05:51:00.000Z", { openIssues: 3 }),
    "project-os": moduleAt("2026-10-01T19:00:00.000Z", { health: 77 }),
  });

  const merged = supplementMissingProjectModules(primary, recovery);
  assert.equal(merged.modules["plan-editor"].floorArea, 476.9);
  assert.equal(merged.modules["plan-editor"].state, "coordinated");
  assert.equal(merged.modules["engineering-coordination"].openIssues, 1);
  assert.equal(merged.modules["project-os"].health, 77);
});

test("loader keeps overlapping primary modules even when recovery has newer recordedAt", () => {
  const storage = new MemoryStorage();
  const primary = project("2026-10-02T06:00:00.000Z", {
    "plan-editor": moduleAt("2026-10-01T18:50:00.000Z", { floorArea: 476.9 }),
    "engineering-coordination": moduleAt("2026-10-01T19:05:00.000Z", { openIssues: 1 }),
  });
  const recovery = project("2026-10-02T05:59:00.000Z", {
    "plan-editor": moduleAt("2026-10-02T05:58:00.000Z", { floorArea: 325.75 }),
    "engineering-coordination": moduleAt("2026-10-02T05:58:30.000Z", { openIssues: 3 }),
    "structural-concept": moduleAt("2026-10-01T18:45:00.000Z", { system: "light" }),
  });

  storage.setItem(PROJECT_STORAGE_KEY, encodeProjectEnvelope(primary, "2026-10-02T06:00:00.000Z"));
  storage.setItem(PROJECT_RECOVERY_KEY, encodeProjectEnvelope(recovery, "2026-10-02T05:59:00.000Z"));

  const loaded = loadProjectFromStorage(storage, "arkem-project-kernel-v1");
  assert.equal(loaded.source, "reconciled");
  assert.equal(loaded.value.modules["plan-editor"].floorArea, 476.9);
  assert.equal(loaded.value.modules["engineering-coordination"].openIssues, 1);
  assert.equal(loaded.value.modules["structural-concept"].system, "light");
});
