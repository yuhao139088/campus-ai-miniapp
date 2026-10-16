import { config } from "../config";
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
  citations: { title: string; sourceId: string; documentId?: string; label?: string; quote?: string }[];
  trace: { tool: string; status: string }[];
  title?: string;
  question?: string;
  schoolId?: string;
  schoolName?: string;
  knowledgeMode?: string;
  eligibility?: string;
  questions?: { key: string; question: string }[];
  criteria?: { rule: string; status: string; explanation: string }[];
  materials?: { name: string; required: boolean; guidance: string; status: string; statusText: string }[];
  profile?: Fields;
  providedMaterials?: string[];
  formFields?: FieldSchema[];
  deadline?: { date: string; explanation: string; expired?: boolean } | null;
};
export type School = { id: string; name: string; campus: string; documentCount?: number };
export type FieldSchema = { key: string; required: boolean; type: string };
export type LibraryDocument = { id: string; title: string; sourceType: string; sourceUrl?: string; importedAt: string;
  version: string; characters: number; sections: number; preview: string };
export type Task = {
  id: string;
  title: string;
  progress: number;
  status: string;
  steps: Step[];
  dueAt?: string;
};
export type Form = {
  id: string;
  fields: Fields;
  validation: { valid: boolean; errors: Fields };
  confirmed: boolean;
  serviceId: string;
  fieldSchema?: FieldSchema[];
};
export type Service = {
  id: string;
  title: string;
  description: string;
  category: string;
  materials: string[];
  fields: string[];
  office: string;
};
export type OCR = {
  id: string;
  fields: Fields;
  warnings: string[];
  mode: string;
};
let loginPromise: Promise<string> | null = null;
export function raw<T>(
  path: string,
  method: WechatMiniprogram.RequestOption["method"] = "GET",
  data?: unknown,
  token?: string,
): Promise<T> {
  return new Promise((resolve, reject) =>
    wx.request({
      url: config.apiBase + path,
      method,
      data: data as WechatMiniprogram.IAnyObject,
      timeout: 120000,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      success: (r) => {
        const b = r.data as { error?: { message: string } };
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data as T);
        else {
          if (r.statusCode === 401) wx.removeStorageSync("session");
          reject(new Error(b.error?.message || "服务请求失败"));
        }
      },
      fail: () => reject(new Error("网络连接失败，请检查服务端地址及合法域名")),
    }),
  );
}
export async function session(): Promise<string> {
  const saved = wx.getStorageSync("session") as
    { token: string; expiresAt: number } | undefined;
  if (saved && saved.expiresAt > Date.now()) return saved.token;
  if (!loginPromise)
    loginPromise = (async () => {
      let data: { token: string; expiresIn: number; resumeKey?: string };
      if (config.authMode === "cloudbase") {
        const r = await wx.cloud.callFunction({ name: "campuspilot-session" });
        const ticket = (r.result as { ticket: unknown }).ticket;
        data = await raw("/api/auth/cloudbase", "POST", ticket);
      } else if (config.authMode === "wechat") {
        const r = await wx.login();
        data = await raw("/api/auth/wechat", "POST", { code: r.code });
      } else {
        data = await raw("/api/auth/demo", "POST", { resumeKey: wx.getStorageSync("demoResumeKey") || undefined });
        if (data.resumeKey) wx.setStorageSync("demoResumeKey", data.resumeKey);
      }
      wx.setStorageSync("session", {
        token: data.token,
        expiresAt: Date.now() + data.expiresIn * 1000,
      });
      return data.token;
    })().finally(() => {
      loginPromise = null;
    });
  return loginPromise;
}
export async function api<T>(
  path: string,
  method: WechatMiniprogram.RequestOption["method"] = "GET",
  data?: unknown,
): Promise<T> {
  return raw<T>(path, method, data, await session());
}
export async function uploadImage(path: string): Promise<OCR> {
  const token = await session();
  return new Promise((resolve, reject) =>
    wx.uploadFile({
      url: config.apiBase + "/api/ocr/parse",
      filePath: path,
      name: "file",
      timeout: 120000,
      header: { Authorization: "Bearer " + token },
      success: (r) => {
        try {
          const d = JSON.parse(r.data);
          if (r.statusCode === 200) resolve(d);
          else reject(new Error(d.error?.message || "识别失败"));
        } catch {
          reject(new Error("识别返回格式异常"));
        }
      },
      fail: () => reject(new Error("上传失败，请检查网络后重试")),
    }),
  );
}
export const showError = (error: unknown) =>
  wx.showToast({
    title: error instanceof Error ? error.message : "操作失败",
    icon: "none",
    duration: 3500,
  });
export function tab(page: any, index: number) {
  if (page.getTabBar) {
    const bar = page.getTabBar();
    if (bar) bar.setData({ selected: index });
  }
}
export const getRun = () => wx.getStorageSync("currentRun") as Run | undefined;
export const getOcr = () => wx.getStorageSync("currentOcr") as OCR | undefined;
export const getSchool = () => wx.getStorageSync("currentSchool") as School | undefined;
export async function uploadDocument(filePath: string, schoolId: string, title: string): Promise<LibraryDocument> {
  const token = await session();
  return new Promise((resolve, reject) => wx.uploadFile({ url: config.apiBase + "/api/library/import", filePath, name: "file",
    formData: { schoolId, title }, timeout: 120000, header: { Authorization: "Bearer " + token },
    success(response) { try { const result = JSON.parse(response.data); if (response.statusCode < 300) resolve(result); else reject(new Error(result.error?.message || "资料导入失败")); } catch { reject(new Error("导入结果格式异常")); } },
    fail: () => reject(new Error("上传失败，请检查网络并重试")),
  }));
}
