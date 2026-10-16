import fs from "node:fs";
import path from "node:path";
// Build a separate optional profile; ordinary miniapp remains usable without
// WeChat's AI developer-mode entitlement.
const source = path.resolve("miniapp"),
  target = path.resolve(".build/ai-miniapp");
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: (p) =>
    !p.includes("node_modules") &&
    !p.includes(".ai-mode-skills") &&
    !p.endsWith("project.private.config.json"),
});
const app = JSON.parse(fs.readFileSync(path.join(target, "app.json"), "utf8"));
if (app.lazyCodeLoading !== "requiredComponents")
  throw new Error("Set lazyCodeLoading in the source project first");
app.agent = {
  skills: [
    {
      name: "校园服务指南",
      description: "查询CampusPilot公共演示校园服务指南",
      path: "skills/campus-guide",
    },
  ],
};
app.subPackages = [{ root: "skills", independent: true, pages: [] }];
fs.writeFileSync(path.join(target, "app.json"), JSON.stringify(app, null, 2));
const config = JSON.parse(
  fs.readFileSync(path.join(target, "project.config.json"), "utf8"),
);
config.libVersion = "3.16.2";
fs.writeFileSync(
  path.join(target, "project.config.json"),
  JSON.stringify(config, null, 2),
);
console.log(
  "Optional WeChat AI-mode profile generated at " +
    target +
    "; platform entitlement and real-device validation are still required.",
);
