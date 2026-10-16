import { api, Form, getRun, getOcr, showError } from "../../utils/api";
Page({
  data: {
    loading: false,
    form: null as Form | null,
    fields: [] as { key: string; value: string; error: string; required: boolean; type: string }[],
    error: "",
  },
  async onLoad() {
    const run = getRun();
    if (!run) {
      this.setData({ error: "请先到助手生成办理计划" });
      return;
    }
    this.setData({ loading: true });
    try {
      const cached = wx.getStorageSync("currentForm") as Form | undefined;
      const form =
        cached ||
        (await api<Form>("/api/forms/generate", "POST", {
          serviceId: run.intent,
          runId: run.id,
          ocrId: getOcr()?.id,
        }));
      this.display(form);
    } catch (e) {
      this.setData({ error: (e as Error).message });
    } finally {
      this.setData({ loading: false });
    }
  },
  display(form: Form) {
    wx.setStorageSync("currentForm", form);
    this.setData({
      form,
      fields: Object.entries(form.fields).map(([key, value]) => ({
        key,
        value,
        error: form.validation.errors[key] || "",
        required: form.fieldSchema?.find((field) => field.key === key)?.required ?? true,
        type: form.fieldSchema?.find((field) => field.key === key)?.type || "text",
      })),
    });
  },
  change(e: WechatMiniprogram.Input) {
    const i = Number(e.currentTarget.dataset.index);
    this.setData({ ["fields[" + i + "].value"]: e.detail.value });
  },
  async save() {
    if (!this.data.form) return;
    this.setData({ loading: true, error: "" });
    try {
      const fields = Object.fromEntries(
        this.data.fields.map((f: { key: string; value: string }) => [
          f.key,
          f.value,
        ]),
      );
      const form = await api<Form>("/api/forms/" + this.data.form.id, "PUT", {
        fields,
        confirm: true,
      });
      this.display(form);
      if (!form.confirmed) {
        this.setData({ error: "请补充或修正标记字段后再次确认" });
        return;
      }
      const task = await api<{ id: string }>("/api/tasks", "POST", {
        runId: getRun()!.id,
        formId: form.id,
      });
      wx.showToast({ title: "表单已确认并创建任务" });
      wx.switchTab({ url: "/pages/tasks/tasks" });
    } catch (e) {
      this.setData({ error: (e as Error).message });
    } finally {
      this.setData({ loading: false });
    }
  },
  copy() {
    const text = this.data.fields
      .map((f: { key: string; value: string }) => f.key + "：" + f.value)
      .join("\n");
    wx.setClipboardData({ data: text });
  },
});
