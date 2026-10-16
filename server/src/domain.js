import { randomUUID } from "node:crypto";
export const makeId = (prefix = "id") => `${prefix}_${randomUUID()}`;
export const serviceCatalog = [
  {
    id: "leave",
    title: "请假与销假",
    category: "教务事务",
    description: "整理证明、填写申请与销假提醒",
    tags: ["请假", "销假", "病假", "事假"],
    materials: ["请假原因与起止日期", "相关证明（病假需就诊证明）"],
    fields: ["姓名", "学号", "学院", "请假原因", "开始日期", "结束日期"],
    office: "辅导员 / 学院教务",
    guide:
      "提前向辅导员说明原因；病假准备就诊材料；填写起止日期；获得学校审批后离校，返校后按规定销假。",
  },
  {
    id: "scholarship",
    title: "奖助学金申请",
    category: "资助服务",
    description: "核对条件、整理成绩与证明材料",
    tags: ["奖学金", "助学金", "资助", "评优"],
    materials: ["成绩单或综合测评材料", "申请理由", "相关获奖证明（如有）"],
    fields: ["姓名", "学号", "学院", "申请类别", "申请理由", "绩点"],
    office: "学院学工办 / 资助中心",
    guide:
      "查看本学年学校通知中的资格和时间；准备成绩或综测、申请理由及相应证明；按学院要求提交；关注公示和补材料通知。奖学金与助学金资格不同，最终以学校正式通知为准。",
  },
  {
    id: "dorm-repair",
    title: "宿舍报修",
    category: "后勤服务",
    description: "描述故障、整理照片并生成报修草稿",
    tags: ["报修", "宿舍", "漏水", "门锁", "空调", "断电"],
    materials: ["故障位置与描述", "现场照片（如有）", "可上门维修时间"],
    fields: ["姓名", "学号", "宿舍楼", "房间号", "故障描述", "联系电话"],
    office: "后勤服务中心",
    guide:
      "记录楼栋、房间、故障现象及可维修时间；上传照片，填写报修单；保持电话畅通，处理后验收。漏电、火情等紧急情况应远离现场并直接联系学校值班或应急渠道。",
  },
  {
    id: "activity",
    title: "校园活动报名",
    category: "校园生活",
    description: "整理个人报名信息和参与安排",
    tags: ["活动", "报名", "社团", "志愿", "竞赛"],
    materials: ["活动名称及通知", "个人报名信息", "参与安排"],
    fields: ["姓名", "学号", "学院", "活动名称", "联系电话"],
    office: "活动组织方 / 团委",
    guide:
      "阅读活动通知，核对对象、时间及地点；填写本人信息；提交至组织方并保存回执；设置日程提醒，按要求签到。",
  },
];
export const documents = serviceCatalog.map((s) => ({
  id: `guide-${s.id}`,
  title: `${s.title}办理指南（演示）`,
  serviceId: s.id,
  text: s.guide,
  version: "2026-demo-1",
  sourceType: "synthetic",
  updatedAt: "2026-10-16",
}));
export const classifyIntent = (message = "") =>
  serviceCatalog.find((s) => s.tags.some((t) => message.includes(t)))?.id ||
  "general-campus-service";
export function searchCampusKnowledge(query, knowledge = documents) {
  const words = [...new Set(query.match(/[\p{Script=Han}]{2}|[a-z]+/gu) || [])];
  return knowledge
    .map((d) => ({
      ...d,
      score:
        words.reduce(
          (n, w) => n + (d.text.includes(w) || d.title.includes(w) ? 1 : 0),
          0,
        ) + (d.serviceId === classifyIntent(query) ? 10 : 0),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
export function generateChecklist(serviceId) {
  const s = serviceCatalog.find((s) => s.id === serviceId);
  if (!s) return [];
  return [
    {
      title: "核对办理条件",
      description: `咨询${s.office}，以正式通知为准`,
      required: true,
      status: "done",
    },
    ...s.materials.map((t, i) => ({
      title: t,
      description:
        i === 0 ? "请准备并核对原始材料" : "仅上传本次办理需要的材料",
      required: !t.includes("如有"),
      status: "todo",
    })),
    {
      title: "填写并核对申请",
      description: "AI生成草稿后逐项确认，再向校方提交",
      required: true,
      status: "todo",
    },
    {
      title: "提交并跟踪结果",
      description: "记录自助办理进度，不代表校方审批",
      required: true,
      status: "todo",
    },
  ];
}
export function createAgentResult(
  message = "",
  serviceId = classifyIntent(message),
) {
  const s = serviceCatalog.find((s) => s.id === serviceId);
  return {
    intent: s?.id || "general-campus-service",
    answer: s
      ? `已整理「${s.title}」的办理路径。${s.guide}`
      : "请补充要办理的具体事项，例如请假、奖助学金、报修或活动报名。",
    steps: generateChecklist(serviceId),
    citations: s
      ? [{ title: `${s.title}办理指南（演示）`, sourceId: `guide-${s.id}` }]
      : [],
    nextActions: s
      ? ["上传材料", "生成表单", "保存办理任务"]
      : ["补充具体事项"],
    extractedFields: {},
  };
}
export function parseTextDocument(text) {
  const fields = {};
  for (const label of new Set(serviceCatalog.flatMap((s) => s.fields))) {
    const match = text.match(
      new RegExp(`(?:^|[\\n;；])\\s*${label}\\s*[:：]\\s*([^\\n;；]+)`),
    );
    if (match) fields[label] = match[1].trim().slice(0, 500);
  }
  return fields;
}
export function validateForm(serviceId, fields) {
  const s = serviceCatalog.find((s) => s.id === serviceId);
  const errors = {};
  if (!s) return { valid: false, errors: { serviceId: "请选择有效事项" } };
  for (const key of s.fields)
    if (!String(fields[key] || "").trim()) errors[key] = "请补充此项";
  if (fields["联系电话"] && !/^1[3-9]\d{9}$/.test(fields["联系电话"]))
    errors["联系电话"] = "请填写有效的11位手机号";
  if (
    fields["结束日期"] &&
    fields["开始日期"] &&
    fields["结束日期"] < fields["开始日期"]
  )
    errors["结束日期"] = "结束日期不能早于开始日期";
  if (fields["绩点"] && !/^\d(?:\.\d{1,2})?$/.test(fields["绩点"]))
    errors["绩点"] = "请填写数字，最多两位小数";
  return { valid: Object.keys(errors).length === 0, errors };
}
