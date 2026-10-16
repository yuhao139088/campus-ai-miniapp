# CloudBase PostgreSQL与私有文件存储

用户确认使用SQL型数据库。本项目不要求开通文档型数据库。

目标环境：test1-d8gfuke7sfcd0a6d6；地域：ap-shanghai。SQL迁移目录：cloudbase/migrations/。

```powershell
npx --yes --package @cloudbase/cli tcb login
npx --yes --package @cloudbase/cli tcb env list
npx --yes --package @cloudbase/cli tcb db pg migration up -e test1-d8gfuke7sfcd0a6d6 --dry-run
npx --yes --package @cloudbase/cli tcb db pg migration up -e test1-d8gfuke7sfcd0a6d6
```

2026-10-16已在该环境应用首个迁移：users、service_items、campus_documents、conversations、agent_runs、ocr_records、form_drafts、tasks、reminders、audit_logs。十表RLS开启，anon/authenticated无直接表权限。所有个人业务通过带JWT的Node API校验归属。

服务端存储适配使用官方PostgREST端点/v1/rdb/rest/，API Key属于service_role，只注入后端`.env`。当前Node SDK不含PostgreSQL rdb入口，已移除未使用的旧文档数据库依赖。

设置`STORAGE_MODE=cloudbase-sql`、`CLOUDBASE_PG_API_KEY`后运行：

```powershell
node cloudbase/init.mjs
node cloudbase/verify.mjs
```

init仅补充缺失的演示服务/指南，不覆盖已修改的文档；verify写入并清理自己创建的测试记录。现有真实表不能通过盲目CREATE IF NOT EXISTS迁移，先检查实际列和migration历史。

私有pgstore桶campuspilot-materials已创建，public=false、最大8MB，允许PNG/JPEG/WebP；存储路径uploads/{userId}/{date}/{generatedId}。它与环境详情中的旧COS桶不是同一套存储。前端上传经Node校验，服务端用私有API Key调用PG存储接口；不公开材料URL。

身份桥接云函数源码在functions/campuspilot-session，当前未部署。小程序真实身份需要该AppID与环境关联，并配置云函数和后端共享WX_BRIDGE_SECRET；也可选择wx.login+WX_APP_SECRET的直接服务端身份适配。

官方CloudBase插件已安装；若本次会话尚无插件工具，重启Codex后加载。日常CLI使用具体资源命令，不使用通用tcb deploy。
