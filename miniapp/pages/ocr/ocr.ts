import { api, OCR, uploadImage, showError, getRun } from "../../utils/api";
Page({
  data: {
    loading: false,
    text: "",
    ocr: null as OCR | null,
    fields: [] as { key: string; value: string }[],
    error: "",
  },
  input(e: WechatMiniprogram.Input) {
    this.setData({ text: e.detail.value });
  },
  setResult(ocr: OCR) {
    wx.setStorageSync("currentOcr", ocr);
    wx.removeStorageSync("currentForm");
    this.setData({
      ocr,
      fields: Object.entries(ocr.fields).map(([key, value]) => ({
        key,
        value,
      })),
    });
  },
  async choose() {
    try {
      const r = await wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
      });
      if (r.tempFiles[0].size > 8 * 1024 * 1024)
        throw new Error("请选择8MB以内图片");
      this.setData({ loading: true, error: "" });
      this.setResult(await uploadImage(r.tempFiles[0].tempFilePath));
    } catch (e) {
      if (!(e as { errMsg?: string }).errMsg?.includes("cancel"))
        this.setData({ error: (e as Error).message || "选择或上传失败" });
    } finally {
      this.setData({ loading: false });
    }
  },
  async parse(e: WechatMiniprogram.TouchEvent) {
    this.setData({ loading: true, error: "" });
    try {
      this.setResult(
        await api<OCR>(
          "/api/ocr/parse",
          "POST",
          e.currentTarget.dataset.sample
            ? { sample: "true" }
            : { text: this.data.text },
        ),
      );
    } catch (e) {
      this.setData({ error: (e as Error).message });
    } finally {
      this.setData({ loading: false });
    }
  },
  next() {
    if (!getRun()) {
      showError(new Error("请先让助手识别办理事项"));
      return;
    }
    wx.navigateTo({ url: "/pages/form/form" });
  },
});
