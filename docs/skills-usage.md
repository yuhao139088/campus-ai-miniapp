# 技能使用与验证状态

| 技能 | 实际应用 | 结果/限制 |
|---|---|---|
| find-skills | 本地设计技能筛选、SkillHub搜索与安装 | 五个指定包和wxa validator已安装，版本见项目锁文件 |
| miniprogram-development | 原生页面结构、微信开发者工具、局域网预览、WXML/WXSS检查 | 9页原生编译与人工真机流程 |
| frontend-design | 校园建筑场景、四阶段轨道、颜色与字体层级 | docs/visual-system.md |
| Responsive Design / ui-design | 移动布局、触控、焦点样式、减少动态、对话框键盘操作 | 浏览器无横向溢出，完整闭环通过 |
| miniprogram-development | 原生TS七页、真实AppID、原生云身份适配、自定义tabBar | TS/页面结构/WXML/WXSS官方编译器通过；IDE整包及真机待验 |
| miniapp-precision-control-evo | 页面配置读回、路由与资源检查、错误归因和验证闭环 | 采用规范中可验证部分，不把社区描述当官方API事实 |
| wechat-tabbar-icons | 中性透明源图经该技能脚本统一生成四组81px双态PNG | 已写入app.json和自定义tabBar |
| miniapp-single-canvas-ui-group-generator-showapi | 模拟API体验；锁定全局样式、坐标布局与项目提示词 | 无AppKey模拟只返回美食示例；真实定制组图尚未调用 |
| imagegen | 官方CLI+用户指定gpt-image-2.5兼容API实际请求 | 新SDK隔离环境已修复；上游连续502，未生成成功，当前自制素材明确标注临时 |
| remove-ai-marks | 安装指定水印仓库技能，本机HTTP inspect→clean处理自制素材 | 仅容器元数据，不声明可去除所有像素/统计水印；保留提示词和来源 |
| miniprogram-virtualpay-person | 依据个人虚拟支付接入条件、签名和回调边界设计隔离模块 | 仅模拟权益接口/入口，不接真实支付、订单或收费 |
| wxa-skills-generate | 提取真实鉴权与服务API，生成独立campus-guide原子接口与实验配置 | 普通版不依赖平台AI权限 |
| wxa-skills-validate | 实验配置执行官方校验脚本 | 29条静态规则通过；IDE编译/真机execute尚未通过，不能宣称扩展已验收 |

恢复水印工具时，下载guillaumemeyer/watermarks-remover固定提交`c5297e9e69fec0779c29127c7892427e673fafd9`并审查，仅运行其service HTTP服务；不要执行与资产处理无关的目录。图像资源处理脚本位于tools/watermarks-remover/。

社区技能保留各自许可证，根Apache-2.0仅适用于本项目原创代码。技能不是项目运行时依赖，公共仓库通过锁文件与安装脚本记录来源，避免重新分发未知授权的第三方文档。
