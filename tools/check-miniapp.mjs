import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import vm from "node:vm";
const root = path.resolve("miniapp");
const read = (p) =>
  JSON.parse(
    fs.readFileSync(path.join(root, p), "utf8").replace(/^\uFEFF/, ""),
  );
const app = read("app.json"),
  config = read("project.config.json");
assert.equal(config.appid, "wx71016248d99d9bd4");
for (const page of app.pages) {
  for (const ext of ["ts", "json", "wxml", "wxss"])
    assert.ok(
      fs.existsSync(path.join(root, `${page}.${ext}`)),
      `Missing ${page}.${ext}`,
    );
  const xml = fs.readFileSync(path.join(root, page + ".wxml"), "utf8");
  assert.ok(
    !/<(?:div|span|i|b|p)(?:\s|>)/.test(xml),
    `Unsupported HTML in ${page}`,
  );
  const tags = xml.match(/<\/?[\w-]+[^>]*>/g) || [];
  const stack = [];
  for (const tag of tags) {
    const name = tag.match(/^<\/?([\w-]+)/)[1];
    if (tag.startsWith("</"))
      assert.equal(stack.pop(), name, `Unclosed WXML tag in ${page}`);
    else if (!tag.endsWith("/>")) stack.push(name);
  }
  assert.equal(stack.length, 0, `Unclosed WXML in ${page}`);
  read(page + ".json");
}
for (const tab of app.tabBar.list) {
  assert.ok(app.pages.includes(tab.pagePath));
  for (const field of ["iconPath", "selectedIconPath"])
    assert.ok(
      fs.existsSync(path.join(root, tab[field])),
      `Missing ${tab[field]}`,
    );
}
assert.equal(read("custom-tab-bar/index.json").component, true);
for (const ext of ["ts", "wxml", "wxss"])
  assert.ok(fs.existsSync(path.join(root, "custom-tab-bar/index." + ext)));
console.log(
  `Miniapp: ${app.pages.length} pages, AppID, native tabBar and local resources passed.`,
);

// Validate the actual CommonJS runtime files used by DevTools, not just TS types.
const modules = new Map();
const registrations = { app: 0, pages: 0, components: 0 };
function load(file) {
  const absolute = path.resolve(file);
  assert.ok(
    absolute.startsWith(root + path.sep),
    "Runtime import escaped miniapp",
  );
  if (modules.has(absolute)) return modules.get(absolute).exports;
  assert.ok(
    fs.existsSync(absolute),
    `Missing runtime JavaScript ${absolute}; run npm --prefix miniapp run build`,
  );
  const module = { exports: {} };
  modules.set(absolute, module);
  const register = (kind) => (definition) => {
    assert.ok(definition && typeof definition === "object");
    registrations[kind]++;
  };
  const run = vm.runInThisContext(
    `(function(require,module,exports,App,Page,Component){${fs.readFileSync(absolute, "utf8")}\n})`,
    { filename: absolute },
  );
  run(
    (id) => {
      assert.ok(id.startsWith("."), "Unexpected runtime dependency");
      return load(path.resolve(path.dirname(absolute), id + ".js"));
    },
    module,
    module.exports,
    register("app"),
    register("pages"),
    register("components"),
  );
  return module.exports;
}
load(path.join(root, "app.js"));
for (const page of app.pages) load(path.join(root, page + ".js"));
load(path.join(root, "custom-tab-bar/index.js"));
assert.deepEqual(registrations, {
  app: 1,
  pages: app.pages.length,
  components: 1,
});
console.log("Miniapp runtime entrypoints and CommonJS imports passed.");
