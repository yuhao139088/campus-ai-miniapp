import { Worker } from "node:worker_threads";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { createGunzip, createBrotliDecompress, createInflate } from "node:zlib";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";
import { makeId } from "./domain.js";

export const importError = (message, code = "IMPORT_FAILED", status = 400) => Object.assign(new Error(message), { status, code });
export const normalize = (text) => String(text).replace(/\s+/gu, "").normalize("NFKC");
export async function extractFile(bytes, filename) {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw importError("请选择8MB以内的文件");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./document-worker.js", import.meta.url), {
      workerData: { bytes, filename }, resourceLimits: { maxOldGenerationSizeMb: 192 },
    });
    const timer = setTimeout(() => { worker.terminate(); reject(importError("文档解析超时，请拆分后导入")); }, 20000);
    let finished = false;
    const done = (error, result) => { if (finished) return; finished = true; clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result); };
    worker.once("message", (result) => done(result.error ? importError(result.error) : null, result));
    worker.once("error", () => done(importError("文档无法解析，请检查格式或拆分后导入")));
    worker.once("exit", () => { if (!finished) done(importError("文档解析进程退出，请检查文件")); });
  });
}
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
export async function resolvePublicUrl(input, resolver = dns.lookup) {
  let url;
  try { url = new URL(input); } catch { throw importError("请输入完整的http或https网址"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    (url.port && !["80", "443"].includes(url.port)) || !url.hostname.includes(".") ||
    /(?:^|\.)(localhost|local|internal|test|invalid)$/i.test(url.hostname)) throw importError("仅支持公开网页地址", "UNSAFE_URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try {
    addresses = await Promise.race([resolver(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => { const t = setTimeout(() => reject(new Error("DNS timeout")), 5000); t.unref(); })]);
  } catch { throw importError("网址域名无法解析，请检查链接"); }
  if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) throw importError("不能抓取本机、内网或保留网络地址", "UNSAFE_URL");
  return { url, addresses };
}
export async function fetchPublicDocument(input) {
  let current = input;
  for (let hop = 0; hop < 4; hop++) {
    const { url, addresses } = await resolvePublicUrl(current);
    const response = await new Promise((resolve, reject) => {
      const request = (url.protocol === "https:" ? https : http).get(url, {
        agent: false, timeout: 12000,
        headers: { "User-Agent": "CampusPilot/0.2 (user-requested public document import)", Accept: "text/html,text/plain,application/pdf", "Accept-Encoding": "gzip,deflate,br" },
        // Pin the verified DNS answer for this connection; every redirect is revalidated.
        lookup(_host, options, cb) { if (options?.all) cb(null, addresses); else cb(null, addresses[0].address, addresses[0].family); },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400) { res.resume(); resolve({ redirect: res.headers.location }); return; }
        if (res.statusCode !== 200) { res.resume(); reject(importError(`网页返回${res.statusCode}，可下载文件或粘贴正文导入`)); return; }
        const encoding = res.headers["content-encoding"];
        const stream = encoding === "gzip" ? res.pipe(createGunzip()) : encoding === "br" ? res.pipe(createBrotliDecompress()) : encoding === "deflate" ? res.pipe(createInflate()) : res;
        let count = 0; const chunks = [];
        const timer = setTimeout(() => { request.destroy(); reject(importError("网页读取超时")); }, 15000);
        stream.on("data", (chunk) => { count += chunk.length; if (count > 8 * 1024 * 1024) { request.destroy(); stream.destroy(); reject(importError("网页内容超过8MB，请下载并拆分导入")); } else chunks.push(chunk); });
        stream.once("error", () => { clearTimeout(timer); reject(importError("网页读取失败")); });
        res.once("aborted", () => { clearTimeout(timer); reject(importError("网页连接中断")); });
        stream.once("end", () => { clearTimeout(timer); resolve({ bytes: Buffer.concat(chunks), contentType: String(res.headers["content-type"] || ""), url: url.href }); });
      });
      request.once("timeout", () => request.destroy(new Error("timeout")));
      request.once("error", () => reject(importError("网页连接失败，请检查链接或粘贴正文导入")));
    });
    if ("redirect" in response) {
      if (!response.redirect) throw importError("网页跳转缺少目标地址");
      current = new URL(response.redirect, url).href; continue;
    }
    if (/application\/pdf/i.test(response.contentType) || response.bytes.subarray(0, 5).toString() === "%PDF-")
      return { ...(await extractFile(response.bytes, "notice.pdf")), url: response.url, title: "网页PDF通知" };
    if (!/text\/(html|plain)|application\/xhtml\+xml/i.test(response.contentType)) throw importError("网址未返回可读网页或PDF，请下载文件导入");
    let charset = /charset\s*=\s*["']?([\w-]+)/i.exec(response.contentType)?.[1] || /charset=["']?([\w-]+)/i.exec(response.bytes.subarray(0, 3000).toString())?.[1] || "utf-8";
    let html;
    try { html = new TextDecoder(charset).decode(response.bytes); } catch { html = response.bytes.toString("utf8"); }
    const $ = load(html);
    const title = $("h1").first().text().trim() || $("title").text().trim() || "导入的通知网页";
    $("script,style,nav,header,footer,iframe,svg,noscript,form").remove();
    $("p,div,li,h1,h2,h3,tr,br").append("\n");
    const main = $("article,main,.v_news_content,#vsb_content,.article-content").first();
    const text = (main.length ? main.text() : $("body").text()).replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
    if (text.length < 30 || text.length > 120000) throw importError("网页正文不足或过长；登录、验证码和动态页面请粘贴正文导入");
    return { sections: [{ label: "网页正文", text }], title: title.slice(0, 120), url: response.url };
  }
  throw importError("网页跳转次数过多");
}
export function chunkDocument(document) {
  const chunks = [];
  for (const section of document.sections || []) {
    const text = section.text;
    for (let start = 0; start < text.length; start += 900) {
      chunks.push({ sourceId: `${document.id}:${chunks.length + 1}`, documentId: document.id, title: document.title,
        label: section.page ? `第${section.page}页` : section.label, page: section.page, text: text.slice(start, start + 1100), url: document.sourceUrl });
    }
  }
  return chunks;
}
export function retrieveKnowledge(query, docs, limit = 10) {
  const terms = [...new Set(String(query).match(/[\p{Script=Han}]{2}|[A-Za-z0-9]+/gu) || [])];
  const ranked = docs.flatMap(chunkDocument).map((chunk) => ({ ...chunk, score: terms.reduce((score, term) => score + (chunk.text.includes(term) ? 1 : 0) + (chunk.title.includes(term) ? 2 : 0), 0) }));
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
export function makeKnowledgeDocument(input, extracted, userId) {
  const text = extracted.sections.map((section) => section.text).join("\n\n");
  return { id: makeId("document"), userId, schoolId: input.schoolId, title: input.title || extracted.title || "导入的学校资料",
    sourceType: input.sourceType, ...(extracted.url ? { sourceUrl: extracted.url } : {}), ...(input.filename ? { filename: input.filename } : {}),
    sections: extracted.sections, text, status: "active", version: createHash("sha256").update(text).digest("hex").slice(0, 16),
    importedAt: new Date().toISOString(), notice: "用户导入资料，请核对来源与适用范围，系统未认证为校方政策" };
}
export function summarizeDocument(doc) {
  const { text, sections, fileId, userId, ...summary } = doc;
  return { ...summary, characters: text.length, sections: sections.length, preview: text.slice(0, 160) };
}
