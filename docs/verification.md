# 验证状态

记录日期：2026-10-16。所有样本为虚构。

| 项目 | 状态 | 证据 |
|---|---|---|
| TypeScript | 通过 | miniapp与showcase检查 |
| 服务端回归 | 通过 | server/test：场景、异常、授权、持久化、SQL适配 |
| 原生页面结构 | 通过 | tools/check-miniapp.mjs，7页+AppID+8张tab图标 |
| WXML / WXSS | 通过 | 本机微信官方wcc/wcsc执行退出0 |
| React生产构建 | 通过 | Vite生产产物 |
| 浏览器390px流程 | 通过 | Playwright实时AI→材料→确认→任务→提醒，无JS错误/横向溢出 |
| PostgreSQL | 通过 | CLI迁移Succeed，SQL行读写/清理，十表RLS |
| 云私有上传 | 通过 | pgstore桶public=false，真实样本上传 |
| 实时AI与视觉 | 通过 | tools/verify-live.mjs，live / vision / confirmed / 100% |
| Docker配置 | 通过 | docker compose config --quiet |
| Docker本机启动 | 待完成 | Desktop系统socket访问失败，守护进程不可用 |
| 微信IDE整包/模拟器/真机 | 待完成 | CLI服务端口与IDE通信未建立 |
| 真实微信身份/订阅消息 | 待接入 | AppSecret或身份云函数、模板与授权待配置 |
| 平台AI扩展 | 静态29条通过 | build/execute未通过，不视为最终验收 |
| Image-2.5资源 | 外部阻塞 | 官方CLI实际请求上游502，当前临时原创图 |

密钥扫描、依赖审计和GitHub CI的最终结果随提交更新。原始本地日志和交接资料保存在被忽略的AI交接文件夹，不公开包含临时票据或个人配置的日志。
