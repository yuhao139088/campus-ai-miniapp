import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import { load } from "cheerio";
import yauzl from "yauzl";

const MAX_TEXT = 120000;
async function inspectDocx(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let count = 0, size = 0, documentXml;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        count++; size += entry.uncompressedSize;
        if (count > 800 || size > 32 * 1024 * 1024 || /(^|\/)\.\.(\/|$)/.test(entry.fileName) ||
          /vbaProject\.bin$/i.test(entry.fileName) || entry.isEncrypted()) {
          zip.close(); reject(new Error("DOCX展开体积过大、已加密或含不支持的内容")); return;
        }
        if (entry.fileName === "word/document.xml") {
          zip.openReadStream(entry, (error, stream) => {
            if (error) { zip.close(); reject(error); return; }
            const chunks = []; let length = 0;
            stream.on("data", (chunk) => { length += chunk.length; if (length > 8 * 1024 * 1024) { stream.destroy(); zip.close(); reject(new Error("DOCX正文过大")); } else chunks.push(chunk); });
            stream.once("error", reject);
            stream.once("end", () => { documentXml = Buffer.concat(chunks).toString("utf8"); zip.readEntry(); });
          });
        } else zip.readEntry();
      });
      zip.on("end", () => documentXml ? resolve(documentXml) : reject(new Error("不是有效的DOCX文档")));
      zip.readEntry();
    });
  });
}
try {
  const buffer = Buffer.from(workerData.bytes);
  const ext = path.extname(workerData.filename).toLowerCase();
  const sections = [];
  if (ext === ".pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("PDF内容与扩展名不匹配");
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    const pdf = await loading.promise;
    try {
      if (pdf.numPages > 60) throw new Error("请拆分为60页以内的PDF");
      let length = 0;
      for (let page = 1; page <= pdf.numPages; page++) {
        const item = await pdf.getPage(page);
        const content = await item.getTextContent();
        const text = content.items.map((part) => part.str === undefined ? "" : part.str + (part.hasEOL ? "\n" : " ")).join("").trim();
        length += text.length;
        if (length > MAX_TEXT) throw new Error("正文超过12万字，请拆分导入");
        if (text) sections.push({ page, label: `第${page}页`, text });
        item.cleanup();
      }
    } finally { await loading.destroy(); }
  } else if (ext === ".docx") {
    const xml = await inspectDocx(buffer);
    const $ = load(xml, { xmlMode: true });
    const text = $("w\\:p").map((_index, paragraph) => $(paragraph).find("w\\:t").map((_i, node) => $(node).text()).get().join("")).get().join("\n\n");
    if (text.length > MAX_TEXT) throw new Error("正文超过12万字，请拆分导入");
    sections.push({ label: "文档正文", text: text.trim() });
  } else if (ext === ".txt") {
    if (buffer.includes(0) && !buffer.subarray(0, 2).equals(Buffer.from([255, 254]))) throw new Error("TXT含二进制内容");
    let text;
    if (buffer[0] === 255 && buffer[1] === 254) text = buffer.subarray(2).toString("utf16le");
    else { try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { text = new TextDecoder("gb18030", { fatal: true }).decode(buffer); } }
    if (text.length > MAX_TEXT) throw new Error("正文超过12万字，请拆分导入");
    sections.push({ label: "文档正文", text: text.replace(/^\uFEFF/, "").trim() });
  } else throw new Error("仅支持PDF、DOCX和TXT");
  if (sections.map((section) => section.text).join("").trim().length < 12)
    throw new Error("未提取到足够文字；扫描PDF请先转为可检索PDF，或粘贴通知正文");
  parentPort.postMessage({ sections });
} catch (error) {
  parentPort.postMessage({ error: error.name === "PasswordException" ? "PDF已加密，请解密后重新导入" : String(error.message).slice(0, 240) });
}
