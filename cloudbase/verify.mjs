import { loadConfig } from "../server/src/config.js";
import { PostgresStore } from "../server/src/postgres-store.js";
import { randomUUID } from "node:crypto";
const config = loadConfig();
if (config.envId !== "test1-d8gfuke7sfcd0a6d6")
  throw new Error("Unexpected target");
const store = await new PostgresStore(config).init();
const id = "health_" + randomUUID();
try {
  await store.save("audit_logs", {
    id,
    kind: "connection-test",
    createdAt: new Date().toISOString(),
  });
  if ((await store.get("audit_logs", id))?.kind !== "connection-test")
    throw new Error("SQL readback mismatch");
  console.log("CloudBase PostgreSQL write/read passed");
} finally {
  await store.remove("audit_logs", id);
}
