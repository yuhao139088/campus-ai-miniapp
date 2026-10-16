import multer from "multer";
import { z } from "zod";
import { makeId } from "./domain.js";
import { extractFile, fetchPublicDocument, importError, makeKnowledgeDocument, summarizeDocument } from "./knowledge.js";

export function registerLibrary(app, store, owned) {
  const ensureSchool = async (userId, schoolId) => {
    const user = await store.get("users", userId);
    const school = user?.schools?.find((item) => item.id === schoolId);
    if (!school) throw importError("学校或校区不存在", "NOT_FOUND", 404);
    return school;
  };
  const privateDocs = async (userId, schoolId) => {
    await ensureSchool(userId, schoolId);
    return (await store.list("campus_documents", { userId })).filter((doc) => doc.schoolId === schoolId && doc.status === "active");
  };
  app.get("/api/schools", async (req, res) => {
    const user = await store.get("users", req.userId);
    const docs = await store.list("campus_documents", { userId: req.userId });
    res.json({ items: (user?.schools || []).map((school) => ({ ...school, documentCount: docs.filter((doc) => doc.schoolId === school.id && doc.status === "active").length })), scope: "private" });
  });
  app.post("/api/schools", async (req, res) => {
    const data = z.object({ name: z.string().trim().min(2).max(80), campus: z.string().trim().max(80).default("") }).parse(req.body);
    const user = (await store.get("users", req.userId)) || { id: req.userId, userId: req.userId };
    if ((user.schools || []).length >= 10) throw importError("最多建立10个学校或校区");
    if (user.schools?.some((school) => school.name === data.name && school.campus === data.campus)) throw importError("这个学校和校区已经存在");
    const school = { id: makeId("school"), ...data, createdAt: new Date().toISOString() };
    await store.save("users", { ...user, schools: [...(user.schools || []), school] });
    res.status(201).json(school);
  });
  app.get("/api/library/documents", async (req, res) => {
    const schoolId = z.string().min(1).max(100).parse(req.query.schoolId);
    res.json({ items: (await privateDocs(req.userId, schoolId)).sort((a, b) => b.importedAt.localeCompare(a.importedAt)).map(summarizeDocument), scope: "private" });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5 },
    fileFilter(_req, file, cb) { cb(/\.(pdf|docx|txt)$/i.test(file.originalname) ? null : importError("请选择PDF、DOCX或TXT文件"), /\.(pdf|docx|txt)$/i.test(file.originalname)); } });
  app.post("/api/library/import", upload.single("file"), async (req, res) => {
    const input = z.object({ schoolId: z.string().max(100), title: z.string().trim().max(120).optional(),
      text: z.string().min(30).max(120000).optional(), url: z.string().max(2048).optional() }).parse(req.body);
    const docs = await privateDocs(req.userId, input.schoolId);
    if (docs.length >= 60) throw importError("每个学校资料库最多60份生效资料，请先归档旧版");
    if ([Boolean(req.file), Boolean(input.text), Boolean(input.url)].filter(Boolean).length !== 1) throw importError("一次请选择文件、网址或正文中的一种");
    let extracted, sourceType;
    if (req.file) { extracted = await extractFile(req.file.buffer, req.file.originalname); sourceType = "file"; }
    else if (input.url) { extracted = await fetchPublicDocument(input.url); sourceType = "url"; }
    else { extracted = { sections: [{ label: "粘贴正文", text: input.text }] }; sourceType = "text"; }
    const doc = makeKnowledgeDocument({ ...input, sourceType, filename: req.file?.originalname }, extracted, req.userId);
    if (docs.some((item) => item.version === doc.version)) throw importError("相同内容已导入这个资料库，无需重复上传");
    await store.save("campus_documents", doc);
    await store.save("audit_logs", { id: makeId("audit"), userId: req.userId, action: "import_document", documentId: doc.id, schoolId: doc.schoolId, createdAt: doc.importedAt });
    res.status(201).json(summarizeDocument(doc));
  });
  app.get("/api/library/documents/:id", async (req, res) => {
    const doc = await owned("campus_documents", req.params.id, req.userId);
    if (doc.status !== "active") throw importError("资料已归档", "NOT_FOUND", 404);
    const { userId, ...result } = doc;
    res.json(result);
  });
  app.post("/api/library/documents/:id/archive", async (req, res) => {
    const doc = await owned("campus_documents", req.params.id, req.userId);
    await store.save("campus_documents", { ...doc, status: "archived", archivedAt: new Date().toISOString() });
    res.json({ id: doc.id, status: "archived" });
  });
  return { ensureSchool, privateDocs };
}
