import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { SignJWT, jwtVerify } from "jose";
import { createHmac, timingSafeEqual, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  makeId,
  serviceCatalog,
  documents,
  searchCampusKnowledge,
  parseTextDocument,
  validateForm,
} from "./domain.js";
import { ModelAdapter } from "./model.js";
import { CampusAgent, agentTools, redact } from "./agent.js";
import { GroundedAgent } from "./grounded-agent.js";
import { registerLibrary } from "./library-routes.js";
import { retrieveKnowledge } from "./knowledge.js";
const fieldsSchema = z.record(z.string().max(40), z.string().max(1000));
const serviceId = z.enum([...serviceCatalog.map((s) => s.id), "general-campus-service"]);
function checkDraft(row, fields) {
  if (!row.fieldSchema) return validateForm(row.serviceId, fields);
  const errors = {};
  for (const field of row.fieldSchema) {
    const value = String(fields[field.key] || "").trim();
    if (field.required && !value) errors[field.key] = "请补充此项";
    else if (value && field.type === "number" && !Number.isFinite(Number(value))) errors[field.key] = "请填写数字";
    else if (value && field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) errors[field.key] = "请填写YYYY-MM-DD日期";
  }
  return { valid: !Object.keys(errors).length, errors };
}
export async function createApp(config, store, providedModel) {
  const app = express();
  const model = providedModel || new ModelAdapter(config.ai);
  // Idempotent seed; never overwrite an edited knowledge document.
  for (const item of serviceCatalog)
    if (!(await store.get("service_items", item.id)))
      await store.save("service_items", item);
  for (const doc of documents)
    if (!(await store.get("campus_documents", doc.id)))
      await store.save("campus_documents", doc);
  const agent = new CampusAgent(model, async () => documents);
  const grounded = new GroundedAgent(model);
  const key = new TextEncoder().encode(config.secret);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, !origin || config.origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 90,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  const fail = (status, code, message) =>
    Object.assign(new Error(message), { status, code });
  const owned = async (name, id, user) => {
    const row = await store.get(name, id);
    if (!row || row.userId !== user) throw fail(404, "NOT_FOUND", "记录不存在");
    return row;
  };
  const issue = async (userId, mode) => ({
    token: await new SignJWT({ mode })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer("campuspilot")
      .setAudience("campuspilot-client")
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(key),
    userId,
    mode,
    expiresIn: 43200,
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      storage: config.storage,
      ai: model.available ? "configured" : "offline",
      vision:
        model.available && Boolean(config.ai.visionModel)
          ? "configured"
          : "unconfigured",
      demo: config.demo,
      subscription: "unconfigured",
    }),
  );
  app.post("/api/auth/demo", async (req, res) => {
    if (!config.demo) throw fail(403, "DEMO_DISABLED", "演示登录已关闭");
    const body = z.object({ resumeKey: z.string().regex(/^[a-f0-9]{64}$/).optional() }).parse(req.body || {});
    const resumeKey = body.resumeKey || randomBytes(32).toString("hex");
    const id = "demo_" + createHash("sha256").update(resumeKey).digest("hex");
    const existing = await store.get("users", id);
    if (body.resumeKey && !existing) throw fail(401, "DEMO_IDENTITY_NOT_FOUND", "本机演示身份不存在，请重新创建资料库身份");
    if (!existing) await store.save("users", { id, userId: id, displayName: "演示同学", createdAt: new Date().toISOString() });
    // Keep only the one-way identifier on the server. The resume key stays on this device.
    res.json({ ...(await issue(id, "demo")), resumeKey });
  });
  app.post("/api/auth/wechat", async (req, res) => {
    const body = z.object({ code: z.string().min(5).max(256) }).parse(req.body);
    if (!config.appSecret)
      throw fail(503, "WECHAT_NOT_CONFIGURED", "微信服务端凭据待配置");
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.search = new URLSearchParams({
      appid: config.appId,
      secret: config.appSecret,
      js_code: body.code,
      grant_type: "authorization_code",
    }).toString();
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    if (!data.openid || data.errcode)
      throw fail(401, "WECHAT_LOGIN_FAILED", "微信身份验证失败");
    const id = `wx_${createHmac("sha256", config.secret).update(data.openid).digest("hex")}`;
    await store.save("users", {
      id,
      userId: id,
      mode: "wechat",
      createdAt: new Date().toISOString(),
    });
    res.json(await issue(id, "wechat"));
  });
  app.post("/api/auth/cloudbase", async (req, res) => {
    if (!config.bridgeSecret)
      throw fail(503, "BRIDGE_NOT_CONFIGURED", "身份桥接待配置");
    const b = z
      .object({
        openid: z.string().min(5).max(128),
        appid: z.string(),
        timestamp: z.number(),
        signature: z.string().length(64),
      })
      .parse(req.body);
    const expected = createHmac("sha256", config.bridgeSecret)
      .update(`${b.openid}|${b.appid}|${b.timestamp}`)
      .digest("hex");
    if (
      b.appid !== config.appId ||
      Math.abs(Date.now() - b.timestamp) > 60000 ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(b.signature))
    )
      throw fail(401, "INVALID_IDENTITY", "身份验证失败");
    res.json(
      await issue(
        `wx_${createHmac("sha256", config.secret).update(b.openid).digest("hex")}`,
        "wechat-cloudbase",
      ),
    );
  });
  app.use("/api", async (req, _res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token) throw new Error();
      const { payload } = await jwtVerify(token, key, {
        issuer: "campuspilot",
        audience: "campuspilot-client",
        algorithms: ["HS256"],
      });
      req.userId = payload.sub;
      next();
    } catch {
      next(fail(401, "UNAUTHORIZED", "登录已失效，请重新进入"));
    }
  });
  app.get("/api/services", (_req, res) =>
    res.json({
      items: serviceCatalog,
      knowledgeMode: "lexical",
      tools: agentTools,
    }),
  );
  const library = registerLibrary(app, store, owned);
  app.post("/api/knowledge/search", async (req, res) => {
    const b = z.object({ query: z.string().min(1).max(2000), schoolId: z.string().optional() }).parse(req.body);
    const items = b.schoolId ? retrieveKnowledge(b.query, await library.privateDocs(req.userId, b.schoolId)) : searchCampusKnowledge(b.query, documents);
    res.json({ items, mode: "lexical", notice: b.schoolId ? "仅检索本人此学校资料" : "演示指南" });
  });
  app.get("/api/agent/runs", async (req, res) => {
    const runs = await store.list("agent_runs", { userId: req.userId });
    res.json({ items: runs.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,30).map(({id,title,intent,schoolName,createdAt,mode,eligibility}) => ({id,title,intent,schoolName,createdAt,mode,eligibility})) });
  });
  app.get("/api/agent/runs/:id", async (req, res) => res.json(await owned("agent_runs", req.params.id, req.userId)));
  const plan = async (req, res) => {
    const b = z.object({ message: z.string().trim().min(1).max(2000), schoolId: z.string().max(100).optional(),
      previousRunId: z.string().optional(), profile: fieldsSchema.optional(), providedMaterials: z.array(z.string().max(120)).max(30).optional(), ocrId: z.string().optional() }).parse(req.body);
    const previous = b.previousRunId ? await owned("agent_runs", b.previousRunId, req.userId) : null;
    if (previous && previous.schoolId !== b.schoolId) throw fail(400, "SCHOOL_MISMATCH", "重新核验须选择原学校资料库");
    const ocr = b.ocrId ? await owned("ocr_records", b.ocrId, req.userId) : null;
    const result = b.schoolId ? await grounded.plan({ message: b.message, school: await library.ensureSchool(req.userId, b.schoolId),
      docs: await library.privateDocs(req.userId, b.schoolId), profile: { ...(previous?.profile || {}), ...(b.profile || {}) },
      providedMaterials: b.providedMaterials || previous?.providedMaterials || [], ocrFields: ocr?.fields || {}, previousRunId: previous?.id }) : await agent.plan(b.message);
    await store.save("agent_runs", { ...result, userId: req.userId });
    await store.save("conversations", { id: makeId("conversation"), userId: req.userId, message: redact(b.message), runId: result.id, createdAt: result.createdAt });
    res.json(result);
  };
  app.post("/api/assistant/chat", plan);
  app.post("/api/agent/plan", plan);
  app.post("/api/agent/execute", async (req, res) => {
    const b = z
      .object({
        runId: z.string(),
        action: z.enum(["getTaskStatus", "generateFormDraft", "validateForm"]),
        taskId: z.string().optional(),
        fields: fieldsSchema.optional(),
      })
      .parse(req.body);
    const run = await owned("agent_runs", b.runId, req.userId);
    if (b.action === "getTaskStatus") {
      res.json(await owned("tasks", b.taskId || "", req.userId));
      return;
    }
    if (b.action === "validateForm") {
      res.json(validateForm(run.intent, b.fields || {}));
      return;
    }
    const s = serviceCatalog.find((s) => s.id === run.intent);
    if (!s) throw fail(400, "UNKNOWN_SERVICE", "请先识别具体事项");
    res.json({
      serviceId: s.id,
      fields: Object.fromEntries(
        s.fields.map((k) => [k, String(b.fields?.[k] || "")]),
      ),
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 6 },
    fileFilter(_req, file, cb) {
      cb(
        null,
        ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype),
      );
    },
  });
  app.post("/api/ocr/parse", upload.single("file"), async (req, res) => {
    const b = z
      .object({
        text: z.string().max(10000).optional(),
        sample: z.enum(["true"]).optional(),
      })
      .parse(req.body || {});
    let fields = {},
      warnings = [],
      mode;
    if (req.file) {
      const bytes = req.file.buffer;
      const valid =
        (req.file.mimetype === "image/png" &&
          bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
        (req.file.mimetype === "image/jpeg" &&
          bytes[0] === 255 &&
          bytes[1] === 216) ||
        (req.file.mimetype === "image/webp" &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP");
      if (!valid) throw fail(400, "INVALID_IMAGE", "图片内容与格式不匹配");
      try {
        const parsed = await model.parseImage(req.file.mimetype, bytes);
        fields = fieldsSchema.parse(parsed.fields);
        warnings = Array.isArray(parsed.warnings)
          ? parsed.warnings.slice(0, 10).map((x) => String(x).slice(0, 300))
          : [];
        mode = "vision";
      } catch (error) {
        throw fail(
          502,
          error.code || "OCR_FAILED",
          "图像识别不可用，可重试或粘贴材料文字；不会生成虚构识别结果",
        );
      }
    } else if (b.sample === "true") {
      if (!config.demo) throw fail(403, "DEMO_DISABLED", "样本功能已关闭");
      fields = parseTextDocument(
        "姓名：林晓\n学号：2026001001\n学院：计算机学院\n绩点：3.85\n申请类别：校级奖学金\n申请理由：积极参与课程学习与校园志愿服务。",
      );
      warnings = ["这是自制虚构样本，未进行图像OCR"];
      mode = "sample";
    } else if (b.text) {
      fields = parseTextDocument(b.text);
      mode = "text";
      warnings = ["从粘贴文字提取，未进行图像OCR"];
    } else throw fail(400, "NO_DOCUMENT", "请选择PNG/JPEG/WebP图片或粘贴文字");
    const id = makeId("ocr");
    let fileId;
    if (req.file && store.upload)
      fileId = await store.upload(
        req.userId,
        `${id}.${req.file.mimetype.split("/")[1]}`,
        req.file.buffer,
      );
    const record = {
      id,
      userId: req.userId,
      fields,
      warnings,
      mode,
      ...(fileId ? { fileId } : {}),
      createdAt: new Date().toISOString(),
    };
    await store.save("ocr_records", record);
    res.json(record);
  });
  app.post("/api/forms/generate", async (req, res) => {
    const b = z
      .object({
        serviceId,
        runId: z.string().optional(),
        ocrId: z.string().optional(),
        fields: fieldsSchema.optional(),
      })
      .parse(req.body);
    const run = b.runId ? await owned("agent_runs", b.runId, req.userId) : null;
    if (run && run.intent !== b.serviceId)
      throw fail(400, "SERVICE_MISMATCH", "表单事项与办理计划不一致");
    const ocr = b.ocrId
      ? await owned("ocr_records", b.ocrId, req.userId)
      : null;
    const s = serviceCatalog.find((s) => s.id === b.serviceId);
    const fieldSchema = run?.knowledgeMode === "imported" ? run.formFields : null;
    if (!s && !fieldSchema) throw fail(400, "UNKNOWN_SERVICE", "请先生成有效办理计划");
    if (fieldSchema && !fieldSchema.length) throw fail(400, "NO_FORM_SCHEMA", "资料未明确申请表字段，请查看原文或仅保存办理任务");
    const input = {
      ...(run?.profile || {}),
      ...(run?.extractedFields || {}),
      ...(ocr?.fields || {}),
      ...(b.fields || {}),
    };
    const fields = Object.fromEntries(
      (fieldSchema ? fieldSchema.map((field) => field.key) : s?.fields || []).map((k) => [k, String(input[k] || "")]),
    );
    const row = {
      id: makeId("form"),
      userId: req.userId,
      serviceId: b.serviceId,
      ...(b.runId ? { runId: b.runId } : {}),
      fields,
      ...(fieldSchema ? { fieldSchema } : {}),
      validation: checkDraft({ serviceId: b.serviceId, fieldSchema }, fields),
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
    await store.save("form_drafts", row);
    res.json(row);
  });
  app.get("/api/forms/:id/export", async (req, res) => {
    const form = await owned("form_drafts", req.params.id, req.userId);
    const run = form.runId ? await owned("agent_runs", form.runId, req.userId) : null;
    const text = ["CampusPilot 办理草稿（本人核对后向正式渠道提交）", run?.title || "申请草稿", "",
      ...Object.entries(form.fields).map(([key,value]) => key + "：" + value), "", "材料清单", ...(run?.materials || []).map((item) => item.name),
      "", "引用来源", ...(run?.citations || []).map((item) => item.title + (item.label ? " / " + item.label : "") + (item.quote ? "：" + item.quote : ""))].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Content-Disposition", 'attachment; filename="campuspilot-form.txt"'); res.send(text);
  });
  app.put("/api/forms/:id", async (req, res) => {
    const b = z
      .object({ fields: fieldsSchema, confirm: z.boolean().optional() })
      .parse(req.body);
    const row = await owned("form_drafts", req.params.id, req.userId);
    const s = serviceCatalog.find((s) => s.id === row.serviceId);
    row.fields = Object.fromEntries(
      (row.fieldSchema ? row.fieldSchema.map((field) => field.key) : s.fields).map((k) => [k, b.fields[k] || ""]),
    );
    row.validation = checkDraft(row, row.fields);
    row.confirmed = Boolean(b.confirm && row.validation.valid);
    row.updatedAt = new Date().toISOString();
    await store.save("form_drafts", row);
    res.json(row);
  });
  app.post("/api/tasks", async (req, res) => {
    const b = z
      .object({
        runId: z.string(),
        formId: z.string().optional(),
        dueAt: z.iso.datetime().optional(),
      })
      .parse(req.body);
    const run = await owned("agent_runs", b.runId, req.userId);
    if (!run.steps?.length || (!run.knowledgeMode && !serviceCatalog.some((s) => s.id === run.intent)))
      throw fail(400, "UNKNOWN_SERVICE", "请补充具体事项");
    if (b.formId) {
      const form = await owned("form_drafts", b.formId, req.userId);
      if (form.serviceId !== run.intent || !form.confirmed)
        throw fail(400, "FORM_NOT_CONFIRMED", "请核对并确认本事项的表单");
    }
    const row = {
      id: makeId("task"),
      userId: req.userId,
      runId: run.id,
      serviceId: run.intent,
      title: run.title || serviceCatalog.find((s) => s.id === run.intent)?.title || "校园办理",
      ...(run.schoolId ? { schoolId: run.schoolId, schoolName: run.schoolName } : {}),
      ...(run.deadline ? { sourceDeadline: run.deadline } : {}),
      steps: run.steps.map((s) => ({ ...s })),
      status: "办理中",
      createdAt: new Date().toISOString(),
      ...(b.formId ? { formId: b.formId } : {}),
      ...(b.dueAt ? { dueAt: b.dueAt } : {}),
    };
    row.progress = Math.round(
      (row.steps.filter((s) => s.status === "done").length / row.steps.length) *
        100,
    );
    await store.save("tasks", row);
    if (b.dueAt)
      await store.save("reminders", {
        id: makeId("reminder"),
        userId: req.userId,
        taskId: row.id,
        dueAt: b.dueAt,
        status: "scheduled",
        channel: "in-app",
      });
    res.status(201).json(row);
  });
  app.get("/api/tasks", async (req, res) =>
    res.json({
      items: (await store.list("tasks", { userId: req.userId })).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    }),
  );
  app.get("/api/tasks/:id", async (req, res) =>
    res.json(await owned("tasks", req.params.id, req.userId)),
  );
  app.put("/api/tasks/:id", async (req, res) => {
    const b = z
      .object({
        stepIndex: z.number().int().nonnegative(),
        status: z.enum(["todo", "doing", "done"]),
      })
      .parse(req.body);
    const row = await owned("tasks", req.params.id, req.userId);
    if (!row.steps[b.stepIndex]) throw fail(400, "INVALID_STEP", "节点不存在");
    row.steps[b.stepIndex].status = b.status;
    row.progress = Math.round(
      (row.steps.filter((s) => s.status === "done").length / row.steps.length) *
        100,
    );
    row.status = row.progress === 100 ? "已完成" : "办理中";
    await store.save("tasks", row);
    res.json(row);
  });
  app.get("/api/reminders", async (req, res) =>
    res.json({
      items: await store.list("reminders", { userId: req.userId }),
      channel: "in-app",
      subscriptionConfigured: false,
    }),
  );
  app.post("/api/reminders", async (req, res) => {
    const b = z
      .object({ taskId: z.string(), dueAt: z.iso.datetime() })
      .parse(req.body);
    await owned("tasks", b.taskId, req.userId);
    if (new Date(b.dueAt) <= new Date())
      throw fail(400, "INVALID_DATE", "请选择未来时间");
    const row = {
      id: makeId("reminder"),
      userId: req.userId,
      ...b,
      channel: "in-app",
      status: "scheduled",
    };
    await store.save("reminders", row);
    res.status(201).json(row);
  });
  app.get("/api/rights", (_req, res) =>
    res.json({
      title: "校园服务权益演示",
      mode: "simulation",
      price: 0,
      enabled: false,
      notice: "模拟展示，无真实订单、支付或收费",
    }),
  );
  app.use((_req, _res, next) => next(fail(404, "NOT_FOUND", "接口不存在")));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "输入格式不正确",
            fields: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        });
      return;
    }
    const status =
      error.type === "entity.parse.failed"
        ? 400
        : error.code === "LIMIT_FILE_SIZE"
          ? 413
          : error.status || 500;
    res
      .status(status)
      .json({
        error: {
          code:
            error.type === "entity.parse.failed"
              ? "INVALID_JSON"
              : error.code || "INTERNAL_ERROR",
          message:
            status === 500 ? "服务暂时不可用，请稍后重试" : error.message,
        },
      });
  });
  return app;
}
