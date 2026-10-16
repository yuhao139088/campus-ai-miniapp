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
        "默认演示资料为虚构，个人导入资料与学校库按用户隔离。核验和图片识别会把相关资料发送给配置的模型服务；表单由你核对保存，不对接学校审批。本机保存演示身份恢复凭据，使重新进入后保留资料库，请勿在公用设备使用。正式运营需完成真实身份与隐私政策接入。",
      showCancel: false,
    });
  },
  logout() {
    wx.removeStorageSync("session");
    wx.removeStorageSync("currentRun");
    wx.removeStorageSync("currentOcr");
    wx.removeStorageSync("currentForm");
    wx.removeStorageSync("currentSchool");
    wx.showToast({ title: "本机会话已清除" });
  },
});
