import { api, Task, tab, showError } from "../../utils/api";
Page({
  data: {
    tasks: [] as Task[],
    reminders: [] as {
      id: string;
      taskId: string;
      dueAt: string;
      displayAt?: string;
    }[],
    loading: false,
    error: "",
  },
  onShow() {
    tab(this, 2);
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [t, r] = await Promise.all([
        api<{ items: Task[] }>("/api/tasks"),
        api<{ items: { id: string; taskId: string; dueAt: string }[] }>(
          "/api/reminders",
        ),
      ]);
      this.setData({
        tasks: t.items,
        reminders: r.items.map((x) => ({
          ...x,
          displayAt: new Date(x.dueAt).toLocaleString(),
        })),
        error: "",
      });
    } catch (e) {
      this.setData({ error: (e as Error).message });
    } finally {
      this.setData({ loading: false });
    }
  },
  async toggle(e: WechatMiniprogram.TouchEvent) {
    const { id, index, status } = e.currentTarget.dataset;
    try {
      await api("/api/tasks/" + id, "PUT", {
        stepIndex: Number(index),
        status: status === "done" ? "todo" : "done",
      });
      await this.load();
    } catch (e) {
      showError(e);
    }
  },
  async remind(e: WechatMiniprogram.TouchEvent) {
    try {
      await api("/api/reminders", "POST", {
        taskId: e.currentTarget.dataset.id,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      });
      wx.showToast({ title: "已设置明日站内提醒" });
      this.load();
    } catch (e) {
      showError(e);
    }
  },
  ask() {
    wx.switchTab({ url: "/pages/assistant/assistant" });
  },
});
