import { api, Run, tab, getRun, getSchool, School, showError } from "../../utils/api";
Page({
  data: {
    message: "我想申请奖学金，需要准备什么？",
    loading: false,
    run: null as Run | null,
    error: "",
    school: null as School | null,
    profileText: "",
    eligibilityLabel: "",
    hints: ["宿舍空调坏了，怎么报修？", "我想请三天病假", "报名校园志愿活动"],
  },
  onShow() {
    tab(this, 1);
    const school = getSchool() || null;
    const cached = getRun();
    const run = cached && (cached.schoolId || null) === (school?.id || null) ? cached : null;
    this.setData({ school, run, ...(run ? { message: run.question || this.data.message,
      profileText: Object.entries(run.profile || {}).map(([key,value]) => key + "：" + value).join("\n"),
      eligibilityLabel: this.label(run.eligibility) } : {}) });
    const pending = wx.getStorageSync("pendingQuestion");
    if (pending) {
      this.setData({ message: pending });
      wx.removeStorageSync("pendingQuestion");
    }
  },
  label(status?: string) { return status === "preliminary_met" ? "已提供信息初步符合" : status === "unmet" ? "发现不符合项" : "需补充信息或规则"; },
  library() { wx.navigateTo({ url: "/pages/library/library" }); },
  demo() { wx.removeStorageSync("currentSchool"); wx.removeStorageSync("currentRun"); this.setData({ school: null, run: null, profileText: "" }); },
  profileInput(e: WechatMiniprogram.Input) { this.setData({ profileText: e.detail.value }); },
  source(e: WechatMiniprogram.TouchEvent) {
    const citation = this.data.run?.citations[Number(e.currentTarget.dataset.index)];
    if (citation?.documentId) wx.navigateTo({ url: "/pages/source/source?id=" + citation.documentId + "&quote=" + encodeURIComponent(citation.quote || "") });
  },
  async material(e: WechatMiniprogram.TouchEvent) {
    const run = this.data.run; if (!run || this.data.loading) return;
    const name = run.materials?.[Number(e.currentTarget.dataset.index)].name; if (!name) return;
    const provided = run.providedMaterials || [];
    const selected = provided.includes(name) ? provided.filter((item: string) => item !== name) : [...provided, name];
    this.setData({ "run.providedMaterials": selected });
    await this.send();
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
      const profile: Record<string,string> = {};
      for (const line of this.data.profileText.split(/\n/)) {
        const index = line.search(/[:：]/);
        if (index > 0) profile[line.slice(0,index).trim()] = line.slice(index+1).trim();
      }
      const run = await api<Run>("/api/agent/plan", "POST", {
        message: this.data.message,
        ...(this.data.school ? { schoolId: this.data.school.id, profile,
          ...(this.data.run?.schoolId === this.data.school.id ? { previousRunId: this.data.run.id, providedMaterials: this.data.run.providedMaterials || [] } : {}) } : {}),
      });
      wx.setStorageSync("currentRun", run);
      if (!this.data.run || this.data.run.schoolId !== run.schoolId || this.data.run.question !== run.question) wx.removeStorageSync("currentOcr");
      wx.removeStorageSync("currentForm");
      this.setData({ run, eligibilityLabel: this.label(run.eligibility) });
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
