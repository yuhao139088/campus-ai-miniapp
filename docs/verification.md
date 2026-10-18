# 验证状态

记录日期：2026-10-16。所有样本为虚构。

| 项目 | 状态 | 证据 |
|---|---|---|
| TypeScript | 通过 | miniapp与共享类型检查 |
| 服务端回归 | 通过 | server/test：场景、异常、授权、持久化、SQL适配 |
| 原生页面结构 | 通过 | tools/check-miniapp.mjs，7页+AppID+8张tab图标 |
| WXML / WXSS | 通过 | 本机微信官方wcc/wcsc执行退出0 |
| 原生首页启动 | 通过 | 官方automator读取home路径、4项真实服务、error为空；日志simulator launch success |
| 浏览器390px流程 | 通过 | Playwright实时AI→材料→确认→任务→提醒，无JS错误/横向溢出 |
| PostgreSQL | 通过 | CLI迁移Succeed，SQL行读写/清理，十表RLS |
| 云私有上传 | 通过 | pgstore桶public=false，真实样本上传 |
| 实时AI与视觉 | 通过 | tools/verify-live.mjs，live / vision / confirmed / 100% |
| Docker配置 | 通过 | docker compose config --quiet |
| Docker构建与启动 | GitHub CI通过 | 全新Linux环境Node服务build/up --wait与health；本机Desktop另有socket故障 |
| Nightly安装与登录 | 通过 | 官方2.02.2610142独立安装、腾讯签名有效，Stable保留；skill0.3.14版本相等、登录有效 |
| 原生AI页面交互 | 人工通过 | 用户在Nightly实际点击入口、进入助手并生成办理计划 |
| 原生表单输入框布局 | 人工复核通过 | input显式96rpx高度、移除上下padding；六字段截图完整，用户确认输入正常 |
| 局域网手机连接 | 人工通过 | 用户确认手机health可打开、扫码后小程序可访问服务 |
| 原生表单与任务闭环 | 人工通过 | 用户确认修改、保存、任务与提醒正常；本次反馈未区分完整操作在模拟器还是手机，不将其表述为自动化或全部真机断言 |
| 原生自动化桥接 | 工具异常 | 空白原生测试页同样复现DOM/执行超时；3.8.6及3.17.4均复现，内置MPPage.getCurrent报告页面元数据为空 |
| 真实微信身份 | 已配置待真机 | 服务器已配置AppSecret、`DEMO_MODE=false`，无效code返回401；需在微信后台配置合法域名后用真机`wx.login`验证 |
| 订阅消息 | 待接入 | 尚未配置订阅模板与用户授权 |
| 平台AI扩展 | 静态29条通过 | build/execute未通过，不视为最终验收 |
| Image-2.5资源 | 外部阻塞 | 官方CLI实际请求上游502，当前临时原创图 |

首次公开提交前，157个跟踪文件密钥扫描通过；服务端与演示台生产依赖经官方npm registry审计为0漏洞。GitHub Actions首次主分支运行38903549999全部通过，包含依赖安装、测试、类型、构建、密钥扫描与Docker启动。原始本地日志和交接资料保存在被忽略的AI交接文件夹，不公开包含临时票据或个人配置的日志。

运行文件生成修复e465f72已推送main/develop，对应CI38909006682和38909051457均全部通过。Nightly自动化异常不等于业务页面导航失败；页面人工验证与机器断言分别记录，未把后端测试当成原生全流程或真机验收。

输入框修复与独立LAN预览工具提交6917f42已推送main/develop，CI38915396293和38915403797全部通过。当前定位为可运行初版：学校知识库仍是四类自制演示指南，清单与表单结构主要依赖规则模板。尚未具备真实学校规则运营、校方受理审批、微信订阅推送和生产部署，不能据此宣称完整产品或竞赛最终交付完成。
