# 本地、Docker与服务器部署

## 本地

Node.js22+。在仓库根目录执行`npm run setup`，复制`.env.example`为`.env`。

```powershell
npm run dev:server
# 另一个终端
npm run dev:showcase
```

打开本机5173端口。默认离线+本地持久化可演示全流程，但图像OCR需配置实际视觉模型。设置`AI_MODE=live`、AI_BASE_URL、AI_API_KEY、AI_MODEL_MAX和AI_VISION_MODEL后启用实时模型。DEMO_MODE只控制演示身份，不会强制关闭AI。

微信开发者工具导入`miniapp/`，AppID已配置`wx71016248d99d9bd4`。`miniapp/config.ts`默认本机127.0.0.1地址、演示身份；真机无法访问电脑的127.0.0.1，部署后替换为自己的HTTPS服务域名，在小程序后台配置request/uploadFile合法域名。普通小程序不需要平台AI开发模式扩展。

TypeScript由项目脚本显式编译：setup自动生成11个运行JS及sourceMap；开发期间运行`npm run dev:miniapp`监听TS修改。生成文件位于TS旁并由Git忽略，IDE直接加载JS，不再依赖其TypeScript插件。源码包需先setup/build；后续交付包会附带生成文件，便于直接导入。

2026-10-16修复缺失JS后，实际原生首页显示4项服务，官方工具日志显示simulator launch success。已按用户授权独立安装官方Nightly 2.02.2610142，保留Stable；用户人工确认助手可跳转并生成AI办理计划。完整材料、表单、任务和真机验收另见verification.md。

本机Nightly位于`E:/Program Files (x86)/Tencent/WeChatDevToolsNightly`，自带`wechatide.cmd`与`resources/app.asar.unpacked/wechatide-skill`。使用内置SKILL.md与命令help中的实际工具名称；0.3.14采用`wechatide -c Codex 工具名`。CLI服务端口重启后可能变化，不要固定使用此前59411或31688。

当前自动化在独立最小原生页面也复现超时，覆盖基础库3.8.6和3.17.4；内置MPPage.getCurrent报告页面元数据为空。停止反复修改业务代码，采用人工验证并保留工具异常证据。授权、登录和项目实际运行成功，与自动化全流程通过是不同状态。

## SQL与文件存储

目标环境`test1-d8gfuke7sfcd0a6d6`、地域ap-shanghai、PostgreSQL。迁移与操作步骤见`cloudbase/README.md`。私钥仅注入后端`CLOUDBASE_PG_API_KEY`，设置`STORAGE_MODE=cloudbase-sql`。

## Docker

```powershell
docker compose config --quiet
docker compose up --build -d --wait
```

8080提供演示台及同源API代理，8787为后端，仅绑定本机。命名卷campus-data保留本地模式的数据；SQL模式使用CloudBase。关闭：`docker compose down`，保留卷；不要使用-v删除数据。

GitHub Actions全新Linux环境已通过双服务Docker构建、启动与代理health/网页访问。当前Windows主机Docker Desktop另有sailor-ingest.sock系统访问错误；这不影响CI中已验证的容器结果。

## 服务器阶段

用户提供IP/域名之后再部署。本轮未向服务器部署、未上传或发布小程序，也未部署云函数。上线前注入自己的长期服务凭据、持久化卷、HTTPS反代与合法域名，关闭演示身份，设置NODE_ENV=production与随机SESSION_SECRET；真实身份使用wx.login+AppSecret或CloudBase身份桥接。

云函数campuspilot-session需在同一小程序关联环境部署。WX_APPID和WX_BRIDGE_SECRET由服务端与云函数共同配置，不放小程序代码。使用`tcb fn`对应命令，先查看当前CLI帮助；不使用通用`tcb deploy`。

本地开发创建的SQL服务Key有效7天，过期需刷新。CLI登录态与SQL服务Key是不同凭据，不能依赖tcb登录让生产Node服务自动取得权限。
