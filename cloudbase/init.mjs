import { loadConfig } from "../server/src/config.js";
import { PostgresStore } from "../server/src/postgres-store.js";
import { serviceCatalog, documents } from "../server/src/domain.js";
const config = loadConfig();
if (config.envId !== "test1-d8gfuke7sfcd0a6d6")
  throw new Error("Unexpected target environment");
const store = await new PostgresStore(config).init();
for (const item of serviceCatalog)
  if (!(await store.get("service_items", item.id)))
    await store.save("service_items", item);
for (const item of documents)
  if (!(await store.get("campus_documents", item.id)))
    await store.save("campus_documents", item);
console.log("PostgreSQL seeded with four synthetic services and four guides.");
