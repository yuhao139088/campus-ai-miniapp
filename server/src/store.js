import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
export const collections = [
  "users",
  "service_items",
  "campus_documents",
  "conversations",
  "agent_runs",
  "ocr_records",
  "form_drafts",
  "tasks",
  "reminders",
  "audit_logs",
];
export class LocalStore {
  constructor(directory) {
    this.directory = directory;
    this.tail = Promise.resolve();
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.rows = JSON.parse(
        await readFile(path.join(this.directory, "campuspilot.json"), "utf8"),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.rows = {};
    }
    for (const name of collections) this.rows[name] ||= {};
    return this;
  }
  async get(name, id) {
    await this.tail;
    return structuredClone(this.rows[name]?.[id] || null);
  }
  async list(name, where = {}) {
    await this.tail;
    return structuredClone(
      Object.values(this.rows[name] || {}).filter((r) =>
        Object.entries(where).every(([k, v]) => r[k] === v),
      ),
    );
  }
  async save(name, row) {
    const operation = this.tail.then(async () => {
      if (!collections.includes(name)) throw new Error("Unknown collection");
      this.rows[name][row.id] = structuredClone(row);
      const temp = path.join(this.directory, "campuspilot.json.tmp");
      await writeFile(temp, JSON.stringify(this.rows, null, 2), {
        mode: 0o600,
      });
      await rename(temp, path.join(this.directory, "campuspilot.json"));
      return structuredClone(row);
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
export async function createStore(config) {
  if (config.storage === "cloudbase-sql") {
    const { PostgresStore } = await import("./postgres-store.js");
    return new PostgresStore(config).init();
  }
  if (config.storage === "cloudbase-nosql")
    throw new Error(
      "This environment uses PostgreSQL; select STORAGE_MODE=cloudbase-sql",
    );
  return new LocalStore(config.dataDir).init();
}
