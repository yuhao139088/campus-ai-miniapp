import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.env.VERIFY_API_BASE || "http://127.0.0.1:8787";
const call = async (route, method = "GET", body, token) => {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json();
  assert.ok(response.ok, `${route}: ${JSON.stringify(data.error)}`);
  return data;
};
const health = await call("/api/health");
const session = await call("/api/auth/demo", "POST", {});
const run = await call(
  "/api/agent/plan",
  "POST",
  { message: "我想申请奖学金，需要准备什么？" },
  session.token,
);
assert.equal(run.mode, "live", "Expected actual AI execution");
const upload = new FormData();
upload.append(
  "file",
  new Blob([fs.readFileSync("assets/sample-material.png")], {
    type: "image/png",
  }),
  "sample-material.png",
);
const ocr = await call("/api/ocr/parse", "POST", upload, session.token);
assert.equal(ocr.mode, "vision");
assert.equal(ocr.fields["姓名"], "林晓");
if (health.storage === "cloudbase-sql")
  assert.ok(ocr.fileId?.bucket, "Expected PG Storage upload");
let form = await call(
  "/api/forms/generate",
  "POST",
  { serviceId: run.intent, runId: run.id, ocrId: ocr.id },
  session.token,
);
form = await call(
  "/api/forms/" + form.id,
  "PUT",
  { fields: form.fields, confirm: true },
  session.token,
);
assert.ok(form.confirmed);
let task = await call(
  "/api/tasks",
  "POST",
  { runId: run.id, formId: form.id },
  session.token,
);
for (let i = 0; i < task.steps.length; i++)
  task = await call(
    "/api/tasks/" + task.id,
    "PUT",
    { stepIndex: i, status: "done" },
    session.token,
  );
assert.equal(task.progress, 100);
const reminder = await call(
  "/api/reminders",
  "POST",
  { taskId: task.id, dueAt: new Date(Date.now() + 86400000).toISOString() },
  session.token,
);
const report = {
  checkedAt: new Date().toISOString(),
  storage: health.storage,
  ai: run.mode,
  ocr: ocr.mode,
  uploadedToCloud: Boolean(ocr.fileId),
  formConfirmed: form.confirmed,
  taskProgress: task.progress,
  reminderChannel: reminder.channel,
  taskId: task.id,
};
fs.mkdirSync("AI交接", { recursive: true });
fs.writeFileSync(
  "AI交接/live-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
