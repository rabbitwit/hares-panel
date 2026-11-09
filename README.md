<div align=center>

<img src="./public/logo-mark.svg" width="100" height="100" />

# Hares-Panel

Hares-Panel 是一个面向 NAS、家庭服务器和云主机的导航首页。前端与 API 打包在同一个镜像中，只依赖一个持久化目录即可运行。 <br />

<a href="https://demo.hares.eu.cc" target="_blank">
  <img src="https://img.shields.io/badge/Demo-Click%20Here-blue?style=for-the-badge" alt="Demo">
</a>

</div>

## 功能

| 模块 | 说明 |
| --- | --- |
| 导航卡片 | 名称、描述、外网/内网地址、角标、图标与颜色、两种打开方式、访客隐藏 |
| 分组 | 增删改、上下移动、独立卡片样式、访客隐藏、默认收起/展开、空状态引导；卡片可跨分组拖拽 |
| 拖拽排序 | 基于 `@dnd-kit`，编辑模式拖动手柄，支持键盘操作与拖拽浮层 |
| 四种卡片样式 | `icon` 图标 / `card` 卡片 / `solid` 纯色 / `transparent` 透明悬浮，分组可覆盖；卡片与图标圆角可调 |
| 搜索 | 多搜索引擎、增删改与排序、默认引擎、占位符、新标签页开关；站内卡片快速直达 |
| 时钟与日期 | 12/24 小时制、秒数开关、日期显示、中文星期 |
| 壁纸与遮罩 | 内置渐变壁纸、必应每日壁纸、上传图片、网络图片、图库选择、模糊与遮罩、圆角与光效 |
| 内外网切换 | 自动识别 / 优先内网 / 优先外网；卡片可配置内网地址，右键强制指定 |
| 图标库 | 178 个离线内置图标、Iconify 在线搜索、图片 URL、上传、服务端图库、删除对象、图标颜色 |
| 自动图标 | 优先读取目标网站自身 favicon；失败时使用 [favicon-api](https://github.com/xinac721/favicon-api) |
| 服务端存储 | 导航数据保存到 Cloudflare KV / D1、Vercel Upstash Redis、EdgeOne Blob 或 Docker 本地文件；启动即从 API 读取 |
| 对象存储 | 图片与图标保存到 Cloudflare R2、Vercel Blob、EdgeOne Blob 或 Docker 本地 `assets/`，数据库只存 URL 与对象 key |
| 自托管 | Docker 一键部署，直连高位端口（默认 18000）；状态与图片持久化到 `./data` |
| 版本更新 | 「关于」页自动检查 Docker Hub 镜像与 GitHub 源码版本，发现新版本时显示提示和升级入口 |
| 管理员认证 | 密码来自环境变量 `ADMIN_PASSWORD`；HMAC 签名令牌，7 天滑动有效期（访问自动续期） |
| 个人资料 | 管理员可自定义头像与显示名称，支持图片 URL、本地上传或图库引用，显示在右上角账户菜单 |
| 备份恢复 | 导出/导入 JSON 快照，自动保存到服务端；支持自动识别 FlatNas / Sun-Panel 备份并导入分组与卡片；图库只保存图片地址 |
| 实例同步 | 在本机与另一台实例（Cloudflare Worker / Vercel / EdgeOne / Docker）之间同步导航数据与图片；由本机发起，自动比较更新时间，也支持强制上传/下载；内网实例可单向拉取公网实例，无需暴露公网 |
| 自定义 | 自定义 CSS、JS、页脚 HTML、Logo 上传或 URL |
| 系统状态 | 浏览器可读取的本机 CPU 核心数、设备内存、存储、网络、电池信息 |

## 技术栈

- **React 18 + TypeScript + Vite 5**
- **Tailwind CSS 3.4 + shadcn/ui（Radix UI）**
- **Zustand 5**（内存状态 + 登录令牌持久化）
- **React Router 7**（HashRouter）
- **@dnd-kit**、**sonner**、**zod**、**@iconify/react**
- **Cloudflare Workers**（KV / D1 / R2）、**Vercel Functions**（Upstash Redis REST + `@vercel/blob`）、**EdgeOne Makers Node Functions**（`@edgeone/pages-blob`）与 **Docker 自托管**（Node 24 + 本地文件），共享同一套 API 核心
- **Tauri 2**（工程保留；待接入可配置的服务端地址）

## 架构

```
浏览器 SPA ──/api/*──> Cloudflare Worker（KV/D1 + R2）
                        或 Vercel Function（Upstash + Blob）
                        或 EdgeOne Makers Node Function（Blob）
                        或 Docker 容器 / 飞牛原生应用（Node 文件存储）
```

- **服务端是唯一数据源**：启动时先请求 `/api/health`，再读取公开状态；管理员登录后读取完整状态。
- **登录**：登录页只接受 `ADMIN_PASSWORD`，成功后服务端签发 HMAC 令牌；令牌与 7 天会话分别保存在 `localStorage` 的 `hares-panel-cloud` 与 `hares-panel-session`。7 天内再次打开面板会自动续期：服务端重新签发令牌，有效期从当天重新计算；连续 7 天未使用才需要重新输入密码。
- **保存**：浏览器编辑内容后约 1.5 秒防抖，整份 `AppData` 覆盖写入服务端；图片上传成功后再写入图库元数据。界面只显示保存状态，失败时可重试。
- **公开访问**：`GET /api/state` 返回导航内容，管理凭据与管理员个人资料永不返回；关闭「公开访问」时只返回登录页配置与空内容。
- **初始化**：新部署没有数据时显示初始化页，管理员登录后写入内置示例数据，随后可自由修改。

<p align="center">
  <img src="docs/setup.png" width="32%" alt="站点初始化" />
  <img src="docs/cloud-login.png" width="32%" alt="管理员登录" />
  <img src="docs/cloud-mode.png" width="32%" alt="服务端与账号设置" />
</p>

```
src/
├── components/nav/          # 导航页、卡片、分组、搜索、设置、启动/初始化门禁
├── components/ui/           # shadcn/ui 基础组件
├── data/                    # 示例数据、内置壁纸、离线图标子集
├── hooks/                   # 时钟、媒体查询、云状态启动与自动保存
├── lib/                     # API 客户端、备份、网络、图标、图片压缩
├── store/                   # Zustand：app / cloud / session / ui / window
└── types/
server/                      # 与运行时无关的 API 核心 + Cloudflare / Vercel / EdgeOne / 文件存储适配
server/main.ts               # Docker / npm start 的 Node HTTP 入口（SPA + /api）
server/file.ts               # Docker 本地文件存储（状态、图片、会话密钥）
worker/index.ts              # Cloudflare Worker 入口
api/[...path].ts             # Vercel Functions 入口
cloud-functions/api/[[default]].js  # EdgeOne Makers Node Function（构建时生成）
edgeone.json                 # EdgeOne 构建、Node 版本与输出目录
Dockerfile                   # Node 24 多阶段镜像
docker/entrypoint.sh         # 首次密码与 Node 启动
docker-compose.yml           # 默认编排：只发布面板高位端口
fnos/                        # 飞牛 fnOS 原生应用包（不依赖 Docker）
tests/                       # API、Worker/Vercel/EdgeOne/Docker 运行时测试与本地模拟后端
src-tauri/                   # Tauri 2 桌面工程（待接入远程 API）
```

更详细的数据结构见下文「服务端数据」。

## 快速开始

要求 **Node.js 24（`24.x`）**，与 `package.json` 中的 `engines.node` 保持一致。

后端是必需的。开发时使用内存模拟服务端：

```bash
npm install

# 终端 1：模拟 API（内存存储 + 模拟 R2，端口 8787）
npm run dev:api

# 终端 2：Vite（/api 自动代理到 8787）
npm run dev
```

打开 `http://localhost:5173`：

1. 首次打开显示「站点尚未初始化」；
2. 点击「使用管理员密码登录」，输入模拟密码 **`cloud-pass-123`**；
3. 登录后自动把内置示例数据写入模拟服务端，然后进入导航页；
4. 之后的修改会自动保存到模拟服务端，刷新后仍在。

> 模拟服务只用于开发，数据保存在内存中，重启后清空。生产密码请使用环境变量 `ADMIN_PASSWORD`。

> 生产部署（Cloudflare Workers / Vercel / EdgeOne Makers）见下方「部署」章节；不能只部署 `dist/`。

### 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | Vite 开发服务器（`/api` 代理到 8787） |
| `npm run dev:api` | 内存模拟 API，供开发与本地预览使用 |
| `npm run build` | 类型检查 + 生产构建（自动使用项目内临时目录，避免 Windows 的 TEMP 权限问题） |
| `npm run build:docker` | 构建 SPA 与自托管 Node 服务端（`dist/` + `server-dist/index.mjs`） |
| `npm run start` | 本地运行自托管服务（先执行 `npm run build:docker`，默认端口 18000） |
| `npm run preview` | 预览生产构建（需要 8787 的 API，或部署后的同源 API） |
| `npm run mock:api` | 模拟 API + 静态 `dist/`，端口 4180 |
| `npm run test:api` | API 核心、Worker、Vercel、EdgeOne、Docker 运行时与备份导入测试 |
| `npm run docker:build` | 构建 Docker 镜像 `hares-panel:latest` |
| `npm run docker:up` | `docker compose up -d --build` 一键启动 |
| `npm run deploy:cf` | 构建并部署到 Cloudflare Workers |
| `npm run deploy:vercel` | 构建并用 Vercel CLI 部署 |
| `npm run tauri:dev` | Tauri 桌面窗口（需 Rust；远程 API 支持待后续） |


## 部署

Hares-Panel 由 **静态前端 + 同源 `/api`** 两部分组成，前端和 API 必须部署在同一个域下，**不能只托管 `dist/` 静态目录**。生产环境请选择下面方式之一：

| 平台 | 导航数据 | 图片 / 图标 | 适合场景 |
| --- | --- | --- | --- |
| **Cloudflare Workers** | D1（推荐）或 KV | R2 | 已有 Cloudflare 账号，想要低延迟和免费额度 |
| **Vercel** | Upstash Redis | Vercel Blob | 已在用 Vercel，希望从 Git 仓库自动部署 |
| **EdgeOne Makers（国际版）** | EdgeOne Blob | EdgeOne Blob | 使用腾讯国际站，希望 Node Functions + Blob 一体化 |
| **Docker 自托管** | 本地 `./data/state.json` | 本地 `./data/assets/` | 有 NAS / 云主机，想一条命令部署；公网可配合现有反代 |
| **飞牛 fnOS 原生应用** | 应用数据目录 `state.json` | 应用数据目录 `assets/` | 飞牛 NAS，安装 `.fpk` 即可，不依赖 Docker |

> 各平台的数据完全独立，不会自动同步。需要多端一致时，请用「管理控制台 → 实例同步」双向同步；
> 切换平台请先阅读「数据迁移与备份」。

### 完整部署文档

各平台的逐步部署流程、存储绑定配置、环境变量、初始化验证、故障排查与数据迁移，都集中在：

**→ [部署指南 docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

其中包含：

- [Cloudflare Workers](docs/DEPLOYMENT.md#cloudflare-workers)（D1 + R2，或只用 KV）
- [Vercel](docs/DEPLOYMENT.md#vercelupstash-redis--vercel-blob)（Upstash Redis + Vercel Blob；网页导入后必须先连存储再 Redeploy）
- [EdgeOne Makers](docs/DEPLOYMENT.md#edgeone-makers腾讯国际版)（Node Functions + Blob，国际版）
- [Docker 自托管](docs/DEPLOYMENT.md#docker-自托管)（NAS / 云主机）
- [飞牛 fnOS 原生应用](docs/DEPLOYMENT.md#方式-e飞牛-fnos-原生应用包fpk)（`.fpk`，不依赖 Docker）
- [部署后检查清单](docs/DEPLOYMENT.md#部署后检查清单)
- [数据迁移与备份](docs/DEPLOYMENT.md#数据迁移与备份) · [实例同步](docs/DEPLOYMENT.md#实例同步)
- [故障排查](docs/DEPLOYMENT.md#故障排查)

### 快速开始（Docker）

只想在本机或 NAS 上最快跑起来：

```bash
docker compose up -d --build
# 访问 http://<NAS 或本机 IP>:18000
```

首次启动如果没有设置 `ADMIN_PASSWORD`，会自动生成密码并打印在容器日志中（也保存在 `./data/admin-password`）：

```bash
docker compose logs hares-panel
```

### 通用环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 通常是（Docker 可留空） | 管理员登录密码；Docker 留空时首次启动自动生成并保存到 `./data/admin-password` |
| `SESSION_SECRET` | 否 | HMAC 令牌签名密钥；设置后修改密码不会让旧令牌自动失效，可单独轮换；Docker 留空时自动生成并保存到 `./data/session-secret` |

各平台的存储凭据（D1/R2 绑定、Upstash、Vercel Blob、EdgeOne Blob）以及更多 Docker 变量，见 [部署指南](docs/DEPLOYMENT.md)。


## 服务端数据

KV / D1 / Redis / EdgeOne Blob / Docker 本地文件中保存的是**一份完整 JSON 文档**，不是逐条记录：

```jsonc
// KV: hares-panel:state:default
// Upstash Redis: hares-panel:state:default
// EdgeOne Blob: state/default.json
// Docker: /data/state.json
{ "data": { "config": { ... }, "groups": [], "items": [], "searchEngines": [], "gallery": [] }, "updatedAt": 1792869195248 }

// D1: hares_panel_state(id='default', data TEXT, updated_at INTEGER)
```

- `config`：站点名/标题、Logo 引用、公开访问、主题与壁纸、卡片样式、搜索占位符、页脚 HTML、自定义 CSS/JS 等。
- `groups` / `items`：分组与卡片（地址、内外网、图标、角标、打开方式、隐藏、默认收起、排序）。
- `searchEngines`：搜索引擎与排序。
- `gallery`：图片 URL、对象 key、大小、创建时间；**不包含图片二进制**。

默认演示数据约 10 KB；Cloud 平台应用内上限 8 MB（Docker 默认 16 MB，可通过 `HARES_STATE_MAX_MB` 调整），但实际请求还受平台限制（Vercel 约 4.5 MB、EdgeOne 5 MB）。每次修改覆盖整份文档，`updatedAt` 由服务端生成。

图片上传后进入 R2 / Vercel Blob / EdgeOne Blob / Docker 本地 `data/assets/`：

```json
{
  "name": "logo",
  "category": "icon",
  "dataUrl": "/api/assets/asset-xxxx.webp",
  "remoteKey": "asset-xxxx.webp",
  "size": 5288
}
```

## API

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 否 | 存储类型、对象存储、密码是否已设置 |
| `GET` | `/api/update?current=0.1.1` | 否 | 对比 Docker Hub / GitHub 的最新版本，返回是否有更新（成功结果缓存约 12 小时） |
| `POST` | `/api/login` | 密码 | 校验 `ADMIN_PASSWORD`，返回 HMAC 令牌（按 IP 限流） |
| `POST` | `/api/session/refresh` | Bearer | 续期登录令牌，返回新的 7 天令牌与到期时间 |
| `POST` | `/api/sync` | Bearer | 由调用方发起与其他实例同步导航数据与图片；自动比较更新时间或强制上传/下载（本机只需能访问远端，无需公网可达） |
| `GET` | `/api/state` | 否 | 公开投影（不含访客隐藏的卡片/分组）；关闭公开访问时返回配置与空内容（`locked`） |
| `GET` | `/api/state?full=1` | Bearer | 完整数据，仅管理员 |
| `PUT` | `/api/state` | Bearer | 覆盖保存，Cloud 平台默认上限 8 MB（Docker 默认 16 MB） |
| `POST` | `/api/assets` | Bearer | `multipart/form-data` 上传图片 |
| `GET` | `/api/assets/:key` | 否 | Worker / R2 / EdgeOne / Docker 回源图片；Vercel Blob 由 CDN 提供 |
| `DELETE` | `/api/assets/:key` | Bearer | 删除 R2 / Vercel Blob / EdgeOne Blob / Docker 本地对象 |

## 安全说明

- 管理员密码只存在于部署平台环境变量或 Docker 数据目录，服务端不会通过 API 返回，也不会写入导航数据。Docker 在未设置 `ADMIN_PASSWORD` 时会自动生成密码并保存到 `./data/admin-password`，请限制数据目录权限。
- 登录令牌由 HMAC-SHA256 签名；未设置 `SESSION_SECRET` 时由 `ADMIN_PASSWORD` 派生，修改密码会让旧令牌立即失效。Docker 会自动生成独立的 `./data/session-secret` 并持久化。
- 登录令牌采用滑动有效期：7 天内再次打开或使用面板时自动续期；连续 7 天未使用、退出登录或修改 `ADMIN_PASSWORD` 后需要重新登录。
- 公开接口不会返回管理凭据或访客隐藏的卡片/分组；关闭「公开访问」后匿名请求只能拿到登录页配置。
- 令牌保存在 `localStorage`，自定义 JS 若被注入恶意代码可能读取令牌；请只使用自己编写的脚本。
- 部署平台仍然可以读取你保存的导航数据与图片；请不要存放密码、密钥等敏感信息。
- Docker 只提供高位端口的 HTTP（无 TLS），登录密码和数据会以明文经过网络；公网访问请用现有 Nginx / Caddy 等反向代理做 HTTPS，或通过 VPN / 内网访问。
- 登录限流为单实例内存计数，Cloudflare / Vercel / EdgeOne / 多副本部署下只能减缓暴力尝试；建议同时启用平台级 WAF / 访问策略。Docker 文件存储按单容器设计，请不要运行多个副本共享同一数据目录。

## 已知限制

- **Tauri 远程连接尚未完成**：Tauri 工程保留，但当前需要可配置的 API 地址后才能使用；Docker 部署可作为它的远程后端。
- **不支持离线/纯静态运行**：这是移除本地模式后的有意取舍；API 不可用时只显示部署提示。
- **备份文件不含图片二进制**：迁移到新部署时需要同步 R2 / Blob / Docker `data/assets`，或重新上传图片；FlatNas 的 `/icon-cache/...`、Sun-Panel 的 `/upload/...` 等本地图标也无法迁移。
- **面板不管理 Docker 容器**：Docker 只负责运行本站；Workers / Vercel / EdgeOne 函数同样无法访问宿主机 Docker。
- **Docker 文件存储按单容器设计**：不要用多个副本同时挂载同一个 `./data`；需要多副本时应改用支持共享存储的外部数据库/对象存储方案。
- **Vercel 请求体上限约 4.5 MB**：前端会先压缩图片；超大原图请改用 Cloudflare R2 或 Docker 自托管。
- **EdgeOne 请求体上限约 6 MB**：单张图片上限 5 MB；免费版 Blob 容量 1 GB，状态与图片共用。
- **平台数据默认不互通**：Cloudflare、Vercel、EdgeOne、Docker 的状态和图片存储互相独立，不会自动同步；需要保持数据一致时，请在「管理控制台 → 实例同步」手动发起双向同步。
- **KV 写入限制**：同一 key 约 1 次/秒且最终一致，频繁编辑建议使用 D1。
- **依赖安全公告**：`npm audit` 会报告 Vite / Wrangler 等构建工具与 Vercel Blob SDK 的传递依赖公告；前端静态产物不受影响。

## 升级与版本检查

管理控制台「关于」页会读取 Docker Hub 镜像标签、GitHub 主分支的 `package.json`（以及 jsDelivr 镜像）来判断是否有新版本。只要有任一来源返回比当前构建更高的版本，侧边栏「关于」和版本号旁就会显示「有新版本」，并提供升级说明入口。

- 检查只读取公开版本信息，不会上传导航数据、图片或凭据；成功结果缓存约 12 小时，失败结果保留 10 分钟，避免离线环境反复请求。
- 「关于」页的「检查更新」会跳过缓存立即刷新。
- 版本提示按已发布的语义化版本号比较；同一版本号重新构建镜像（例如只更新基础镜像）不会单独提示。
- 检查需要服务端能访问 `hub.docker.com`、`raw.githubusercontent.com` 或 `cdn.jsdelivr.net`；内网隔离环境可在「关于」页手动重试。
- Docker 升级：`docker compose pull && docker compose up -d`（升级不会删除 `./data`）。
- 飞牛应用：在应用中心升级 `.fpk`；Cloudflare / Vercel / EdgeOne：拉取新代码后重新部署。

## 常见问题

**页面显示「服务端尚未就绪」？** 检查 `/api/health` 是否返回 JSON 且 `ok: true`；确认已配置 KV/D1、Upstash Redis、EdgeOne Blob 或 Docker 的 `./data` 目录，并在对应平台设置了 `ADMIN_PASSWORD`（Docker 可留空自动生成）。Docker 还需确认宿主机 `18000` 已映射到容器 `18000`。

**Vercel 网页部署后仍显示「服务端尚未就绪」？** 环境变量配齐后，请用浏览器直接打开 `https://你的域名.vercel.app/api/health`：应是 JSON 而不是导航页。若仍是网页或 404，需要部署包含 `api/index.ts` 的最新代码。完整步骤见 [部署指南 · Vercel](docs/DEPLOYMENT.md#方式-a网页控制台部署推荐)。

**页面显示「站点尚未初始化」？** 服务端可用但没有数据。点击登录，输入 `ADMIN_PASSWORD`，登录后会把内置示例写入服务端。

**EdgeOne 显示「服务端尚未就绪」？** 先访问 `/api/health`：若 `storage`/`assets` 为 `null`，确认部署包含 `cloud-functions/api/[[default]].js`、`@edgeone/pages-blob` 已安装、`ADMIN_PASSWORD` 已配置；再查看 EdgeOne 函数日志中的 `EdgeOne Blob store is unavailable` 或鉴权错误。Blob 命名空间会在第一次成功访问后自动创建。

**EdgeOne 登录 / 保存返回 500？** 确认部署的是最新代码，并且 `cloud-functions/api/[[default]].js` 已重新生成；同时检查 EdgeOne 函数日志。Node Function 的请求体兼容处理、Blob 初始化错误都会记录在这里。

**EdgeOne 构建仍显示 Node 22.1？** `edgeone.json` 的 `nodeVersion` 和 `.nvmrc` 只影响新的构建。进入「项目设置 → Node.js 版本」选择 `24.18.0`，保存后新建部署；构建日志应出现 `[build] Node v24.18.0`。`/api/health` 里的 `platform` 是 Function 运行时版本，不是构建版本。如果下拉里没有 `24.18.0`，说明该区域控制台还没同步该镜像；`.nvmrc` 会尝试下载对应版本，仍失败时可先用 `22.21.1`（代码兼容），或联系 EdgeOne 支持。

**EdgeOne CLI 部署的 npm ci 报 ERESOLVE（vite 8 与 plugin-react 4 冲突）？** 本项目锁定 **Vite 5.4.21 + @vitejs/plugin-react 4.7.0**；不要单独把 Vite 升到 8。Vite 8 需要 plugin-react 5.2+，并且要求 Node `>=22.12`，与 EdgeOne 常见的 22.1 不匹配。恢复依赖：

```bash
npm install --save-dev vite@5.4.21 @vitejs/plugin-react@4.7.0
npm ci
```

**EdgeOne CLI 部署用的是本地 Node 还是云端 Node？** `edgeone makers deploy` 会在本机执行 `npm ci` / `npm run build`，使用**本地 Node 版本**；`edgeone.json` / `.nvmrc` 主要作用于 Git 云端构建。要看 CLI 实际版本，直接看部署日志或执行 `node -v`；云端构建版本看 EdgeOne 项目设置。

**修改没有保存？** 查看「管理控制台 → 服务端与账号」中的保存状态与上次保存时间；若令牌过期会提示重新登录。失败时点提示条上的「重试」。

**保存时提示无法连接服务端？** 前端会自动重试一次。若页面能打开但请求持续失败，通常是当前网络阻断了 `*.workers.dev` 或 EdgeOne 预览域名；请绑定自定义域名后访问，或改用 Vercel。也可以用手机热点验证是否为网络问题。EdgeOne 裸域名 401 属于预览域名访问控制，需要 Preview 链接。

**图片上传失败？** 需要配置 R2（Workers）、Vercel Blob 或 EdgeOne Blob，并确保当前登录状态有效。Vercel 还需注意约 4.5 MB 的请求体限制；EdgeOne 单张图片上限为 5 MB，超大 SVG / GIF 建议改用图片 URL 或 Cloudflare R2。

**自动取图标失败？** 会先尝试目标网站自己的 `/favicon.ico` / PNG / SVG，失败后使用 [xinac721/favicon-api](https://github.com/xinac721/favicon-api)接口；不再依赖 Google。如果目标站点没有图标、被防火墙拦截，或内网 HTTP 地址在 HTTPS 页面中无法直接读取，请手动选择图标、填写图标 URL 或上传图片。

**`npm run build` 在 Windows 上报 `esbuild ... Access is denied`？** 构建脚本 [scripts/build.mjs](scripts/build.mjs) 已把 `TEMP/TMP/TMPDIR` 指向项目内的 `.build-tmp`，正常使用 `npm run build` 即可。不要直接运行 `vite build`；如果仍然失败，请检查杀毒软件或项目目录写权限。

**`wrangler deploy` 报找不到 D1 / R2？** 需要先把 `wrangler.jsonc` 中的 `<D1_DATABASE_ID>` 换成真实 ID，并创建对应的 R2 bucket；详见「部署」章节。`wrangler deploy --dry-run` 不会校验资源 ID。

**容器日志里的自动生成密码登不上？** 自动密码是 32 位 base64url 字符串，服务端不会 trim，多一个空格、少一个字符都会返回 401。旧版入口脚本生成的密码可能以 `-` 开头，日志里那一行还带前导空格，复制时最容易漏掉 `-`。取准确值：

```bash
docker exec <容器名> cat /data/admin-password
```

也可以直接设置 `ADMIN_PASSWORD` 环境变量覆盖它（设置后以环境变量为准）。新版镜像生成的首尾字符一定是字母或数字，并且密码单独一行输出，不再带前导空格。

**忘记密码？** 修改部署平台的 `ADMIN_PASSWORD`：Cloudflare 使用 `wrangler secret put`，Vercel 在 Environment Variables 中修改，EdgeOne 在项目环境变量中修改；保存后重新部署 / 刷新即可，无需在页面中重置。Docker 可以修改 `.env` 后执行 `docker compose up -d`；如果是首次启动自动生成的密码，直接查看 `./data/admin-password` 或 `docker compose logs hares-panel`。彻底重置：删除 `/data/admin-password` 后重启容器，会重新生成并打印新密码。

**Docker 通过外部反代访问异常？** 确认反向代理目标指向 `http://<NAS IP>:18000`，并转发 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`。HTTPS 证书由外部 Nginx / Caddy 负责，容器内不申请证书；可查看对应反向代理的日志排查。

**飞牛 / 群晖的 Docker 向导里端口显示多少？** 新版镜像 `EXPOSE 18000` 且容器内监听 18000，所以选镜像创建容器、或导入仓库里的 `docker-compose.yml`，都会显示 `18000:18000`。如果显示 `3000:3000`，说明用的还是旧镜像（旧版 `EXPOSE 3000`），重新构建镜像即可。

**FlatNas / Sun-Panel 导入后图标空白？** 这两个面板的备份只保存本地上传图标的路径（例如 FlatNas 的 `/icon-cache/...`、Sun-Panel 的 `/upload/...`），不包含图片本体，因此无法直接迁移；导入时这些图标会留空并给出提示，重新选择图标或填写图片 URL 即可。FlatNas 的嵌套 bookmark 分类会展开为 `父分类 / 子分类` 分组。

## 致谢

- [Sun-Panel](https://github.com/hslr-s/sun-panel)：交互与视觉参考
- [favicon-api](https://github.com/xinac721/favicon-api)：图标 API
- [shadcn/ui](https://ui.shadcn.com/) 与 [Radix UI](https://www.radix-ui.com/)
- [Iconify](https://iconify.design/) 及 `logos` / `simple-icons`
- [Tailwind CSS](https://tailwindcss.com/)、[Vite](https://vite.dev/)、[Cloudflare Workers](https://workers.cloudflare.com/)、[Vercel](https://vercel.com/)、[Tencent EdgeOne](https://pages.edgeone.ai/)、[Tauri](https://tauri.app/)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=rabbitwit/hares-panel&type=Date)](https://www.star-history.com/#rabbitwit/hares-panel&Date)

## 许可

本项目采用 [PolyForm Noncommercial License 1.0.0](LICENSE)。

允许个人学习、自用、研究、教育以及非营利组织使用；**禁止任何商业用途**（包括但不限于售卖、收费托管、作为商业产品或服务的一部分提供）。完整条款见 [LICENSE](LICENSE)。
