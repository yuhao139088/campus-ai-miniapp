import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { isIP } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "miniapp");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--host"))
  throw new Error("Usage: node tools/prepare-lan-preview.mjs --host <local IPv4>");
const addresses = Object.entries(os.networkInterfaces()).flatMap(([name, items]) =>
  (items || [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => ({ name, address: item.address })),
);
const wireless = addresses.filter((item) => /wi-?fi|wlan|无线/i.test(item.name));
const host = args.length ? args[1] : wireless.length === 1 ? wireless[0].address : null;
if (!host || isIP(host) !== 4 || !addresses.some((item) => item.address === host))
  throw new Error("Choose this computer's Wi-Fi IPv4 using --host; no remote address is accepted.");
const octets = host.split(".").map(Number);
if (!(octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) ||
  (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)))
  throw new Error("LAN preview requires a private IPv4 address.");

// Read the compiled public app config; never read server environment secrets.
const context = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(source, "config.js"), "utf8"), context);
const config = { ...context.exports.config, apiBase: `http://${host}:8787` };
const healthResponse = await fetch(config.apiBase + "/api/health", { signal: AbortSignal.timeout(5000) });
if (!healthResponse.ok || (await healthResponse.json()).status !== "ok")
  throw new Error("The backend health check failed. Start the server before preparing the preview.");

const buildRoot = path.join(root, ".build");
fs.mkdirSync(buildRoot, { recursive: true });
const target = fs.mkdtempSync(path.join(buildRoot, "lan-miniapp-"));
fs.cpSync(source, target, {
  recursive: true,
  filter: (file) => {
    const relative = path.relative(source, file);
    const parts = relative.split(path.sep);
    if (parts.some((part) => part.startsWith(".") || ["node_modules", "skills"].includes(part))) return false;
    if (fs.statSync(file).isDirectory()) return true;
    return /\.(js|json|wxml|wxss|png|jpe?g|webp|svg)$/.test(file) &&
      !["project.private.config.json", "package.json", "package-lock.json", "tsconfig.json"].includes(path.basename(file));
  },
});
fs.writeFileSync(path.join(target, "config.js"), `"use strict";\nexports.config = ${JSON.stringify(config, null, 2)};\n`);
const project = JSON.parse(fs.readFileSync(path.join(target, "project.config.json"), "utf8"));
project.projectname = "campuspilot-lan-preview";
project.setting.urlCheck = false;
fs.writeFileSync(path.join(target, "project.config.json"), JSON.stringify(project, null, 2));
const manifest = { generatedAt: new Date().toISOString(), project: target, apiBase: config.apiBase,
  appid: project.appid, scope: "same-Wi-Fi development preview; enable WeChat debugging on the phone" };
fs.writeFileSync(path.join(buildRoot, "lan-preview.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
