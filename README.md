# CampusPilot · 校园智办

面向传智杯「AI微信小程序开发挑战赛」的校园事务Agent项目。将问答、事项识别、知识检索、材料OCR、可编辑表单、任务与站内提醒串成一条办理流程。

原生微信小程序 + TypeScript · 独立Node.js后端 · CloudBase PostgreSQL + 私有pgstore · Docker。


## 当前可运行能力

- 四类演示服务：奖助学金、请假与销假、宿舍报修、活动报名。
- 实时Qwen兼容模型识别与规划，结构化输出、实际工具记录、知识引用；明确区分实时AI/离线/错误降级。
- 真实图片OCR、文字字段提取与虚构样本入口；空白信息不猜测。
- 生成可修改草稿、字段校验和人工确认，再建立本人办理任务。
- 节点完成追踪、持久化进度与站内提醒。
- 演示身份、微信登录与CloudBase原生身份的可替换适配层。
- PostgreSQL十表与私有材料存储；公共前端不持有云服务密钥。

代码可本地运行，仍有外部验收待完成：微信IDE整包/真机、真实微信身份、订阅推送和服务器部署。Image-2.5素材生成遇上游502，当前使用有来源记录的原创临时资源。详情见docs/verification.md。

## 启动

要求Node.js22+。

```powershell
npm run setup
Copy-Item .env.example .env
npm run dev:server
# 另一个终端
npm run dev:miniapp
```

后端监听8787。默认`.env.example`采用离线AI与本地JSON持久化，首次访问自动创建隔离的演示会话，没有共享用户名密码。

启用模型：在本地`.env`设置`AI_MODE=live`、AI_BASE_URL、AI_API_KEY、AI_MODEL_MAX、AI_VISION_MODEL。所有模型ID可替换；只有配置且实际调用成功才显示实时AI。模型与图片生成密钥分离。

微信开发者工具导入`miniapp/`。AppID：`wx71016248d99d9bd4`。当前服务地址为`https://cloud.yuhaocloud.cn/campuspilot-api`，身份模式和接口地址在`miniapp/config.ts`；小程序后台需要配置`cloud.yuhaocloud.cn`为合法域名。

同一Wi-Fi开发验证可运行`npm run prepare:lan`，生成独立的局域网预览包，保持源码默认地址不变。手机先验证health，再扫描预览二维码并开启开发调试；步骤见[部署文档](docs/deployment.md)。正式版本使用HTTPS合法域名。

`npm run setup`会用项目自带TypeScript编译器生成小程序运行JS。修改TS源码时另开终端运行`npm run dev:miniapp`自动同步，或执行`npm --prefix miniapp run build`后点击微信工具“编译”。生成JS/map不进入Git，TS是编辑源；不依赖IDE是否正确加载TypeScript编译插件。若提示找不到home.js，先运行上述build。

SQL：设置`STORAGE_MODE=cloudbase-sql`和`CLOUDBASE_PG_API_KEY`，环境为`test1-d8gfuke7sfcd0a6d6`。建表迁移与种子见cloudbase/README.md。本地开发密钥不提交Git。

```powershell
docker compose up --build -d --wait
# 后端位于 http://127.0.0.1:8787
```

## 检查

```powershell
npm test
npm run typecheck
npm run check:miniapp
npm run build
node cloudbase/verify.mjs
# 需要实际AI/视觉配置，会调用模型并创建虚构测试数据
node tools/verify-live.mjs
```

## 目录

| 目录 | 用途 |
|---|---|
| miniapp/ | 原生TS小程序、七页与自定义tabBar |
| server/ | 身份、Agent、视觉识别、表单、任务、提醒 |
| cloudbase/ | PostgreSQL迁移、初始化、验证、身份云函数源码 |
| packages/shared/ | 共享接口类型 |
| assets/ | 原创资源、提示词与生成来源清单 |
| tools/ | 校验、素材处理、可选AI模式构建与技能恢复 |
| docs/ | 架构、部署、验证记录与七类竞赛材料 |
| .agents/skills/ | 本地开发技能，公共仓库保留版本和恢复说明 |

## 竞赛材料与三人协作

七类材料位于docs/submission/：项目说明、微信与AI能力、创新点、技术实现、成果与测试、历史说明、落地运营规划。评审映射见docs/competition-mapping.md。文档区分已实现、已验证和待完成，不把模拟支付或站内提醒当作已开通微信能力。

团队：高超、潘庆涛、郑宇豪。建议分工：高超负责场景调研与验收；潘庆涛负责材料、体验测试与演示；郑宇豪负责技术统筹、账号与部署。全部开发代码由AI协助实现，成员需理解系统并完成参赛答辩。具体职责可在团队确认后调整。

分支：main稳定交付，develop日常集成，feature/*独立变更。协作者需提供GitHub账号后再邀请。

## 边界与许可

学校知识与材料为自制演示内容，不包含真实学校审批接入或真实收费。正式运营须完成运营主体、隐私政策、内容安全和学校授权等实际接入事项。

根许可证Apache-2.0。不对第三方技能重新授权。
