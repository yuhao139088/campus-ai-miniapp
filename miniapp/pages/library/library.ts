import { api, School, LibraryDocument, getSchool, uploadDocument, Run } from "../../utils/api";
Page({
  data: { schools: [] as School[], schoolNames: [] as string[], selected: null as School | null, documents: [] as LibraryDocument[],
    histories: [] as { id: string; title: string; schoolName?: string }[], name: "", campus: "", title: "", text: "", url: "", mode: "text", loading: false, error: "", creating: false },
  onShow() { this.load(); },
  async load() {
    try {
      const [schools, history] = await Promise.all([api<{ items: School[] }>("/api/schools"), api<{ items: { id: string; title: string; schoolName?: string }[] }>("/api/agent/runs")]);
      const selected = schools.items.find((school) => school.id === getSchool()?.id) || schools.items[0] || null;
      if (selected) wx.setStorageSync("currentSchool", selected); else wx.removeStorageSync("currentSchool");
      this.setData({ schools: schools.items, schoolNames: schools.items.map((school) => school.name + (school.campus ? " · " + school.campus : "")), selected, histories: history.items.filter((run) => run.schoolName), error: "" });
      if (selected) await this.loadDocuments(selected.id);
    } catch (error) { this.setData({ error: (error as Error).message }); }
  },
  async loadDocuments(schoolId: string) {
    const result = await api<{ items: LibraryDocument[] }>("/api/library/documents?schoolId=" + schoolId);
    this.setData({ documents: result.items });
  },
  input(e: WechatMiniprogram.Input) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  toggleCreate() { this.setData({ creating: !this.data.creating }); },
  mode(e: WechatMiniprogram.TouchEvent) { this.setData({ mode: e.currentTarget.dataset.mode, error: "" }); },
  async select(e: WechatMiniprogram.PickerChange) {
    const school = this.data.schools[Number(e.detail.value)];
    wx.setStorageSync("currentSchool", school); this.setData({ selected: school });
    try { await this.loadDocuments(school.id); } catch (error) { this.setData({ error: (error as Error).message }); }
  },
  async create() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: "" });
    try {
      const school = await api<School>("/api/schools", "POST", { name: this.data.name, campus: this.data.campus });
      wx.setStorageSync("currentSchool", school); this.setData({ creating: false, name: "", campus: "" }); await this.load();
    } catch (error) { this.setData({ error: (error as Error).message }); } finally { this.setData({ loading: false }); }
  },
  async importDocument() {
    if (!this.data.selected || this.data.loading) return;
    this.setData({ loading: true, error: "" });
    try {
      const schoolId = this.data.selected.id;
      if (this.data.mode === "file") {
        const result = await wx.chooseMessageFile({ count: 1, type: "file", extension: ["pdf", "docx", "txt"] });
        if (result.tempFiles[0].size > 8 * 1024 * 1024) throw new Error("请选择8MB以内文件");
        await uploadDocument(result.tempFiles[0].path, schoolId, this.data.title || result.tempFiles[0].name);
      } else await api("/api/library/import", "POST", { schoolId, title: this.data.title || undefined, ...(this.data.mode === "url" ? { url: this.data.url } : { text: this.data.text }) });
      this.setData({ title: "", text: "", url: "" }); await this.load(); wx.showToast({ title: "已导入个人资料库" });
    } catch (error) { if (!(error as { errMsg?: string }).errMsg?.includes("cancel")) this.setData({ error: (error as Error).message || "导入失败" }); }
    finally { this.setData({ loading: false }); }
  },
  source(e: WechatMiniprogram.TouchEvent) { wx.navigateTo({ url: "/pages/source/source?id=" + e.currentTarget.dataset.id }); },
  async archive(e: WechatMiniprogram.TouchEvent) {
    const answer = await wx.showModal({ title: "归档这份资料？", content: "后续核验将不再使用它，旧计划仍保留当时的引文。" });
    if (!answer.confirm) return;
    try { await api("/api/library/documents/" + e.currentTarget.dataset.id + "/archive", "POST", {}); await this.load(); }
    catch (error) { this.setData({ error: (error as Error).message }); }
  },
  async history(e: WechatMiniprogram.TouchEvent) {
    try { const run = await api<Run>("/api/agent/runs/" + e.currentTarget.dataset.id); const school = this.data.schools.find((school: School) => school.id === run.schoolId);
      if (school) wx.setStorageSync("currentSchool", school); wx.setStorageSync("currentRun", run); wx.removeStorageSync("currentOcr"); wx.removeStorageSync("currentForm"); wx.switchTab({ url: "/pages/assistant/assistant" });
    } catch (error) { this.setData({ error: (error as Error).message }); }
  },
  ask() { wx.switchTab({ url: "/pages/assistant/assistant" }); },
});
