import test from "node:test";
import assert from "node:assert/strict";
import { accountProjectsFromResponse, accountSavedAt } from "../app/lib/account-response.ts";

test("account project lists are validated before computing write preconditions", () => {
  const item = { id: "ARK-test", updatedAt: "2026-10-07T06:00:00.000Z", payload: { revision: "P01" } };
  assert.deepEqual(accountProjectsFromResponse({ projects: [item] }), [item]);
  assert.deepEqual(accountProjectsFromResponse({ projects: [] }), []);
  for (const value of [null, [], {}, { projects: {} }, { projects: [null] }, { projects: [{...item, id: ""}] }, { projects: [{...item, updatedAt: ""}] }]) {
    assert.throws(() => accountProjectsFromResponse(value));
  }
});
test("missing or malformed save acknowledgements never become a saved revision", () => {
  assert.equal(accountSavedAt({ updatedAt: "2026-10-07T06:00:00.000Z" }), "2026-10-07T06:00:00.000Z");
  for (const value of [null, [], {}, { updatedAt: "" }, { updatedAt: 123 }, { updatedAt: "not a date" }]) assert.throws(() => accountSavedAt(value));
});
