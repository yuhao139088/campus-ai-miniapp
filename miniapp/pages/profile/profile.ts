import { api, raw, tab, showError } from "../../utils/api";
import { config } from "../../config";
Page({
  data: { apiBase: config.apiBase, mode: config.authMode, health: "" },
  onShow() {
    tab(this, 3);
    raw<{ storage: string; ai: string }>("/api/health")
      .then((h) =>
        this.setData({ health: "存储：" + h.storage + " / AI：" + h.ai }),
      )
      .catch(() => this.setData({ health: "服务暂不可达" }));
  },
  rights() {
    api<{ notice: string }>("/api/rights")
      .then((r) =>
        wx.showModal({
          title: "校园服务权益（模拟）",
          content: r.notice,
          showCancel: false,
        }),
      )
      .catch(showError);
  },
  privacy() {
    wx.showModal({
      title: "数据与隐私",
      content:
        "演示资料均为虚构。上传的材料会发送至配置的模型服务用于识别，表单仅由你确认后保存。任务按用户隔离，不对接学校审批。请勿上传无关敏感信息。正式运营前需补充运营主体、隐私政策与联系信息。",
      showCancel: false,
    });
  },
  logout() {
    wx.removeStorageSync("session");
    wx.removeStorageSync("currentRun");
    wx.removeStorageSync("currentOcr");
    wx.removeStorageSync("currentForm");
    wx.showToast({ title: "本机会话已清除" });
  },
});
