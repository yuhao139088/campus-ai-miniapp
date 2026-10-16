import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { LocalStore } from "../src/store.js";
import { ModelAdapter, parseModelJson } from "../src/model.js";
import { CampusAgent } from "../src/agent.js";
import {
  createAgentResult,
  parseTextDocument,
  validateForm,
} from "../src/domain.js";

test("scenario knowledge, extraction and validation use actual content", () => {
  assert.equal(createAgentResult("申请奖学金").intent, "scholarship");
  assert.equal(createAgentResult("空调报修").intent, "dorm-repair");
  assert.equal(createAgentResult("你好").steps.length, 0);
  assert.deepEqual(parseTextDocument("姓名：林晓\n学号：1001"), {
    姓名: "林晓",
    学号: "1001",
  });
  assert.deepEqual(parseTextDocument("模糊的无关材料"), {});
  assert.equal(
    validateForm("leave", {
      姓名: "林",
      学号: "1",
      学院: "A",
      请假原因: "病假",
      开始日期: "2026-10-18",
      结束日期: "2026-10-17",
    }).valid,
    false,
  );
});
test("provider timeout, empty result, invalid model and structured tool calls", async () => {
  const config = {
    mode: "live",
    baseUrl: "https://example.invalid/v1",
    key: "test",
    model: "test",
    timeout: 10,
    retries: 1,
  };
  const bad = new ModelAdapter(config, async () => ({
    ok: false,
    status: 404,
  }));
  await assert.rejects(() => bad.completion([]), { code: "AI_HTTP_404" });
  const empty = new ModelAdapter(config, async () => ({
    ok: true,
    json: async () => ({ choices: [] }),
  }));
  await assert.rejects(() => empty.completion([]), { code: "AI_EMPTY_RESULT" });
  const timeout = new ModelAdapter(config, async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  await assert.rejects(() => timeout.completion([]), { code: "AI_TIMEOUT" });
  assert.throws(() => parseModelJson("not json"), { code: "AI_INVALID_JSON" });
  let count = 0;
  const model = {
    available: true,
    completion: async () =>
      ++count === 1
        ? {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "1",
                type: "function",
                function: {
                  name: "generateChecklist",
                  arguments: '{"serviceId":"scholarship"}',
                },
              },
            ],
          }
        : {
            role: "assistant",
            content: JSON.stringify({
              intent: "scholarship",
              answer: "依据演示指南整理，需以学校通知为准。",
            }),
          },
  };
  const result = await new CampusAgent(model).plan("申请奖学金");
  assert.equal(result.mode, "live");
  assert.ok(result.trace.some((x) => x.tool === "generateChecklist"));
  const fallback = await new CampusAgent({
    available: true,
    completion: async () => {
      throw new Error("failure");
    },
  }).plan("报修");
  assert.equal(fallback.mode, "fallback");
  assert.ok(fallback.warning);
});
test("end-to-end auth, OCR sample, form, task, reminders, ownership and restart", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "campuspilot-"));
  const config = {
    demo: true,
    secret: "test-secret-with-at-least-thirty-two-characters",
    storage: "local",
    origins: ["http://localhost:5173"],
    ai: { mode: "offline" },
    appId: "wx-test",
  };
  const store = await new LocalStore(dir).init();
  const app = await createApp(config, store);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const req = async (route, method = "GET", data, token) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await req("/api/tasks")).status, 401);
  const session = (await req("/api/auth/demo", "POST", {})).data;
  const run = (
    await req(
      "/api/agent/plan",
      "POST",
      { message: "我想申请奖学金" },
      session.token,
    )
  ).data;
  assert.equal(run.mode, "offline");
  assert.ok(run.id);
  const ocr = (
    await req("/api/ocr/parse", "POST", { sample: "true" }, session.token)
  ).data;
  assert.equal(ocr.mode, "sample");
  assert.equal(ocr.fields["姓名"], "林晓");
  const form = (
    await req(
      "/api/forms/generate",
      "POST",
      { runId: run.id, serviceId: run.intent, ocrId: ocr.id },
      session.token,
    )
  ).data;
  assert.equal(form.fields["绩点"], "3.85");
  assert.equal(
    (
      await req(
        "/api/tasks",
        "POST",
        { runId: run.id, formId: form.id },
        session.token,
      )
    ).status,
    400,
  );
  const confirmed = await req(
    "/api/forms/" + form.id,
    "PUT",
    { fields: form.fields, confirm: true },
    session.token,
  );
  assert.equal(confirmed.data.confirmed, true);
  const task = (
    await req(
      "/api/tasks",
      "POST",
      { runId: run.id, formId: form.id },
      session.token,
    )
  ).data;
  assert.ok(task.id);
  assert.ok(task.progress < 100);
  for (let i = 0; i < task.steps.length; i++)
    await req(
      "/api/tasks/" + task.id,
      "PUT",
      { stepIndex: i, status: "done" },
      session.token,
    );
  assert.equal(
    (await req("/api/tasks/" + task.id, "GET", undefined, session.token)).data
      .progress,
    100,
  );
  assert.equal(
    (
      await req(
        "/api/reminders",
        "POST",
        { taskId: task.id, dueAt: new Date(Date.now() + 60000).toISOString() },
        session.token,
      )
    ).status,
    201,
  );
  const other = (await req("/api/auth/demo", "POST", {})).data.token;
  assert.equal(
    (await req("/api/tasks/" + task.id, "GET", undefined, other)).status,
    404,
  );
  assert.equal(
    (await req("/api/forms/" + form.id, "PUT", { fields: form.fields }, other))
      .status,
    404,
  );
  assert.equal(
    (await req("/api/agent/plan", "POST", { message: "" }, session.token))
      .status,
    400,
  );
  const malformed = await fetch(base + "/api/agent/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.token,
    },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  const fd = new FormData();
  fd.append("file", new Blob(["not png"], { type: "image/png" }), "fake.png");
  assert.equal(
    (
      await fetch(base + "/api/ocr/parse", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.token },
        body: fd,
      })
    ).status,
    400,
  );
  const restarted = await new LocalStore(dir).init();
  assert.equal((await restarted.get("tasks", task.id)).progress, 100);
});
