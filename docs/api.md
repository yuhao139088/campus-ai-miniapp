# 接口契约

除health和auth外，接口均要求`Authorization: Bearer <session token>`。错误形态：`{error:{code,message,fields?}}`。请求JSON最大1MB；图片8MB；AI操作客户端超时120秒，Agent总预算90秒。更新使用PUT，兼容wx.request。

| Method | 路径 | 主要输入/结果 |
|---|---|---|
| GET | /api/health | 非敏感服务、存储、模型配置状态 |
| POST | /api/auth/demo | 创建隔离的演示会话；只在DEMO_MODE开放 |
| POST | /api/auth/wechat | code；服务端jscode2session，不返回session_key |
| POST | /api/auth/cloudbase | 云函数签名票据；校验AppID和60秒时效 |
| GET | /api/services | 四类示例事项、材料和字段 |
| POST | /api/assistant/chat | message；生成结构化Agent计划 |
| POST | /api/agent/plan | message；同上，返回run id/mode/trace/citations |
| POST | /api/agent/execute | runId/action；允许查询任务、表单映射、字段校验 |
| POST | /api/knowledge/search | query；返回实际知识记录与关键词排序 |
| POST | /api/ocr/parse | multipart file；或JSON text；或显式sample:"true" |
| POST | /api/forms/generate | serviceId/runId/ocrId/fields；空白不猜测 |
| PUT | /api/forms/:id | fields/confirm；返回validation和confirmed |
| POST | /api/tasks | runId/formId?/dueAt?；表单关联需已确认 |
| GET | /api/tasks | 当前用户全部任务 |
| GET | /api/tasks/:id | 所有权校验后的任务 |
| PUT | /api/tasks/:id | stepIndex/status；重新计算进度 |
| GET | /api/reminders | 当前用户站内提醒 |
| POST | /api/reminders | taskId/dueAt；必须为本人任务、未来时间 |
| GET | /api/rights | 明确标记模拟权益，无真实支付 |

任务、OCR与表单ID由服务端生成。以其他用户身份访问某记录返回404。不得传入userId来冒充身份。材料字段、模型原始响应和任何密钥均不写入应用日志。记录中会保存用户主动提交的材料字段；真实运营需配套数据保留、导出/删除机制与隐私政策。
