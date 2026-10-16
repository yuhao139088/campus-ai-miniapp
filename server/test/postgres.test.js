import test from "node:test";
import assert from "node:assert/strict";
import { PostgresStore } from "../src/postgres-store.js";
test("SQL adapter filters owners, never interpolates SQL and restricts table names", async () => {
  const calls = [];
  const store = new PostgresStore(
    { envId: "test", pgKey: "private-test-key" },
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        text: async () =>
          init.method === "GET"
            ? '[{"payload":{"id":"x","userId":"user1"}}]'
            : "",
      };
    },
  );
  assert.deepEqual(await store.list("tasks", { userId: "user1" }), [
    { id: "x", userId: "user1" },
  ]);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get("user_id"), "eq.user1");
  assert.equal(url.pathname, "/v1/rdb/rest/tasks");
  await store.save("tasks", { id: "x", userId: "user1" });
  assert.equal(JSON.parse(calls[1].init.body).user_id, "user1");
  assert.equal(
    calls[1].init.headers.Prefer,
    "resolution=merge-duplicates,return=minimal",
  );
  await assert.rejects(
    () => store.list("tasks; DROP TABLE users"),
    /Unknown SQL table/,
  );
  await assert.rejects(
    () => store.list("tasks", { untrusted: "anything" }),
    /Unsupported SQL filter/,
  );
});
