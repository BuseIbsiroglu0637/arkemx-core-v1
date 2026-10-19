import test from "node:test";
import assert from "node:assert/strict";
import { createDemoProject, isDemoRequestBlocked, DEMO_STORAGE_KEY, DEMO_BACKUP_KEY } from "../app/lib/demo.ts";
import { isKernelProject } from "../app/lib/project-validation.ts";
import { saveProjectToStorage, loadProjectFromStorage } from "../app/lib/project-storage.ts";

test("example is importable without fabricated parcel or engineering results", () => {
 const project = createDemoProject();
 assert.equal(isKernelProject(project), true);
 assert.equal(Object.keys(project.modules).length, 3);
 assert.equal(project.experience.autoHandoff, false);
 assert.equal(project.modules["geo-parcel"].parcelStatus, "searching");
 assert.equal(project.modules["structural-concept"], undefined);
 const second = createDemoProject();
 project.modules["architectural-program"].spaces[0].name = "Changed";
 assert.equal(second.modules["architectural-program"].spaces[0].name, "Salon");
});
test("demo persistence round trips independently from normal project and backup", () => {
 const values = new Map([["arkem-project-kernel-v2", "real-data"], ["arkem-project-kernel-v2-backup", "real-backup"]]);
 const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
 assert.equal(loadProjectFromStorage(storage, "arkem-demo-v177-legacy").value, null);
 const first = createDemoProject(); saveProjectToStorage(storage, first);
 const updated = { ...first, name: "Demo değişikliği" }; saveProjectToStorage(storage, updated);
 assert.equal(loadProjectFromStorage(storage, "arkem-demo-v177-legacy").value.name, updated.name);
 assert.ok(values.has(DEMO_STORAGE_KEY)); assert.ok(values.has(DEMO_BACKUP_KEY));
 assert.equal(values.get("arkem-project-kernel-v2"), "real-data");
 assert.equal(values.get("arkem-project-kernel-v2-backup"), "real-backup");
});
test("demo blocks real workspace, intake and evidence access and API writes", () => {
 for (const path of ["/api/customer-workspace", "/api/project-intake/", "/api/project-evidence", "/api/project-evidence/file/123"]) {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) assert.equal(isDemoRequestBlocked(path, method), true);
 }
 assert.equal(isDemoRequestBlocked("/api/tkgm", "POST"), true);
 assert.equal(isDemoRequestBlocked("/api/tkgm", "GET"), false);
 assert.equal(isDemoRequestBlocked("/api/arkemx-modules", "GET"), false);
 assert.equal(isDemoRequestBlocked("/dijital-proje-merkezi", "GET"), false);
});
