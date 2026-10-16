# CampusPilot work instructions

- If `AI交接/` exists locally, read `AI交接/项目基础信息探索交接.md` before changes. Continue timestamped handoff logs there, including actions, failures, fixes, test evidence and remaining work. These private notes are excluded from Git.
- User selected CloudBase **PostgreSQL**, not the document database. Use migrations and server-only service keys; do not provision or bill new cloud resources without authorization.
- Keep all real model and cloud credentials in ignored local environment files. Run `node tools/scan-secrets.mjs` before publishing commits.
- Describe actual AI modes and external capability states accurately. Do not replace failed OCR with fabricated personal data. Do not represent self-reported task status as school approval.
- Baseline checks: `npm test`, `npm run typecheck`, `npm run check:miniapp`, `npm run build`.
- `tools/verify-live.mjs` calls real configured models, uploads a synthetic fixture, and writes synthetic cloud test data. Use deliberately.
- Server deployment and miniapp upload/publishing remain separate follow-up stages after server details and platform prerequisites are ready.
