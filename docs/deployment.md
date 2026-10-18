# 本地、Docker与服务器部署

## 本地

Node.js22+。在仓库根目录执行`npm run setup`，复制`.env.example`为`.env`。

```powershell
npm run dev:server
# 另一个终端
npm run dev:miniapp
```

后端监听8787。默认离线+本地持久化可演示全流程，但图像OCR需配置实际视觉模型。设置`AI_MODE=live`、AI_BASE_URL、AI_API_KEY、AI_MODEL_MAX和AI_VISION_MODEL后启用实时模型。DEMO_MODE只控制演示身份，不会强制关闭AI。

微信开发者工具导入`miniapp/`，AppID已配置`wx71016248d99d9bd4`。当前小程序默认使用`https://cloud.yuhaocloud.cn/campuspilot-api`，服务器已通过现有Nginx HTTPS站点反代到Node服务；需要在小程序后台将`cloud.yuhaocloud.cn`加入request/uploadFile合法域名。普通小程序不需要平台AI开发模式扩展。

TypeScript由项目脚本显式编译：setup自动生成11个运行JS及sourceMap；开发期间运行`npm run dev:miniapp`监听TS修改。生成文件位于TS旁并由Git忽略，IDE直接加载JS，不再依赖其TypeScript插件。源码包需先setup/build；后续交付包会附带生成文件，便于直接导入。

2026-10-16修复缺失JS后，实际原生首页显示4项服务，官方工具日志显示simulator launch success。已按用户授权独立安装官方Nightly 2.02.2610142，保留Stable；用户人工确认助手可跳转并生成AI办理计划。完整材料、表单、任务和真机验收另见verification.md。

本机Nightly位于`E:/Program Files (x86)/Tencent/WeChatDevToolsNightly`，自带`wechatide.cmd`与`resources/app.asar.unpacked/wechatide-skill`。使用内置SKILL.md与命令help中的实际工具名称；0.3.14采用`wechatide -c Codex 工具名`。CLI服务端口重启后可能变化，不要固定使用此前59411或31688。

当前自动化在独立最小原生页面也复现超时，覆盖基础库3.8.6和3.17.4；内置MPPage.getCurrent报告页面元数据为空。停止反复修改业务代码，采用人工验证并保留工具异常证据。授权、登录和项目实际运行成功，与自动化全流程通过是不同状态。

## 同一Wi-Fi手机预览

先启动本地后端，再执行：

```powershell
npm run prepare:lan
# 多张无线网卡时，显式指定电脑当前Wi-Fi IPv4：
# npm run prepare:lan -- --host 192.168.1.20
```

脚本校验地址属于本机私网网卡、检查后端health，再生成独立的`.build/lan-miniapp-*`运行包。最新目录和API地址记录在`.build/lan-preview.json`。不读取服务端密钥，不改`miniapp/config.ts`的默认地址；预览目录不进入Git。每次修改源码后重新生成预览包和二维码。

手机和电脑连接同一Wi-Fi，先在手机浏览器打开`http://电脑Wi-Fi地址:8787/api/health`。能看到status为ok后，用微信扫描该预览包的二维码。开发阶段若出现合法域名或HTTP限制，在手机小程序菜单开启调试模式再进入；正式版本仍须使用HTTPS合法域名。

使用已授权的Nightly生成二维码：

```powershell
$lanPreview = Get-Content .build/lan-preview.json -Raw | ConvertFrom-Json
wechatide -c Codex create_preview_qrcode --project $lanPreview.project --qr-format window
```

后端监听`0.0.0.0:8787`。若手机浏览器无法访问health，检查网络是否隔离客户端以及本机入站设置；不需要关闭整个防火墙。此方式只供同一局域网开发验证，电脑切换网络或IP后需重新生成。

## SQL与文件存储

目标环境`test1-d8gfuke7sfcd0a6d6`、地域ap-shanghai、PostgreSQL。迁移与操作步骤见`cloudbase/README.md`。私钥仅注入后端`CLOUDBASE_PG_API_KEY`，设置`STORAGE_MODE=cloudbase-sql`。

## Docker

```powershell
docker compose config --quiet
docker compose up --build -d --wait
```

8787提供后端，仅绑定本机。命名卷campus-data保留本地模式的数据；SQL模式使用CloudBase。关闭：`docker compose down`，保留卷；不要使用-v删除数据。

GitHub Actions全新Linux环境已通过Node服务Docker构建、启动与health。当前Windows主机Docker Desktop另有sailor-ingest.sock系统访问错误；这不影响CI中已验证的容器结果。

## 服务器阶段

当前已部署IP为`101.35.250.178`、域名为`cloud.yuhaocloud.cn`的后端，API路径为`/campuspilot-api/`。后端使用独立systemd服务`campuspilot.service`和`/opt/campuspilot`目录，没有覆盖已有Nginx根站点。服务器已注入微信AppSecret并关闭演示身份，`/api/auth/wechat`使用`wx.login` code交换会话；小程序后台仍需由管理员完成`cloud.yuhaocloud.cn`合法域名配置，真实微信 code 才能在真机完成登录。

云函数campuspilot-session需在同一小程序关联环境部署。WX_APPID和WX_BRIDGE_SECRET由服务端与云函数共同配置，不放小程序代码。使用`tcb fn`对应命令，先查看当前CLI帮助；不使用通用`tcb deploy`。

本地开发创建的SQL服务Key有效7天，过期需刷新。CLI登录态与SQL服务Key是不同凭据，不能依赖tcb登录让生产Node服务自动取得权限。
