import { api, Service, showError } from "../../utils/api";
Page({
  data: {
    services: [] as Service[],
    selected: null as Service | null,
    error: "",
  },
  async onLoad(options: Record<string, string>) {
    try {
      const r = await api<{ items: Service[] }>("/api/services");
      this.setData({
        services: r.items,
        selected: r.items.find((s: Service) => s.id === options.id) || null,
      });
    } catch (e) {
      this.setData({ error: (e as Error).message });
    }
  },
  choose(e: WechatMiniprogram.TouchEvent) {
    this.setData({
      selected:
        this.data.services.find(
          (s: Service) => s.id === e.currentTarget.dataset.id,
        ) || null,
    });
  },
  ask() {
    wx.setStorageSync(
      "pendingQuestion",
      "我想办理" + this.data.selected!.title + "，请帮我规划流程",
    );
    wx.switchTab({ url: "/pages/assistant/assistant" });
  },
});
