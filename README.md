# 夜间外卖配送与平台协作体验调查

《味知街》游戏前期研究问卷。匿名、自愿参与，约 15–25 分钟。

## 访问与部署

- 问卷：https://survey.roxy-design.com
- 管理入口：https://survey.roxy-design.com/#admin
- GitHub Pages 原站：https://sliuhaob.github.io/rider-survey/
- 独立接口：https://survey-api.roxy-design.com/api/health

前端由 GitHub Pages 托管。Cloudflare Worker 的自定义域名入口转发静态页面，并通过 D1 保存答卷、处理受密钥保护的 CSV 导出。Cloudflare 自动管理域名 DNS 和证书；与 CS2 网站直接 CNAME 到 GitHub 的入口方式略有不同。不会修改 CS2 的代码、数据或解析。

## 开发

Node.js 24+。运行 `npm ci` 安装依赖，`npm run build` 构建前端。
使用 `npx wrangler d1 migrations apply roxy-rider-survey --local` 初始化本地数据库；在被忽略的 `.dev.vars` 中设置 `SURVEY_ADMIN_KEY`。
分别运行 `npm run worker:dev` 和 `npm run dev` 进行本地调试。

推送 main 后 GitHub Actions 自动发布页面。后端修改需运行 `npm run worker:deploy`。数据库迁移运行 `npm run db:migrate`。管理密钥通过 `wrangler secret put SURVEY_ADMIN_KEY` 配置，不写入源码或前端。

生产答卷仅保存在 D1，不在仓库中。CSV 导出需要管理密钥，不公开提供答卷读取接口。已有相同提交编号不会重复写入。

## 维护

题目和分支集中在 `src/questions.ts`；界面为 `src/Survey.tsx` 和 `src/Admin.tsx`；接口与域名入口为 `worker/index.ts`。部署配置为 `wrangler.jsonc`。问卷版本为 1，保留 Q0–Q31 编号及子项。
