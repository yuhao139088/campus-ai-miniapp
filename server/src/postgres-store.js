import { collections } from "./store.js";
// The installed Node SDK has no PostgreSQL rdb() surface. Use the documented
// service-only PostgREST API; browser/miniapp clients never receive this key.
export class PostgresStore {
  constructor(config, fetcher = fetch) {
    if (!config.pgKey) throw new Error("CLOUDBASE_PG_API_KEY is required");
    this.base = `https://${config.envId}.api.tcloudbasegateway.com`;
    this.key = config.pgKey;
    this.fetcher = fetcher;
    this.bucket = "campuspilot-materials";
  }
  check(name) {
    if (!collections.includes(name)) throw new Error("Unknown SQL table");
  }
  async request(route, method = "GET", body, headers = {}) {
    const nativeBody = Buffer.isBuffer(body) || body instanceof FormData;
    const response = await this.fetcher(this.base + route, {
      method,
      headers: {
        Authorization: "Bearer " + this.key,
        ...(nativeBody ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: nativeBody ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`CloudBase PostgreSQL request failed (${response.status})`),
        { code: "SQL_STORAGE_ERROR" },
      );
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async init() {
    await this.request("/v1/rdb/rest/service_items?select=id&limit=1");
    return this;
  }
  async get(name, id) {
    this.check(name);
    const query = new URLSearchParams({
      select: "payload",
      id: "eq." + id,
      limit: "1",
    });
    const rows = await this.request(`/v1/rdb/rest/${name}?${query}`);
    return rows?.[0]?.payload || null;
  }
  async list(name, where = {}) {
    this.check(name);
    const rows = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const query = new URLSearchParams({
        select: "payload",
        limit: "100",
        offset: String(offset),
        order: "id.asc",
      });
      for (const [key, value] of Object.entries(where)) {
        if (key === "userId") query.set("user_id", "eq." + value);
        else if (key === "id") query.set("id", "eq." + value);
        else throw new Error("Unsupported SQL filter");
      }
      const page = await this.request(`/v1/rdb/rest/${name}?${query}`);
      rows.push(...page.map((x) => x.payload));
      if (page.length < 100) break;
    }
    return rows;
  }
  async save(name, row) {
    this.check(name);
    await this.request(
      `/v1/rdb/rest/${name}?on_conflict=id`,
      "POST",
      {
        id: row.id,
        user_id: row.userId || null,
        payload: row,
        updated_at: new Date().toISOString(),
      },
      { Prefer: "resolution=merge-duplicates,return=minimal" },
    );
    return row;
  }
  async remove(name, id) {
    this.check(name);
    await this.request(
      `/v1/rdb/rest/${name}?${new URLSearchParams({ id: "eq." + id })}`,
      "DELETE",
    );
  }
  async upload(userId, name, buffer) {
    const object = `uploads/${userId}/${new Date().toISOString().slice(0, 10)}/${name}`;
    const mime = name.endsWith(".png")
      ? "image/png"
      : name.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    const data = new FormData();
    data.append("file", new Blob([buffer], { type: mime }), name);
    await this.request(
      `/v1/storages/object/${this.bucket}/${object}`,
      "POST",
      data,
    );
    return { bucket: this.bucket, path: object };
  }
}
