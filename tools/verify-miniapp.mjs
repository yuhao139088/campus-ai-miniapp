import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Install this optional official test SDK outside runtime dependencies:
// npm --prefix .cache/devtools install miniprogram-automator
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const automator = require(
  path.join(root, ".cache/devtools/node_modules/miniprogram-automator"),
);
const report = {
  checkedAt: new Date().toISOString(),
  checks: [],
  exceptions: [],
  selectorMocked: false,
};
let mini, watchdog;
const output = path.join(root, "AI交接/miniapp-verification.json");
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Timed out: " + label);
}
async function pageAt(name) {
  return until(async () => {
    const p = await mini.currentPage();
    return p?.path === `pages/${name}/${name}` ? p : null;
  }, "page " + name);
}
async function clickText(page, text) {
  const buttons = await page.$$("button");
  for (const button of buttons)
    if ((await button.text()).includes(text)) {
      await button.tap();
      return;
    }
  throw new Error("Button not found: " + text);
}
function passed(name, details = {}) {
  report.checks.push({ name, ...details });
  console.log("PASS " + name + " " + JSON.stringify(details));
}
try {
  watchdog = setTimeout(() => {
    console.error("Native test total timeout");
    process.exit(1);
  }, 240000);
  console.log("Connecting to the native automation bridge...");
  mini = await automator.connect({
    wsEndpoint: process.env.MINIAPP_WS || "ws://127.0.0.1:9420",
  });
  const send = mini.send.bind(mini);
  mini.send = (method, params) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Native automation RPC timed out: " + method)),
        method === "App.callWxMethod" ? 30000 : 15000,
      );
      send(method, params).then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  mini.on("exception", (error) => {
    report.exceptions.push(
      String(error.message || error.description || "runtime exception").slice(
        0,
        700,
      ),
    );
  });
  const initial = await mini.currentPage();
  if (initial?.path !== "pages/home/home")
    await mini.switchTab("/pages/home/home");
  let page = await pageAt("home");
  await until(
    async () => (await page.data()).services?.length === 4,
    "home services",
  );
  assert.equal((await page.data()).error, "");
  assert.equal((await page.$$(".service-card")).length, 4);
  passed("home renders four real services");
  await mini.navigateTo("/pages/service/service?id=scholarship");
  page = await pageAt("service");
  await until(
    async () => (await page.data()).selected?.id === "scholarship",
    "service detail",
  );
  passed("service details");
  await mini.switchTab("/pages/assistant/assistant");
  page = await pageAt("assistant");
  const textarea = await page.$("textarea");
  await textarea.input("我想申请奖学金，需要准备什么？");
  await clickText(page, "生成办理计划");
  const run = await until(
    async () => {
      const d = await page.data();
      if (d.error) throw new Error(d.error);
      return !d.loading && d.run?.id ? d.run : null;
    },
    "real AI plan",
    110000,
  );
  assert.equal(run.intent, "scholarship");
  assert.equal(run.mode, "live");
  assert.ok(run.citations.length);
  passed("native Agent real model", {
    mode: run.mode,
    steps: run.steps.length,
  });
  const selected = await mini.evaluate(
    () => getCurrentPages().slice(-1)[0].getTabBar().data.selected,
  );
  assert.equal(selected, 1);
  passed("custom tabBar selection");
  await clickText(page, "上传材料并识别");
  page = await pageAt("ocr");
  const bytes = fs.readFileSync(path.join(root, "assets/sample-material.png"));
  const imagePath = await mini.evaluate((base64) => {
    const file = wx.env.USER_DATA_PATH + "/campuspilot-test-material.png";
    wx.getFileSystemManager().writeFileSync(file, base64, "base64");
    return file;
  }, bytes.toString("base64"));
  // Only replaces the OS photo selector. Upload, vision inference, cloud storage
  // and returned fields below remain the actual implementation and providers.
  await mini.mockWxMethod("chooseMedia", {
    tempFiles: [
      { tempFilePath: imagePath, size: bytes.length, fileType: "image" },
    ],
    type: "image",
  });
  report.selectorMocked = true;
  await clickText(page, "拍照 / 选择材料图片");
  const ocr = await until(
    async () => {
      const d = await page.data();
      if (d.error) throw new Error(d.error);
      return !d.loading && d.ocr?.id ? d.ocr : null;
    },
    "native real OCR",
    110000,
  );
  await mini.restoreWxMethod("chooseMedia");
  report.selectorMocked = false;
  assert.equal(ocr.mode, "vision");
  assert.equal(ocr.fields["姓名"], "林晓");
  passed("native upload + real vision OCR", {
    mode: ocr.mode,
    fields: Object.keys(ocr.fields).length,
  });
  await clickText(page, "生成可编辑表单");
  page = await pageAt("form");
  const draft = await until(async () => {
    const d = await page.data();
    if (d.error) throw new Error(d.error);
    return !d.loading && d.form?.id ? d : null;
  }, "form draft");
  assert.equal(draft.form.fields["学号"], "2026001001");
  const reasonIndex = draft.fields.findIndex((f) => f.key === "申请理由");
  assert.ok(reasonIndex >= 0);
  const inputs = await page.$$("input");
  await inputs[reasonIndex].input("积极参与课程学习、校园志愿服务和团队实践。");
  assert.match((await page.data()).fields[reasonIndex].value, /团队实践/);
  passed("editable generated form");
  await clickText(page, "确认表单并创建任务");
  page = await pageAt("tasks");
  const task = await until(async () => {
    const d = await page.data();
    if (d.error) throw new Error(d.error);
    return d.tasks?.find((t) => t.formId === draft.form.id);
  }, "confirmed form task");
  for (let index = 0; index < task.steps.length; index++)
    if (task.steps[index].status !== "done")
      await page.callMethod("toggle", {
        currentTarget: {
          dataset: { id: task.id, index, status: task.steps[index].status },
        },
      });
  await until(
    async () =>
      (await page.data()).tasks?.find((t) => t.id === task.id)?.progress ===
      100,
    "task completion",
  );
  passed("task persisted at 100%");
  const before = (await page.data()).reminders.length;
  await page.callMethod("remind", {
    currentTarget: { dataset: { id: task.id } },
  });
  await until(
    async () => (await page.data()).reminders.length > before,
    "in-app reminder",
  );
  passed("in-app reminder");
  await mini.switchTab("/pages/profile/profile");
  page = await pageAt("profile");
  await until(
    async () => String((await page.data()).health).includes("cloudbase-sql"),
    "profile SQL health",
  );
  passed("profile SQL connection");
  await mini.switchTab("/pages/home/home");
  page = await pageAt("home");
  await until(
    async () => (await page.data()).tasks?.some((t) => t.id === task.id),
    "home recent task",
  );
  passed("home recent task refresh");
  assert.equal(report.exceptions.length, 0, "Unexpected runtime exception");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (mini) {
    if (report.selectorMocked)
      await mini.restoreWxMethod("chooseMedia").catch(() => {});
    await mini.disconnect().catch(() => {});
  }
  clearTimeout(watchdog);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log("Native verification: " + report.status);
}
