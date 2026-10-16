import { api, Run, tab, getRun, showError } from "../../utils/api";
Page({
  data: {
    message: "我想申请奖学金，需要准备什么？",
    loading: false,
    run: null as Run | null,
    error: "",
    hints: ["宿舍空调坏了，怎么报修？", "我想请三天病假", "报名校园志愿活动"],
  },
  onShow() {
    tab(this, 1);
    const pending = wx.getStorageSync("pendingQuestion");
    if (pending) {
      this.setData({ message: pending });
      wx.removeStorageSync("pendingQuestion");
    }
  },
  input(e: WechatMiniprogram.Input) {
    this.setData({ message: e.detail.value });
  },
  hint(e: WechatMiniprogram.TouchEvent) {
    this.setData({
      message: this.data.hints[Number(e.currentTarget.dataset.index)],
    });
  },
  async send() {
    if (this.data.loading || !this.data.message.trim()) return;
    this.setData({ loading: true, error: "" });
    try {
      const run = await api<Run>("/api/agent/plan", "POST", {
        message: this.data.message,
      });
      wx.setStorageSync("currentRun", run);
      wx.removeStorageSync("currentOcr");
      wx.removeStorageSync("currentForm");
      this.setData({ run });
    } catch (e) {
      this.setData({ error: (e as Error).message });
    } finally {
      this.setData({ loading: false });
    }
  },
  ocr() {
    wx.navigateTo({ url: "/pages/ocr/ocr" });
  },
  form() {
    wx.navigateTo({ url: "/pages/form/form" });
  },
  async save() {
    try {
      const t = await api<{ id: string }>("/api/tasks", "POST", {
        runId: this.data.run!.id,
      });
      wx.showToast({ title: "已保存办理任务" });
      wx.switchTab({ url: "/pages/tasks/tasks" });
    } catch (e) {
      showError(e);
    }
  },
});
