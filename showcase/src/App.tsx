import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Check,
  FileText,
  ScanLine,
  Clock,
  Layers,
  ChevronRight,
  Plus,
  BookOpen,
  Menu,
  X,
  AlertCircle,
  RefreshCw,
  CheckCheck,
  Compass,
} from "lucide-react";
import SpotlightCard from "./components/SpotlightCard";
import {
  api,
  type Run,
  type OCR,
  type Form,
  type Task,
  type Health,
} from "./api";
const phases = ["智能规划", "材料识别", "生成表单", "办理追踪"];
const toolNames: Record<string, string> = {
  identifyService: "识别办理事项",
  searchCampusKnowledge: "检索校园指南",
  generateChecklist: "生成办理清单",
};
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState("我想申请奖学金，需要准备什么？");
  const [run, setRun] = useState<Run | null>(null);
  const [ocr, setOcr] = useState<OCR | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<{ id: string; dueAt: string }[]>(
    [],
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [architecture, setArchitecture] = useState(false);
  const [menu, setMenu] = useState(false);
  const reduced = useReducedMotion();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!architecture) return;
    const previous = document.activeElement as HTMLElement | null;
    const nodes = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button,a,input,textarea,[tabindex="0"]',
        ) || [],
      );
    nodes()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArchitecture(false);
      if (e.key === "Tab") {
        const list = nodes();
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [architecture]);
  async function loadTasks() {
    const [t, r] = await Promise.all([
      api<{ items: Task[] }>("/api/tasks"),
      api<{ items: { id: string; dueAt: string }[] }>("/api/reminders"),
    ]);
    setTasks(t.items);
    setReminders(r.items);
  }
  useEffect(() => {
    api<Health>("/api/health", "GET", undefined, true)
      .then(setHealth)
      .catch(() => setHealth(null));
    loadTasks().catch((e) => setError(e.message));
  }, []);
  async function perform(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  }
  function plan() {
    perform("正在识别事项与规划", async () => {
      const result = await api<Run>("/api/agent/plan", "POST", { message });
      setRun(result);
      setOcr(null);
      setForm(null);
      setStage(0);
    });
  }
  function parse(body: unknown) {
    perform("正在识别材料", async () => {
      setOcr(await api<OCR>("/api/ocr/parse", "POST", body));
      setForm(null);
    });
  }
  function generate() {
    if (!run) return;
    perform("正在生成表单草稿", async () => {
      setForm(
        await api<Form>("/api/forms/generate", "POST", {
          serviceId: run.intent,
          runId: run.id,
          ocrId: ocr?.id,
        }),
      );
      setStage(2);
    });
  }
  function confirm() {
    if (!form || !run) return;
    perform("正在确认与保存", async () => {
      const updated = await api<Form>("/api/forms/" + form.id, "PUT", {
        fields: form.fields,
        confirm: true,
      });
      setForm(updated);
      if (!updated.confirmed) throw new Error("请补充或修正标记字段后再次确认");
      await api("/api/tasks", "POST", { runId: run.id, formId: form.id });
      await loadTasks();
      setStage(3);
    });
  }
  const icons = [
    <Sparkles size={19} />,
    <ScanLine size={19} />,
    <FileText size={19} />,
    <Layers size={19} />,
  ];
  return (
    <div className="app">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a className="brand" href="#">
          <span className="brand-mark">
            <Compass size={27} />
          </span>
          <span>
            <b>校园智办</b>
            <small>CampusPilot</small>
          </span>
        </a>
        <button
          className="mobile-close icon-btn"
          aria-label="关闭导航"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {phases.map((p, i) => (
            <button
              key={p}
              className={stage === i ? "nav-item active" : "nav-item"}
              onClick={() => {
                setStage(i);
                setMenu(false);
              }}
            >
              {icons[i]}
              {p}
              <span className="nav-index">0{i + 1}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-orb" />
          <b>一个问题，一个计划。</b>
          <p>
            校园里的下一步，
            <br />
            从这里开始。
          </p>
          <span className="tag">AI 驱动的校园事务助手</span>
        </div>
        <div className="profile">
          <span className="user-avatar">演</span>
          <div>
            <b>演示同学</b>
            <small>虚构校园 · 演示会话</small>
          </div>
          <ChevronRight size={16} />
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-btn"
              aria-label="打开导航"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>工作空间</span>
            <ChevronRight size={14} />
            <b>{phases[stage]}</b>
          </div>
          <div className="top-actions">
            <span className={"health " + (health ? "online" : "")}>
              <i />
              {health
                ? "服务在线 · " +
                  (health.ai === "configured" ? "AI 已配置" : "离线演示")
                : "服务待连接"}
            </span>
            <button className="quiet" onClick={() => setArchitecture(true)}>
              项目架构 <ArrowUpRight size={14} />
            </button>
          </div>
        </header>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> YOUR CAMPUS, SIMPLIFIED
            </div>
            <h1>
              校园大小事，
              <br />
              <span>都有清晰的下一步。</span>
            </h1>
            <p>
              从“我该怎么办”，到“接下来这样办”。
              <br />让 AI 整理流程，把时间还给校园生活。
            </p>
            <div className="hero-bottom">
              <span className="agent-badge">
                <Sparkles size={14} /> 校园事务 Agent
              </span>
              <span className="hero-caption">问答 · 材料 · 表单 · 追踪</span>
            </div>
          </div>
          <div className="hero-visual">
            <img src="/assets/campus-hero.jpg" alt="未来校园服务中心插画" />
            <div className="visual-caption">
              <span className="status-dot" /> CAMPUS SERVICE TERMINAL{" "}
              <span>01 / 04</span>
            </div>
          </div>
        </section>
        <section className="workspace">
          <div className="section-head">
            <div>
              <div className="eyebrow">LET’S MAKE IT HAPPEN</div>
              <h2>你的智办工作台</h2>
            </div>
            <span className="demo-label">演示知识库 · 无真实校方审批</span>
          </div>
          <div className="step-navigation">
            {phases.map((p, i) => (
              <button
                key={p}
                className={stage === i ? "selected" : ""}
                onClick={() => setStage(i)}
              >
                <span>{i + 1}</span>
                {p}
                {i < 3 && <ChevronRight size={15} />}
              </button>
            ))}
          </div>
          {error && (
            <div role="alert" className="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="icon-btn"
                onClick={() => setError("")}
                aria-label="关闭提示"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div
            aria-live="polite"
            className={busy ? "activity visible" : "activity"}
          >
            <span className="processing-dot" />
            {busy || "准备就绪"}
            {busy && <span>复杂任务可能需要一分钟</span>}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.22 }}
            >
              {stage === 0 && (
                <div className="planning-grid">
                  <SpotlightCard
                    className="composer panel"
                    spotlightColor="rgba(62,227,200,0.3)"
                  >
                    <PanelHeading
                      icon={<Sparkles size={20} />}
                      title="说说你想办什么"
                      subtitle="不用查找入口，直接描述需求。"
                      label="AGENT"
                    />
                    <label className="sr-only" htmlFor="request">
                      校园事务描述
                    </label>
                    <textarea
                      id="request"
                      maxLength={2000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="例如：我想申请奖学金，需要准备什么？"
                    />
                    <div className="composer-footer">
                      <span>{message.length} / 2000</span>
                      <button
                        className="primary"
                        disabled={!!busy || !message.trim()}
                        onClick={plan}
                      >
                        {busy ? "正在规划…" : "生成办理计划"}
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="suggestions">
                      <span>试着问问</span>
                      {[
                        "奖学金申请",
                        "宿舍空调报修",
                        "请三天病假",
                        "校园活动报名",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() =>
                            setMessage("我想办理" + q + "，需要准备什么？")
                          }
                        >
                          {q}
                          <Plus size={12} />
                        </button>
                      ))}
                    </div>
                    <div className="privacy-note">
                      仅上传必要信息，所有 AI 草稿都由你最终确认。
                    </div>
                  </SpotlightCard>
                  <div className="panel output">
                    <PanelHeading
                      blue
                      icon={<Layers size={20} />}
                      title={run ? "办理路径已整理" : "清晰，从这里开始"}
                      subtitle={
                        run
                          ? run.mode === "live"
                            ? "实时 AI 结果"
                            : run.mode === "fallback"
                              ? "模型降级 · 知识库参考"
                              : "离线演示结果"
                          : "一次表达需求，四个环节协同"
                      }
                      label="PLAN"
                    />
                    {run ? (
                      <>
                        <p className="answer">{run.answer}</p>
                        {run.warning && (
                          <div className="warning">
                            模型暂不可用，以下是演示知识库参考流程。
                          </div>
                        )}
                        <ol className="checklist">
                          {run.steps.map((s, i) => (
                            <li key={i}>
                              <span
                                className={
                                  s.status === "done" ? "check done" : "check"
                                }
                              >
                                {s.status === "done" ? (
                                  <Check size={12} />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <div>
                                <b>{s.title}</b>
                                <small>{s.description}</small>
                              </div>
                            </li>
                          ))}
                        </ol>
                        <div className="sources">
                          {run.citations.map((c) => (
                            <span key={c.sourceId}>
                              <BookOpen size={12} />
                              {c.title}
                            </span>
                          ))}
                        </div>
                        {!!run.steps.length && (
                          <button
                            className="text-button"
                            onClick={() => setStage(1)}
                          >
                            下一步：准备材料 <ArrowRight size={16} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="empty-orbit">
                          <div>
                            <Compass size={38} />
                          </div>
                          <span className="orbit-dot" />
                        </div>
                        <div className="output-empty">
                          把复杂的事，拆成可执行的步骤。
                        </div>
                        <div className="mini-flow">
                          需求
                          <ArrowRight size={14} />
                          材料
                          <ArrowRight size={14} />
                          草稿
                          <ArrowRight size={14} />
                          追踪
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {stage === 1 && (
                <div className="planning-grid">
                  <div className="panel document-panel">
                    <PanelHeading
                      icon={<ScanLine size={20} />}
                      title="让材料自己说话"
                      subtitle="图像识别或文字提取，结果可核对。"
                    />
                    <label className="upload-zone">
                      <ScanLine size={34} />
                      <b>选择材料图片</b>
                      <span>PNG / JPEG / WebP · 最大 8MB</span>
                      <input
                        aria-label="上传材料图片"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={!!busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 8 * 1024 * 1024) {
                              setError("请选择8MB以内的图片");
                              return;
                            }
                            const fd = new FormData();
                            fd.append("file", file);
                            parse(fd);
                          }
                        }}
                      />
                    </label>
                    <p className="privacy-note">
                      图片将发送至配置的模型服务用于识别；请勿上传无关敏感信息。
                    </p>
                    <label htmlFor="material-text">或粘贴材料文字</label>
                    <textarea
                      id="material-text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={10000}
                      placeholder={
                        "姓名：林晓\n学号：2026001001\n学院：计算机学院"
                      }
                    />
                    <div className="button-row">
                      <button
                        className="primary"
                        onClick={() => parse({ text })}
                        disabled={!!busy || !text}
                      >
                        提取文字字段
                      </button>
                      <button
                        className="secondary"
                        disabled={!!busy}
                        onClick={() => parse({ sample: "true" })}
                      >
                        使用虚构样本
                      </button>
                    </div>
                  </div>
                  <div className="panel">
                    <PanelHeading
                      blue
                      icon={<FileText size={20} />}
                      title="字段核对区"
                      subtitle={
                        ocr
                          ? ocr.mode === "vision"
                            ? "来自图像识别"
                            : ocr.mode === "sample"
                              ? "虚构样本，未进行OCR"
                              : "来自粘贴文字"
                          : "识别完成后将在此展示"
                      }
                    />
                    {ocr ? (
                      <>
                        <dl className="field-results">
                          {Object.entries(ocr.fields).map(([k, v]) => (
                            <div key={k}>
                              <dt>{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                        {!Object.keys(ocr.fields).length && (
                          <p className="empty-text">
                            没有找到可提取字段，请补充材料。
                          </p>
                        )}
                        {ocr.warnings.map((w, i) => (
                          <p className="warning" key={i}>
                            {w}
                          </p>
                        ))}
                        <button
                          className="primary full"
                          disabled={!run || !!busy}
                          onClick={generate}
                        >
                          生成可编辑表单 <ArrowRight size={16} />
                        </button>
                        {!run && (
                          <p className="warning">
                            请先在智能规划中识别办理事项。
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="empty-text">
                        <ScanLine size={42} />
                        <p>每一个字段，都有来源。</p>
                        <span>无法识别的内容保持为空，不替你猜测。</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {stage === 2 && (
                <div className="panel form-panel">
                  <PanelHeading
                    icon={<FileText size={20} />}
                    title="核对申请草稿"
                    subtitle="AI 整理信息，决定权交给你。"
                    label="DRAFT"
                  />
                  {form ? (
                    <>
                      <div className="form-grid">
                        {Object.entries(form.fields).map(([k, v]) => (
                          <label key={k}>
                            {k}
                            <span> *</span>
                            <input
                              value={v}
                              maxLength={500}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  fields: {
                                    ...form.fields,
                                    [k]: e.target.value,
                                  },
                                })
                              }
                              placeholder={"请核对" + k}
                            />
                            {form.validation.errors[k] && (
                              <small className="field-error">
                                {form.validation.errors[k]}
                              </small>
                            )}
                          </label>
                        ))}
                      </div>
                      <p className="privacy-note">
                        确认后保存自助办理草稿，尚未向学校提交。空白信息需要你补充。
                      </p>
                      <div className="button-row">
                        <button
                          className="primary"
                          disabled={!!busy}
                          onClick={confirm}
                        >
                          <CheckCheck size={17} />
                          确认表单并创建任务
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(
                                Object.entries(form.fields)
                                  .map(([k, v]) => k + "：" + v)
                                  .join("\n"),
                              )
                              .catch(() =>
                                setError("剪贴板不可用，请手动复制"),
                              );
                          }}
                        >
                          复制表单
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-text">
                      <FileText size={42} />
                      <p>先识别事项，再整理表单。</p>
                      <button
                        className="primary"
                        disabled={!run || !!busy}
                        onClick={generate}
                      >
                        根据当前计划生成草稿
                      </button>
                      {!run && (
                        <button
                          className="text-button"
                          onClick={() => setStage(0)}
                        >
                          返回智能规划 →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {stage === 3 && (
                <div className="task-layout">
                  <div>
                    <div className="task-toolbar">
                      <h3>
                        我的办理任务 <span>{tasks.length}</span>
                      </h3>
                      <button
                        className="quiet"
                        onClick={() => perform("正在读取任务", loadTasks)}
                      >
                        <RefreshCw size={15} />
                        刷新
                      </button>
                    </div>
                    {tasks.length ? (
                      tasks.map((t) => (
                        <div className="panel task-card" key={t.id}>
                          <div className="task-heading">
                            <h3>{t.title}</h3>
                            <span className="tag">{t.status}</span>
                            <strong>
                              {t.progress}
                              <small>%</small>
                            </strong>
                          </div>
                          <div className="progress-track">
                            <motion.div
                              initial={false}
                              animate={{ width: t.progress + "%" }}
                              transition={{ duration: reduced ? 0 : 0.35 }}
                            />
                          </div>
                          <ol className="checklist">
                            {t.steps.map((s, i) => (
                              <li key={i}>
                                <button
                                  aria-label={
                                    (s.status === "done"
                                      ? "取消完成："
                                      : "完成：") + s.title
                                  }
                                  disabled={!!busy}
                                  className={
                                    s.status === "done" ? "check done" : "check"
                                  }
                                  onClick={() =>
                                    perform("正在更新办理节点", async () => {
                                      await api("/api/tasks/" + t.id, "PUT", {
                                        stepIndex: i,
                                        status:
                                          s.status === "done" ? "todo" : "done",
                                      });
                                      await loadTasks();
                                    })
                                  }
                                >
                                  {s.status === "done" ? (
                                    <Check size={13} />
                                  ) : (
                                    i + 1
                                  )}
                                </button>
                                <div>
                                  <b>{s.title}</b>
                                  <small>{s.description}</small>
                                </div>
                              </li>
                            ))}
                          </ol>
                          <button
                            className="secondary"
                            disabled={!!busy}
                            onClick={() =>
                              perform("正在设置站内提醒", async () => {
                                await api("/api/reminders", "POST", {
                                  taskId: t.id,
                                  dueAt: new Date(
                                    Date.now() + 86400000,
                                  ).toISOString(),
                                });
                                await loadTasks();
                              })
                            }
                          >
                            <Clock size={15} />
                            明天提醒我继续
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="panel empty-text">
                        <Layers size={42} />
                        <p>办理从第一份计划开始。</p>
                        <button className="primary" onClick={() => setStage(0)}>
                          创建办理计划 <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="panel reminders">
                    <PanelHeading
                      blue
                      icon={<Clock size={20} />}
                      title="站内提醒"
                      subtitle="每一步安排，都记在这里。"
                    />
                    {reminders.length ? (
                      reminders.map((r) => (
                        <div className="reminder" key={r.id}>
                          <span className="status-dot" />
                          <div>
                            <b>继续办理校园事务</b>
                            <small>
                              {new Date(r.dueAt).toLocaleString("zh-CN")}
                            </small>
                            <span className="tag">
                              {Date.parse(r.dueAt) <= Date.now()
                                ? "已到提醒时间"
                                : "已安排"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-text">还没有设置提醒。</p>
                    )}
                    <p className="privacy-note">
                      微信订阅通知待配置。此处为站内提醒，不会发送微信推送。
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          {run && stage === 0 && (
            <div className="execution">
              <span>TOOL TRACE</span>
              {run.trace.map((t, i) => (
                <span key={i}>
                  <Check size={13} />
                  {toolNames[t.tool] || t.tool}
                </span>
              ))}
            </div>
          )}
        </section>
        <section className="capabilities">
          {[
            ["01", "理解需求", "自然语言识别四类校园事务"],
            ["02", "整理材料", "识别信息，标记需要核对的字段"],
            ["03", "生成行动", "可编辑草稿与可追踪的办理清单"],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
              <ArrowUpRight size={19} />
            </div>
          ))}
        </section>
        <footer>
          <span>CampusPilot 校园智办 · 2026</span>
          <span>传智杯 AI微信小程序开发挑战赛</span>
          <span>高超 / 潘庆涛 / 郑宇豪</span>
        </footer>
      </main>
      {architecture && (
        <div className="modal-backdrop" onClick={() => setArchitecture(false)}>
          <section
            ref={dialog}
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="项目架构"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row">
              <h2>一条完整的 AI 办事链路</h2>
              <button
                aria-label="关闭架构"
                className="icon-btn"
                onClick={() => setArchitecture(false)}
              >
                <X />
              </button>
            </div>
            <p>
              原生微信小程序 / React 演示控制台 → Node.js Agent 服务 → Qwen
              兼容模型 → 数据存储适配器
            </p>
            <div className="architecture-flow">
              {[
                "身份验证",
                "知识检索与规划",
                "材料识别",
                "草稿与人工确认",
                "任务与站内提醒",
              ].map((x, i) => (
                <React.Fragment key={x}>
                  <span>{x}</span>
                  {i < 4 && <ArrowRight size={14} />}
                </React.Fragment>
              ))}
            </div>
            <dl className="field-results">
              <div>
                <dt>当前存储</dt>
                <dd>{health?.storage || "未连接"}</dd>
              </div>
              <div>
                <dt>模型配置</dt>
                <dd>{health?.ai || "未连接"}（以每次调用结果为准）</dd>
              </div>
              <div>
                <dt>CloudBase</dt>
                <dd>
                  {health?.storage === "cloudbase-sql"
                    ? "PostgreSQL 已连接，私有 pgstore 存储"
                    : "本地持久化模式"}
                </dd>
              </div>
              <div>
                <dt>知识检索</dt>
                <dd>关键词检索，向量适配器可替换</dd>
              </div>
            </dl>
            <p className="privacy-note">
              知识内容均为自制演示资料。没有真实校方接口、审批或付费。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function PanelHeading({
  icon,
  title,
  subtitle,
  label,
  blue = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  label?: string;
  blue?: boolean;
}) {
  return (
    <div className="panel-heading">
      <span className={"square-icon " + (blue ? "blue" : "")}>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {label && <span className="mini-label">{label}</span>}
    </div>
  );
}
