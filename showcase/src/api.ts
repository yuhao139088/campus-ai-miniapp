export type Fields = Record<string, string>;
export type Step = {
  title: string;
  description: string;
  required: boolean;
  status: "todo" | "doing" | "done";
};
export type Run = {
  id: string;
  intent: string;
  answer: string;
  steps: Step[];
  mode: string;
  warning?: string;
  trace: { tool: string; status: string }[];
  citations: { title: string; sourceId: string }[];
};
export type OCR = {
  id: string;
  fields: Fields;
  mode: string;
  warnings: string[];
};
export type Form = {
  id: string;
  serviceId: string;
  fields: Fields;
  confirmed: boolean;
  validation: { valid: boolean; errors: Fields };
};
export type Task = {
  id: string;
  title: string;
  steps: Step[];
  progress: number;
  status: string;
};
export type Health = {
  status: string;
  storage: string;
  ai: string;
  vision: string;
  subscription: string;
};
const base = import.meta.env.VITE_API_BASE_URL || "";
let pending: Promise<string> | null = null;
async function token(): Promise<string> {
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem("session") || "null");
  } catch {}
  if (saved?.expiresAt > Date.now()) return saved.token;
  if (!pending)
    pending = fetch(base + "/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error?.message || "演示登录失败");
        sessionStorage.setItem(
          "session",
          JSON.stringify({ ...d, expiresAt: Date.now() + d.expiresIn * 1000 }),
        );
        return d.token;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  anonymous = false,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(!(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(!anonymous ? { Authorization: "Bearer " + (await token()) } : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      signal: controller.signal,
    });
    const d = await response.json();
    if (!response.ok) {
      if (response.status === 401) sessionStorage.removeItem("session");
      throw new Error(d.error?.message || "服务请求失败");
    }
    return d;
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error("网络中断或服务端未启动，请检查后重试");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
