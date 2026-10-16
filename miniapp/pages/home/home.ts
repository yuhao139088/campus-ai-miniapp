import { api, Service, Task, tab, showError } from "../../utils/api";
Page({
  data: { services: [] as Service[], tasks: [] as Task[], error: "" },
  onShow() {
    tab(this, 0);
    this.load();
  },
  async load() {
    try {
      const [s, t] = await Promise.all([
        api<{ items: Service[] }>("/api/services"),
        api<{ items: Task[] }>("/api/tasks"),
      ]);
      this.setData({
        services: s.items,
        tasks: t.items.slice(0, 2),
        error: "",
      });
    } catch (e) {
      this.setData({ error: (e as Error).message });
    }
  },
  ask() {
    wx.switchTab({ url: "/pages/assistant/assistant" });
  },
  openService(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({
      url: "/pages/service/service?id=" + e.currentTarget.dataset.id,
    });
  },
  tasks() {
    wx.switchTab({ url: "/pages/tasks/tasks" });
  },
  retry() {
    this.load();
  },
});
