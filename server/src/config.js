import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
export function loadConfig(env = process.env) {
  let pgKey = env.CLOUDBASE_PG_API_KEY;
  if (!pgKey && env.CLOUDBASE_PG_KEY_FILE) {
    const raw = readFileSync(env.CLOUDBASE_PG_KEY_FILE, "utf8").replace(
      /^\uFEFF/,
      "",
    );
    const parsed = JSON.parse(raw.slice(raw.indexOf("{")));
    pgKey = parsed.data?.ApiKey || parsed.data?.token || parsed.token;
  }
  const production = env.NODE_ENV === "production";
  if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32))
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  if (production && env.DEMO_MODE === "true")
    throw new Error("Disable DEMO_MODE before production");
  return {
    port: Number(env.PORT || 8787),
    demo: env.DEMO_MODE !== "false",
    secret: env.SESSION_SECRET || randomBytes(48).toString("hex"),
    storage: env.STORAGE_MODE || "local",
    pgKey,
    dataDir:
      env.DATA_DIR || fileURLToPath(new URL("../../data/", import.meta.url)),
    origins: (
      env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    envId: env.CLOUDBASE_ENV_ID || "test1-d8gfuke7sfcd0a6d6",
    appId: env.WX_APPID || "wx71016248d99d9bd4",
    appSecret: env.WX_APP_SECRET,
    bridgeSecret: env.WX_BRIDGE_SECRET,
    ai: {
      mode: env.AI_MODE || "offline",
      baseUrl: env.AI_BASE_URL || "",
      key: env.AI_API_KEY || "",
      model: env.AI_MODEL_MAX || "qwen3.8-max",
      fastModel: env.AI_MODEL_FAST || "qwen3.8-flash",
      visionModel: env.AI_VISION_MODEL || "",
      timeout: Number(env.AI_TIMEOUT_MS || 45000),
      retries: Number(env.AI_RETRIES || 1),
    },
  };
}
