import { api } from "../../utils/api";
Page({
  data: { doc: null as null | { title: string; sourceUrl?: string; notice: string; version: string; sections: { label: string; text: string }[] }, error: "", quote: "" },
  async onLoad(query: Record<string, string>) {
    this.setData({ quote: query.quote ? decodeURIComponent(query.quote) : "" });
    try { this.setData({ doc: await api("/api/library/documents/" + encodeURIComponent(query.id || "")) }); }
    catch (error) { this.setData({ error: (error as Error).message }); }
  },
  copy() { if (this.data.doc?.sourceUrl) wx.setClipboardData({ data: this.data.doc.sourceUrl }); },
});
