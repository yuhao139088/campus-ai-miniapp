# 小程序 AI 开发模式生成记录

依据已安装 `wxa-skills-generate` 扫描7个页面、`config.ts`和`utils/api.ts`，生成独立的校园指南原子接口。它是微信平台AI开发模式扩展，不是产品Agent的运行前提。

源业务：`pages/service/service.ts`调用`GET /api/services`，消费`items`数组的id/title/category/description/materials/office；服务端`app.js`返回`items/knowledgeMode/tools`。生成只读`getServiceCatalog`，不导出个人任务、表单、材料或支付写操作。

鉴权事实：`utils/api.ts`中的`raw`使用`config.apiBase + path`、Content-Type application/json、Bearer session.token。`session`有demo、wx.login code交换、wx.cloud身份票据三条路径。独立技能内逐路径保留真实URL、method和响应取值，按生成技能要求将会话改为模块变量并发去重，冷启动重新登录，不依赖主包storage。CloudBase分支自行初始化，禁止getApp或跨主包import。

实际JSAPI：wx.request、wx.login、wx.cloud.init/callFunction，均已对照生成技能白名单。没有系统选择器、采集、支付或个人数据能力。仅注册原子接口，不生成原子组件。

运行`node tools/prepare-ai-mode.mjs`产生独立实验配置`.build/ai-miniapp`。普通`miniapp/app.json`保持普通小程序入口。平台要求基础库≥3.16.2及AppID的AI开发模式授权，当前尚未验证该授权；开发者工具CLI连接超时，因此不能宣称真机execute通过，也不生成最终DELIVERY.md。

已将生成产物交给`wxa-skills-validate`进行静态校验，运行结果和待完成事项见本地`AI交接/`。启用该扩展前需对齐两个公开config文件中的服务器域名及身份模式。
