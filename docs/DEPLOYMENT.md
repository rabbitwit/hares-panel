# 部署指南

> 返回 [README](../README.md) · 版本记录见 [CHANGELOG](../CHANGELOG.md)

Hares-Panel 由 **静态前端 + 同源 `/api`** 两部分组成，前端和 API 必须部署在同一个域下，**不能只托管 `dist/` 静态目录**。生产环境请选择下面方式之一：

| 平台 | 导航数据 | 图片 / 图标 | 适合场景 |
| --- | --- | --- | --- |
| **Cloudflare Workers** | D1（推荐）或 KV | R2 | 已有 Cloudflare 账号，想要低延迟和免费额度 |
| **Vercel** | Upstash Redis | Vercel Blob | 已在用 Vercel，希望从 Git 仓库自动部署 |
| **EdgeOne Makers（国际版）** | EdgeOne Blob | EdgeOne Blob | 使用腾讯国际站，希望 Node Functions + Blob 一体化 |
| **Docker 自托管** | 本地 `./data/state.json` | 本地 `./data/assets/` | 有 NAS / 云主机，想一条命令部署 |
| **飞牛 fnOS 原生应用** | 应用数据目录 `state.json` | 应用数据目录 `assets/` | 飞牛 NAS，安装 `.fpk`，不依赖 Docker |

> 各平台的数据完全独立，不会自动同步。需要保持多端一致时，请阅读文末的「实例同步」。

本地开发（模拟 API）见 [README 快速开始](../README.md#快速开始)。

---

## 目录

- [部署前准备](#部署前准备)
- [通用环境变量](#通用环境变量)
- [Cloudflare Workers](#cloudflare-workers)
- [Vercel](#vercelupstash-redis--vercel-blob)（[网页控制台](#方式-a网页控制台部署推荐) / [CLI](#方式-bcli-部署)）
- [EdgeOne Makers](#edgeone-makers腾讯国际版)
- [Docker 自托管](#docker-自托管)
- [飞牛 fnOS 原生应用包](#方式-e飞牛-fnos-原生应用包fpk)
- [部署后检查清单](#部署后检查清单)
- [数据迁移与备份](#数据迁移与备份)
- [实例同步](#实例同步)
- [从其他面板导入](#从其他面板导入)
- [故障排查](#故障排查)

---

## 部署前准备

1. 安装 **Node.js 24（`24.x`）** 和 npm；
2. 在本地执行一次完整构建，确认没有类型或构建错误：

   ```bash
   npm install
   npm run build
   ```

3. 准备管理员密码 `ADMIN_PASSWORD`。它只放在部署平台的环境变量中；
4. 建议准备一个自定义域名。`*.workers.dev`、`*.edgeone.cool` 等平台默认域名在部分网络下可能被阻断或需要额外访问凭据；
5. 新部署没有数据时，首页会显示「站点尚未初始化」。管理员登录后会把**内置示例数据**写入服务端，之后在页面中编辑即可。

## 通用环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 通常是（Docker 可留空） | 管理员登录密码；Docker 留空时首次启动自动生成并保存到 `./data/admin-password` |
| `SESSION_SECRET` | 否 | HMAC 令牌签名密钥；设置后修改密码不会让旧令牌自动失效，可单独轮换；Docker 留空时自动生成并保存到 `./data/session-secret` |

各平台的存储凭据（D1/R2 绑定、Upstash、Vercel Blob、EdgeOne Blob）在对应章节单独配置。

---

## Cloudflare Workers

部署结构：

```text
浏览器
  ├── 静态 SPA ──> Worker ASSETS（dist/）
  └── /api/*   ──> Worker ──> D1 或 KV（导航数据）
                         └──> R2（图片）
```

**推荐组合：D1 + R2。** D1 适合频繁保存，R2 用来存图片；KV 也可以，但存在最终一致和单 key 写入频率限制。

### 1. 登录 Cloudflare

```bash
npx wrangler login
npx wrangler whoami
```

`whoami` 能显示账号信息后继续。

### 2. 创建 D1 数据库（推荐）

```bash
npx wrangler d1 create hares-panel
```

命令会输出 `database_id`，下一步填进 `wrangler.jsonc`。

如果不想用 D1，可以跳过，改用文末的 KV 方案。

### 3. 创建 R2 存储桶

```bash
npx wrangler r2 bucket create hares-panel-assets
```

R2 桶**不需要开启公共访问**：图片会通过 Worker 的 `/api/assets/:key` 读取。没有 R2 时导航文字仍可使用，但图片上传功能不可用。

### 4. 配置 `wrangler.jsonc`

项目已经写好了 Worker 入口、`ASSETS` 静态资源绑定和示例绑定。**仓库里的 D1 ID / R2 名称只是当前示例，部署到你自己的 Cloudflare 账号前必须全部替换成你自己的资源**，避免误部署到别人的账号资源。

```jsonc
{
  "name": "hares-panel",
  "main": "worker/index.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "hares_panel",
      "database_name": "hares-panel",
      "database_id": "<你的 D1 database_id>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "hares_panel_assets",
      "bucket_name": "hares-panel-assets"
    }
  ]
}
```

说明：

- 也可以不用 CLI 创建：在 Cloudflare Dashboard 的 **Storage & Databases** 中创建 D1 / R2，再到 Worker → Settings → Bindings 添加同名绑定；效果与写 `wrangler.jsonc` 相同；
- `binding` 名称不要随意改；
- D1 表 `hares_panel_state` 不需要手动建表，首次读写时会自动创建；
- 如果同时绑定 D1 和 KV，会优先使用 D1；
- 如果使用其他数据库名或桶名，只需同步修改这里的 `database_name` / `bucket_name`。

### 5. 设置管理员密钥

如果 Worker 还不存在，先执行下一步部署一次，再回来设置；也可以在 Cloudflare Dashboard → Worker → Settings → Variables and Secrets 中添加。

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET   # 可选
```

`secret put` 会交互式读取值，不要把密码写在命令行参数里，也不要提交 `.dev.vars`。如果设置后 `/api/health` 的 `auth` 仍为 `false`，重新执行一次 `npx wrangler deploy`。

### 6. 构建并部署

```bash
npm run deploy:cf
```

这个脚本会先执行 `npm run build`（含类型检查和 Vite 构建），再执行 `wrangler deploy`。也可以分开执行：

```bash
npm run build
npx wrangler deploy
```

部署成功后记录 Worker 地址，例如 `https://hares-panel.<你的子域>.workers.dev`。

### 7. 初始化与验证

1. 打开 Worker 地址；
2. 如果显示「站点尚未初始化」，点击「使用管理员密码登录」；
3. 输入刚设置的 `ADMIN_PASSWORD`，登录后写入内置示例数据；
4. 访问 `/api/health`，正常结果应类似：

   ```json
   {
     "ok": true,
     "runtime": "cloudflare-workers",
     "storage": "d1",
     "assets": "r2",
     "auth": true
   }
   ```

如果 `storage` 为 `null`，检查 D1/KV 绑定；如果 `assets` 为 `null`，检查 R2 绑定；如果 `auth` 为 `false`，检查 `ADMIN_PASSWORD` secret 是否已生效。

### 8. 自定义域名、日志与更新

- **自定义域名**：Cloudflare Dashboard → Workers & Pages → 你的 Worker → Settings → Domains & Routes → Add custom domain，按提示添加 DNS 记录。绑定后使用自定义域名访问，可避开部分网络对 `workers.dev` 的阻断。
- **日志**：另开终端执行 `npx wrangler tail`，可实时查看 Worker 请求和错误。
- **更新代码**：修改后重新执行 `npm run deploy:cf`。D1/R2 中的数据不会被覆盖。
- **回滚**：在 Cloudflare Dashboard 的 Worker 部署历史中选择旧版本回滚。

### 9. 本地 Worker 调试

在项目根目录创建 `.dev.vars`（已加入 `.gitignore`）：

```dotenv
ADMIN_PASSWORD=local-password
SESSION_SECRET=local-secret
```

然后启动 Worker 本地开发：

```bash
npx wrangler dev
```

本地 D1/R2 绑定会使用 Wrangler 的本地模拟存储；生产数据不会受影响。

### 10. 只用 KV 的替代方案（可选）

如果不使用 D1：

```bash
npx wrangler kv namespace create hares_panel_kv
```

把输出中的 `id` 填入 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  { "binding": "hares_panel_kv", "id": "<KV_NAMESPACE_ID>" }
]
```

然后照常设置 secret、构建和部署。KV 的导航状态保存在 `hares-panel:state:default`，适合访问量不大、修改不频繁的站点；频繁保存建议 D1。

---

## Vercel（Upstash Redis + Vercel Blob）

部署结构：

```text
Vercel CDN ──> dist/ 静态前端
     └─ /api/* ──> api/[...path].ts（Node Function）
                       ├─> Upstash Redis（导航数据）
                       └─> Vercel Blob（图片）
```

网页导入 Git 仓库时，Vercel **会立刻开始第一次构建**。这次部署几乎必然还没有 Redis / Blob，打开网站会显示「服务端尚未就绪」。这不是构建失败，按下面 **步骤 1 → 6** 补齐存储后再 **Redeploy** 即可。

控制台按钮以英文为准（界面语言也可能是中文，对一下表里的名称即可）。

### 网页部署为什么经常不成功

| 你看到的现象 | 真正原因 | 怎么处理 |
| --- | --- | --- |
| 构建是绿色 Ready，页面却写「服务端尚未就绪」 | 第一次部署时还没连接 Redis / Blob，或连完后没有 Redeploy | 按步骤 3–6 做完，再看 `/api/health` |
| `/api/health` 里 `"storage": null` | 没连上 Upstash Redis，或只勾了 Development / Preview | 补 REST 变量，勾选 **Production**，Redeploy |
| `/api/health` 里 `"assets": null` | 没连上 Blob | 创建 Blob 并连接到当前项目，Redeploy |
| `/api/health` 里 `"auth": false` | 没设 `ADMIN_PASSWORD`，或没勾 Production | 补变量后 Redeploy |
| 构建 Error，日志里是 `next build` | Framework Preset 被改成了 Next.js | 改回 **Vite**，不要 Override 构建命令 |
| 构建 Error / 导入不到仓库 | 仓库在 Gitee，或只上传了 `dist/` | 必须用 GitHub / GitLab / Bitbucket 上的**完整源码** |
| 登录 401 | 密码和变量值不一致，或看的是 Preview 域名 | 用 Production 域名，密码不要多空格 |

> 核心规则：**环境变量（含 Redis / Blob 自动写入的变量）只对之后创建的部署生效。** 先 Deploy、后连存储，一定要再 Redeploy 一次。

### 方式 A：网页控制台部署（推荐）

#### 0. 开始前确认

1. 源码已推到 **GitHub / GitLab / Bitbucket**。Vercel 网页**不能**导入 Gitee / 码云，也不能只上传 `dist/`。
2. 仓库根目录能看到 `package.json`、`vercel.json`、`api/`、`server/`、`src/`。缺任何一个都不是完整项目。
3. 准备好管理员密码。它只放在 Vercel 环境变量里，不要写进代码。
4. 用 GitHub 登录 [vercel.com](https://vercel.com) 后，先到账号设置里完成邮箱验证，否则部分 Storage 会创建失败。

本地不一定要先 `npm run build`。网页部署是 Vercel 在云端构建，不读取你电脑上的 `dist/` 或 `.env`。

#### 1. 导入 Git 仓库

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)。
2. 右上角 **Add New… → Project**（或直接打开 [vercel.com/new](https://vercel.com/new)）。
3. 在 **Import Git Repository** 里选中本仓库。若列表是空的：点 **Adjust GitHub App Permissions**（GitLab / Bitbucket 同理），把仓库授权给 Vercel。
4. 进入 **Configure Project** 后核对：

| 配置项 | 应保持 |
| --- | --- |
| Framework Preset | **Vite**。仓库里有 `api/` 目录，**不要改成 Next.js** |
| Root Directory | 仓库根目录，不要选 `dist`、`api`、`fnos` |
| Build and Output Settings | **不要打开 Override**。`vercel.json` 已经写了安装 / 构建命令和输出目录 `dist` |

5. 展开 **Environment Variables**，现在就可以先加管理员密码（三个环境都勾上）：

   | Key | Value | Environments |
   | --- | --- | --- |
   | `ADMIN_PASSWORD` | 你的管理员密码 | Production、Preview、Development |
   | `SESSION_SECRET` | 可选，一串随机字符 | 同上 |

6. 点 **Deploy**，等到 Deployments 里这条变成绿色 **Ready**。

这次部署只证明「源码能构建」。打开域名若提示「服务端尚未就绪」，先不要反复点 Deploy，继续做步骤 2–6。

如果这条就是红色 **Error**：点进去看 Building 日志，先不要去建 Redis。常见原因见上文表格。

#### 2. 确认 Node.js 版本

1. 打开该项目 → **Settings → General**。
2. 找到 **Node.js Version**，选 **24.x** 后保存。
3. 这里改版本不会自动重新部署，等步骤 6 一起 Redeploy。

下拉里如果暂时没有 24.x，选 22.x 也可以跑；构建日志里可能会出现 `EBADENGINE` 警告，可以忽略。

#### 3. 创建并连接 Vercel Blob（图片）

1. 打开该项目 → 左侧或顶部的 **Storage**。
2. 点 **Create Database** / **Browse Marketplace** / **Browse Storage**（不同账号入口文案不一样）。
3. 选择 **Blob**（Vercel 自带，不要选 Edge Config、Postgres）。
4. Store 名称例如 `hares-panel-blob`。
5. 连接当前项目，**Environments 必须勾选 Production**，建议同时勾选 Preview、Development。
6. 创建完成后，到 **Settings → Environment Variables** 确认已出现：

   ```text
   BLOB_READ_WRITE_TOKEN
   ```

如果变量在列表里，但 Production 那一列没有勾选，编辑该变量把 Production 打开。

代码上传时使用 `access: 'public'`，图片由 Vercel Blob CDN 提供，不经过 Function 回源。Blob 里的图片是公开可访问的，请勿上传敏感图片。

#### 4. 创建并连接 Upstash Redis（导航数据）

必须用 **Redis REST**。不要选 Upstash Vector / QStash / Search，也不要只填 `rediss://` TCP 地址。

**做法 1：在 Vercel Marketplace 安装（优先）**

1. 仍在项目的 **Storage** 页，点 **Create Database** / **Browse Marketplace**。
2. 选择 **Upstash** 或 **Upstash for Redis**。
3. 若提示 Install Integration：允许 Upstash 访问当前 Vercel 账号，按浏览器跳转完成授权（这是 Upstash 第三方 OAuth，不是让你回 Vercel 手动建库）。
4. 创建 Redis 数据库。免费套餐即可；地区建议选离你较近的，例如 `ap-southeast-1`（新加坡）。
5. 连接到**当前这个** Vercel 项目，Environments 同样勾上 **Production**（建议加上 Preview）。
6. 回到 **Settings → Environment Variables**，Upstash 会一次性写入一整组变量，名称类似：

   ```text
   KV_REST_API_URL                 ← 本项目要用
   KV_REST_API_TOKEN               ← 本项目要用
   KV_REST_API_READ_ONLY_TOKEN     ← 可忽略
   KV_URL                          ← 可忽略（rediss:// TCP）
   REDIS_URL                       ← 可忽略（rediss:// TCP）
   ```

   这是 Vercel Marketplace 的命名（沿用以前的 Vercel KV）。**不要再手建一份** `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`，有 `KV_REST_API_URL` + `KV_REST_API_TOKEN` 就够了。代码两种名字都认，优先读 `KV_REST_API_*`。

**做法 2：在 Upstash 控制台建库，再把 REST 变量贴进 Vercel**

Marketplace 授权失败、页面打不开、或你已经有 Upstash 账号时用这个：

1. 打开 [Upstash Console](https://console.upstash.com/) → **Redis → Create Database**。
2. 建好后打开数据库，找到 **REST API** 卡片，复制：
   - `UPSTASH_REDIS_REST_URL`（一定是 `https://….upstash.io`）
   - `UPSTASH_REDIS_REST_TOKEN`
3. 不要复制 **Redis URL** / `rediss://` / 端口 `6379`。
4. 回到 Vercel → **Settings → Environment Variables**，把这两个变量加进去，**Production 必须勾选**。

#### 5. 核对环境变量（Redeploy 前最后一眼）

打开 **Settings → Environment Variables**。连完 Marketplace 之后，列表通常比「本项目真正读取的」更长，例如：

| 变量 | 本项目用不用 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **要用** | 你手填的管理员密码 |
| `SESSION_SECRET` | 可选 | 没有也能登录；建议生产环境补一个随机串 |
| `KV_REST_API_URL` | **要用** | Upstash REST 地址，应是 `https://…` |
| `KV_REST_API_TOKEN` | **要用** | Upstash REST 读写 token |
| `BLOB_READ_WRITE_TOKEN` | **要用** | 连接 Blob 后自动出现，类型一般是 Secret |
| `KV_REST_API_READ_ONLY_TOKEN` | 不用 | Marketplace 顺带写入 |
| `KV_URL` / `REDIS_URL` | 不用 | TCP 地址，本项目不连 6379 |
| `BLOB_STORE_ID` / `BLOB_WEBHOOK_PUBLIC_KEY` | 不用 | 连接 Blob 后自动出现 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 备用 | 只有在 Upstash 控制台手贴变量时才会有；已有 `KV_REST_API_*` 就不必再加 |

黄色 **Needs Attention** 只是 Vercel 提醒「这像密钥但类型是 Config，可以改成 Secret」，**不是值填错了**，可以不管。`Rotate Upstash Secrets` 也先别点，除非 token 已经泄露。

环境范围是 **Production and Preview** 即可，不必有 Development。缺哪一项「要用」的就回去补，不要手改 Blob / Redis 的 token。本地 `.env` **不会**同步到 Vercel。

#### 6. 重新部署（必做）

连完存储或改过变量之后，旧的那次绿色部署仍然读不到新值。

1. 打开项目 → **Deployments**。
2. 找到当前 **Production** 那一条（不要拿带 git 分支名、随机 hash 的 Preview 当正式站）。
3. 右侧 **⋯ → Redeploy**。
4. 弹出框里可以保留 **Use existing Build Cache**；点 **Redeploy**。
5. 等到新记录变成绿色 **Ready**，再打开 Overview 上的 Production 域名。

不要用 Instant Rollback，那会回到更旧的部署。

#### 7. 验证是否真的可用

1. 打开 Production 域名，后面加上 `/api/health`，例如 `https://你的项目.vercel.app/api/health`。
2. 正常应返回：

   ```json
   {
     "ok": true,
     "runtime": "vercel",
     "storage": "redis",
     "assets": "blob",
     "auth": true
   }
   ```

3. 对照：
   - `storage` 为 `null` → Redis REST 变量没进 **Production**，或还在用 Redeploy 之前的部署；
   - `assets` 为 `null` → 缺少 `BLOB_READ_WRITE_TOKEN`；
   - `auth` 为 `false` → 缺少 `ADMIN_PASSWORD`；
   - 打开 `/api/health` 却是前端页面 / 404 → 构建时 Framework 被改成了 Next.js，或 Output Directory 被改成了别的目录。到 Settings → General / Build 把 Override 关掉后 Redeploy。
4. `ok: true` 之后再打开首页。若显示「站点尚未初始化」，点「使用管理员密码登录」，输入 `ADMIN_PASSWORD`。登录成功会把内置示例写入 Redis。

#### 8. 自定义域名、日志与以后更新

- **自定义域名**：Settings → Domains，添加域名并按提示改 DNS；
- **日志**：Deployments → 点进某次部署 → **Functions** / **Logs**，看登录、保存、上传报错；
- **更新代码**：往已连接的 Git 仓库推送即可自动部署。Redis 和 Blob 里的数据不会被覆盖；
- **改密码 / 改变量**：保存环境变量后必须再 Redeploy，已上线的 Function 不会自己热更新。

### 方式 B：CLI 部署

适合仓库不在 GitHub（例如只在 Gitee / 本机），或网页 Marketplace 授权失败时。CLI 从**当前目录源码**上传，不经过 Gitee。

```bash
npm i -g vercel
vercel login
vercel link
```

`vercel link` 只关联项目，**不会部署**。先用网页或下面方式 C 把 Redis、Blob、`ADMIN_PASSWORD` 配好，再执行：

```bash
npm run deploy:vercel
```

这条命令会先在本地 `npm run build` 做预检，再执行 `vercel --prod`。生产环境仍由 Vercel 云端重新构建，本地 `dist/` 不会直接当生产产物上传。

以后改代码可以继续 `npm run deploy:vercel`，也可以把仓库连上 Git 后改用推送自动部署。

### 方式 C：存储也用 CLI 创建

不想在网页点 Storage 时：

```bash
vercel login
vercel link

# 1. Blob
vercel storage create hares-panel-blob --type blob --access public
vercel storage connect hares-panel-blob --add-rw-token --yes --environment production --environment preview

# 2. Upstash Redis（Marketplace；可能打开浏览器做 Upstash 授权）
vercel install upstash
# 按提示选 Upstash for Redis，成功后写入 KV_REST_API_* 或 UPSTASH_REDIS_REST_*

# 3. 管理员密码
vercel env add ADMIN_PASSWORD production

# 4. 只部署一次
npm run deploy:vercel
```

说明：

- 先跑 `vercel storage status`。Blob 已经存在就不要再 `storage create`，否则会新建另一个 store；
- 不想走 Marketplace 时，在 Upstash 控制台建库，把 REST 变量写进去：

  ```bash
  vercel env add UPSTASH_REDIS_REST_URL production --value "https://..."
  vercel env add UPSTASH_REDIS_REST_TOKEN production --value "..."
  ```

- `vercel deploy` / `npm run deploy:vercel` **不会**创建 Redis / Blob，也**不会**读取本地 `.env`。它只部署代码，并绑定「创建这次部署时」项目里已经有的变量。

### 云端构建实际做了什么

无论是网页 Redeploy、Git 推送还是 `vercel --prod`，Vercel 都在云端按这个顺序执行：

1. 上传源码（不是你本地的 `dist/`）；
2. 执行 `vercel.json` 里的 `node scripts/vercel-command.mjs npm install`；
3. 执行 `node scripts/vercel-command.mjs npm run build`（`tsc --noEmit`、`vite build`，以及 EdgeOne 函数文件生成）；
4. 把 `api/[...path].ts` 打成 Node Function，把 `dist/` 放到 CDN；
5. 把**这一次部署创建时**已经存在的环境变量注入 Function。

所以：Storage 连上了但没 Redeploy = 线上还是旧变量 = `/api/health` 仍然是 `null`。

### 注意事项

- Vercel Function 请求体上限约 **4.5 MB**；前端会压缩普通图片，超大原图 / GIF / SVG 可能失败。需要大图时改用图片 URL，或换 Cloudflare R2 / Docker；
- 未配置 Redis 时 `/api/health` 为 `ok: false`，页面显示「服务端尚未就绪」；
- Blob 只存图片，导航状态在 Redis，两套都要连；
- 普通登录 / 保存 / 上传不会碰到 Function 超时；
- Hobby 免费额度够个人导航站使用。

---

## EdgeOne Makers（腾讯国际版）

EdgeOne 使用 **Node Functions + EdgeOne Blob**，不需要单独创建 KV、数据库或 COS：

```text
静态 SPA ──> EdgeOne 静态资源（dist/）
/api/*   ──> cloud-functions/api/[[default]].js（Node Function）
                 ├─> state/default.json（导航数据）
                 └─> assets/（图片）
```

### 1. 项目结构与构建

关键文件：

```text
.nvmrc                               # EdgeOne / nvm 构建 Node 版本（24.18.0）
edgeone.json                         # 构建、Node 版本、输出目录
server/edgeone.ts                    # EdgeOne Blob 适配层
server/edgeone-entry.ts              # Node Function 入口
cloud-functions/api/[[default]].js   # 由 npm run build 生成，需随仓库部署
```

`edgeone.json` 当前配置：

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "nodeVersion": "24.18.0",
  "cloudFunctions": {
    "maxDuration": 60
  }
}
```

> `nodeVersion` 只控制**构建环境**，不会改变 Node Function 运行时。EdgeOne 已预装 `24.18.0`；本仓库同时提供 `.nvmrc`（`24.18.0`），构建日志会打印 `[build] Node v...`，可确认实际版本。如果控制台项目设置仍是 22.x，请在「项目设置 → Node.js 版本」选择 `24.18.0` 后重新部署；旧部署不会自动切换。Node Function 运行时由平台固定（文档标注 v20.x，实际以 `/api/health` 的 `platform` 为准），与构建版本无关。

本地构建：

```bash
npm install
npm run build
```

构建结束时应看到：

```text
dist/
cloud-functions/api/[[default]].js
```

`cloud-functions` 入口由 [scripts/build-edgeone.mjs](../scripts/build-edgeone.mjs) 从 `server/edgeone-entry.ts` 生成，不要手动修改生成文件。修改 `server/` 下代码后重新执行 `npm run build`，并提交更新后的 `cloud-functions/api/[[default]].js`。

### 2. 导入 EdgeOne 项目

在 [EdgeOne Makers 国际版](https://pages.edgeone.ai) 导入 Git 仓库：

| 配置项 | 值 |
| --- | --- |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version（项目设置） | `24.18.0` |
| Functions Directory（如果要求填写） | `cloud-functions` |
| 加速区域（Acceleration Area） | **全球可用区（不含中国大陆）** |

> 加速区域必须选择 **全球可用区（不含中国大陆）**：该区域绑定自定义域名**不需要工信部 ICP 备案**。「中国大陆可用区」和「全球可用区」（含中国大陆）都要求域名先完成 ICP 备案。
>
> 加速区域在项目创建时确定，之后无法修改（CLI 的 `-a` 也只对新建项目生效）。如果项目建错了区域，需要用新的项目重新创建。

> 不能只上传 `dist/`。EdgeOne 项目必须同时包含 `cloud-functions`，否则 `/api/*` 没有处理函数，页面会显示「服务端尚未就绪」。

### 3. 设置环境变量

在 EdgeOne 项目 → **Environment Variables** 中配置 **Production** 环境：

```text
ADMIN_PASSWORD=你的管理员密码
SESSION_SECRET=可选的随机字符串
# 可选；默认命名空间就是 hares-panel
HARES_BLOB_STORE=hares-panel
```

`ADMIN_PASSWORD` 必填，否则登录接口会返回未配置错误。`HARES_BLOB_STORE` 不填时使用 `hares-panel`；同一个 EdgeOne 项目下有多个环境或部署需要隔离数据时，建议给每个环境设置不同的值。如果使用 Preview 环境部署，也请在 Preview 环境设置同样的变量。

不需要手动创建 Blob 命名空间：第一次成功访问 `/api/health` 或写入数据时会自动创建，之后可以在控制台 Blob 页面只读查看。

### 4. 部署

**方式 A：Git 自动部署**

提交并推送仓库，EdgeOne 会执行 `npm ci`、`npm run build`，然后发布静态资源和 Node Function。

> 如果推送后控制台仍显示 Node 22.1，进入「项目设置 → Node.js 版本」改为 `24.18.0`，保存后**新建部署**。`edgeone.json` 和 `.nvmrc` 只影响新的构建，旧部署不会自动切换。构建日志应出现 `[build] Node v24.18.0`。

**方式 B：EdgeOne CLI**

```bash
npm i -g edgeone@latest
edgeone login --site global
edgeone makers deploy -n <项目名> -a overseas
```

`-a overseas` 对应 **全球可用区（不含中国大陆）**，绑定自定义域名无需 ICP 备案；默认的 `-a global` 是「全球可用区」（含中国大陆），自定义域名需要备案。`--site global` 只表示登录国际版控制台，与加速区域无关，保持不变。

> `-a` 只在**创建项目**时生效，加速区域创建后不能修改。如果已有项目是用 `-a global` 创建的，请换一个新项目名加 `-a overseas` 重新创建，并重新配置环境变量。

如果项目已经关联，可以省略 `-n`。CLI 会自动构建并部署；需要机器可读结果时加 `--json`。

> `edgeone makers deploy` 在**本机**执行 `npm ci` / `npm run build`，Node 版本取本机 `node -v`；`edgeone.json` / `.nvmrc` 主要影响 Git 云端构建。如果要求本机构建也使用 24.18.0，请先切换本地 Node 版本（如 `nvm use 24.18.0`）。云端构建版本在 EdgeOne 项目设置里选择。

> 如果 CLI 提示创建了新项目（例如原本项目不在 overseas 区域），记得在新项目的 **Environment Variables** 里补上 `ADMIN_PASSWORD`；否则部署成功后面板会因缺少管理员密码而无法登录。

Windows 本地部署注意：如果同时运行着 `npm run dev` / `npm run dev:api`，CLI 的 `npm ci` 可能因为 `node_modules/@esbuild/.../esbuild.exe` 被占用而失败。先停止开发服务器，或在一个干净目录中执行部署。

### 5. 访问地址与自定义域名

EdgeOne 默认的 `*.edgeone.cool` 是**带访问控制的预览域名**：

- 直接打开裸域名通常返回 401；
- 需要在控制台项目概览点击 **Preview** 获取带 `eo_token` 的临时链接（约 3 小时有效）；
- 中国大陆网络直接访问预览域名可能返回 401；
- 页面内 `/api/*` 与页面同域，使用同一个访问链接 / Cookie 即可正常工作。

长期公开使用请绑定自定义域名：

1. 打开 EdgeOne 控制台 → 项目 → **Domains / 域名管理**；
2. 添加自定义域名；
3. 按控制台提示在 DNS 服务商添加 CNAME；
4. 等待证书签发后，用自定义域名访问，不再需要 `eo_token` 临时链接。

> 项目的加速区域为 **全球可用区（不含中国大陆）** 时，绑定自定义域名不需要 ICP 备案；如果选的是「中国大陆可用区」或「全球可用区」（含中国大陆），则必须先完成工信部 ICP 备案。

### 6. 初始化与验证

1. 用控制台 Preview 生成的完整链接打开站点；
2. 显示「站点尚未初始化」时，点击「使用管理员密码登录」；
3. 输入 `ADMIN_PASSWORD`，登录后写入内置示例数据；
4. 访问 `/api/health`，正常结果应类似：

   ```json
   {
     "ok": true,
     "runtime": "edgeone",
     "platform": "v20.x · EdgeOne Makers",
     "storage": "edgeone-blob",
     "assets": "edgeone-blob",
     "auth": true
   }
   ```

> 这里的 `platform` 来自 Node Function 的 `process.version`，是**运行时版本**，不是构建环境版本；EdgeOne 文档标注为 v20.x，实际环境也可能显示 v22.x。构建环境版本请看构建日志里的 `[build] Node ...`。

如果 `storage` / `assets` 为 `null`，依次检查：

- 部署产物中是否包含 `cloud-functions/api/[[default]].js`；
- 构建日志中是否出现 `Node functions build completed successfully`；
- 环境变量 `ADMIN_PASSWORD` 是否在 **Production** 环境；
- EdgeOne 控制台 → 日志分析中的 Function 错误，常见为 Blob 鉴权失败或命名空间不可用。

本地也可以单独验证适配层（不连接真实 Blob）：

```bash
node tests/edgeone.test.mjs
```

### 7. EdgeOne 限制

- Node Function 请求体上限约 **6 MB**，本站单张图片限制为 **5 MB**；
- 免费版 Blob 容量 **1 GB**，导航状态与图片共用；
- Function 最长执行时间在 `edgeone.json` 中设为 60 秒；
- 图片通过 `/api/assets/:key` 由 Function 回源，不依赖 Blob 公网直链；
- Blob 读使用强一致模式，保存后刷新不会读到旧数据；
- 删除图片会同时删除 Blob 对象和导航数据中的引用。

参考：[EdgeOne Node Functions](https://pages.edgeone.ai/document/node-functions)、[EdgeOne Blob](https://pages.edgeone.ai/document/blob-storage)、[EdgeOne 错误码](https://pages.edgeone.ai/document/error-codes)。

---

## Docker 自托管

适合 NAS、家用服务器或云主机。镜像只运行 Node 服务，**不内置反向代理**：

> 需要从 Docker Hub 拉取镜像部署时，可参考 [Docker Hub 部署说明](docker-hub/README.md) 和 [docker-compose.yml](docker-hub/docker-compose.yml)。

- **Node 24 服务端**：提供 SPA 与 `/api/*`，状态和图片写入 `/data`；
- **面板直连端口**：宿主机 `18000` 与容器 `18000` 一致，不占用 80/443；
- **首次启动自动生成管理员密码**：未设置 `ADMIN_PASSWORD` 时写入 `/data/admin-password`，并打印到容器日志；
- **公网 HTTPS**：请使用 NAS 上已有的 Nginx / Caddy / 路由器反向代理到 `http://<NAS IP>:18000`。本项目不管理宿主机反代，也不处理证书。

### 端口规划

| 用途 | 默认宿主机端口 | 容器端口 | 说明 |
| --- | --- | --- | --- |
| 面板 HTTP | `18000` | `18000` | 默认只发布这一个端口，宿主机与容器端口一致 |

`docker-compose.yml` 里写的是字面值 `"18000:18000"`，NAS 面板解析该文件时会直接预填这两个端口。要换宿主机端口：用 `deploy.sh` / `deploy.ps1` 的 `--port` / `-Port`（脚本会读取 `.env` 的 `PANEL_PORT` 并生成端口覆盖文件），或手动改 `docker-compose.yml` 的 `ports` 行。默认使用高位端口，避免和 NAS 上已有的应用 / 其他容器冲突。旧版本镜像的容器端口是 `3000`：升级镜像后把映射改成 `18000:18000`，或者给容器保留 `APP_PORT=3000`、`PORT=3000` 以继续使用 `18000:3000` 的映射。

### 宿主机 `./data` 目录结构

```text
data/
├── state.json       # 导航数据（完整 JSON 文档）
├── assets/          # 上传的图片
├── session-secret   # 登录令牌签名密钥
└── admin-password   # 自动生成的管理员密码（仅在未设置 ADMIN_PASSWORD 时使用）
```

### 方式 A：一键脚本（推荐）

Linux / macOS / NAS SSH：

```bash
chmod +x deploy.sh

# 默认 18000 端口
./deploy.sh
# 访问 http://<NAS IP>:18000

# 自定义高位端口
./deploy.sh --port 19000
```

Windows PowerShell（Docker Desktop）：

```powershell
.\deploy.ps1

.\deploy.ps1 -Port 19000
```

说明：

- 脚本会生成 `.env`（含随机管理员密码），执行 `docker compose -f docker-compose.yml up -d --build`，等待健康检查后输出访问地址和密码；
- 已有镜像、只想快速重启时加 `--no-build`（PowerShell 为 `-NoBuild`）；
- 如果 PowerShell 阻止脚本执行，可使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### 方式 B：Docker Compose 手动部署

```bash
cp .env.example .env
# 编辑 .env；至少建议设置 ADMIN_PASSWORD，留空则容器首次启动自动生成
docker compose up -d --build
```

打开 `http://<服务器IP>:18000`。查看日志：

```bash
docker compose logs -f hares-panel
```

健康检查：

```bash
curl http://127.0.0.1:18000/api/health
```

正常结果应包含 `"runtime": "docker"`、`"storage": "file"`、`"assets": "file"`、`"auth": true`。

### 方式 C：docker run

```bash
docker build -t hares-panel .
docker run -d --name hares-panel --restart unless-stopped \
  -p 18000:18000 \
  -e ADMIN_PASSWORD='换成强密码' \
  -v "$PWD/data:/data" \
  hares-panel
```

### 方式 D：NAS 应用向导（飞牛 / 群晖）

飞牛（fnOS）、群晖（DSM）的 Docker 界面支持直接导入 `docker-compose.yml`。本仓库的 compose 里把端口写成了字面值 **`18000:18000`**（不是 `${PANEL_PORT:-18000}` 变量），所以导入或创建工作项目时，界面会直接预填成：

| 向导里的字段 | 值 | 说明 |
| --- | --- | --- |
| 本地端口（宿主机） | `18000` | 可改成其他空闲高位端口 |
| 容器端口 | `18000` | 容器内监听 18000，与宿主机一致 |
| 协议 | `TCP` | |
| 存储 / 卷 | `/data` → NAS 上的目录 | 例如 `/vol1/1000/docker/hares-panel/data` |

创建后访问 `http://<NAS IP>:18000`。

注意事项：

- 必须把 `/data` 挂到 NAS 上的持久目录：导航数据、上传图片、会话密钥、自动生成的密码都在这个目录，不挂载时重建容器会全部丢失。
- 如果界面用的是「选择镜像 → 创建容器」而不是 Compose：新镜像已经 `EXPOSE 18000` 且容器内监听 18000，界面同样会预填 `18000 → 18000`，直接创建即可（旧镜像 `EXPOSE 3000`，需要重新构建镜像）。
- 平台支持 Compose 时优先用上面的「方式 B」：`docker-compose.yml` 已经包含 `18000:18000`、`/data` 挂载、重启策略和日志轮转，不用逐项手填。

### 方式 E：飞牛 fnOS 原生应用包（.fpk）

仓库 [fnos/](../fnos/README.md) 提供飞牛应用中心的**原生应用包**（不是 Docker 套壳）。安装后由应用中心直接启动捆绑的 Node 进程，不拉取镜像、不创建容器。在「应用中心 → 手动安装」里选中 `.fpk` 安装，完成后从桌面图标打开：

| 项 | 值 |
| --- | --- |
| 监听端口 | `18000`（来自 `manifest` 的 `service_port`） |
| 应用目录 | `${TRIM_APPDEST}`（官方安装目录） |
| 数据目录 | `${TRIM_PKGVAR}/data`，升级保留 |
| 日志 | `${TRIM_PKGVAR}/hares-panel.log` |
| 访问地址 | `http://<NAS IP>:18000` |
| 架构 | x86_64（`platform=x86`） |

> 从旧的 Docker 版 `.fpk` 迁移：先卸载旧应用（可选择保留数据），再安装本原生包。

重新打包需要 **Node.js 24** 和 [fnpack](https://developer.fnnas.com/docs/cli/fnpack/)：在 `fnos/` 目录执行 `.\build.cmd -Fnpack <fnpack.exe>`（Windows）或 `FNPACK=<fnpack> ./build.sh`（Linux/macOS）。打包脚本会构建前端/服务端并下载 Linux Node 运行时打进 `.fpk`，详见 [fnos/README.md](../fnos/README.md)。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 首次启动自动生成 | 管理员密码；留空时生成并保存到 `/data/admin-password` |
| `SESSION_SECRET` | 自动生成 | HMAC 令牌密钥；留空时保存到 `/data/session-secret` |
| `PANEL_PORT` | `18000` | 部署脚本使用的宿主机端口；手动跑 Compose 时请改 `docker-compose.yml` 的 `ports` 行 |
| `HARES_STATE_MAX_MB` | `16` | 导航数据大小上限（MB） |
| `HARES_ASSET_MAX_MB` | `16` | 单张图片大小上限（MB） |
| `TZ` | `Asia/Shanghai` | 容器时区 |
| `APK_MIRROR` | 空 | 构建时可选 Alpine 镜像源，例如 `https://mirrors.aliyun.com/alpine` |

### 公网访问与 HTTPS

Docker 只提供 HTTP。需要公网访问或 HTTPS 时，用现有反向代理转发到面板端口，例如 Nginx：

```nginx
location / {
  proxy_pass http://127.0.0.1:18000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

或 Caddy：

```caddyfile
panel.example.com {
  reverse_proxy 127.0.0.1:18000
}
```

证书、域名和 80/443 都由外部反向代理负责，不保存在 `./data`。不要把 `18000` 直接暴露到公网。

### 数据备份、迁移与升级

- 定期备份整个 `./data` 目录（状态、图片、会话密钥、密码）；
- 只迁移内容时，可在「管理控制台 → 备份与恢复」导出 JSON，再在新部署导入；图片二进制不会进入 JSON，需要同步 `data/assets` 或在导入后重新上传；
- 升级代码后重新执行 `docker compose up -d --build`，`./data` 中的数据会保留；
- `./data` 包含密码和会话密钥；
- 文件存储按单容器设计，不要让多个容器副本同时写同一个 `./data` 目录。

### 构建缓慢、拉取基础镜像失败或 apk 超时

Dockerfile 默认依次尝试 `mirrors.aliyun.com`、`mirrors.tuna.tsinghua.edu.cn` 和 Alpine 官方源（每个最多 60 秒），国内网络通常无需手动处理。也可以显式指定镜像源，在 `.env` 中设置：

```dotenv
APK_MIRROR=https://mirrors.aliyun.com/alpine
```

然后重新执行 `docker compose up -d --build`。Compose 会把该值作为构建参数传给 Dockerfile；设置后只使用该镜像源，不再自动回退。

如果构建在第一步 `FROM node:24-alpine` 就失败，报 `failed to authorize`、`failed to fetch oauth token`、`EOF` 或 `连接被重置`，说明本机访问 Docker Hub 被阻断（与代码无关）。换一个能访问的基础镜像即可：

```dotenv
# .env
NODE_IMAGE=docker.m.daocloud.io/library/node:24-alpine
```

```bash
docker compose up -d --build
# 或直接构建
docker build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:24-alpine -t hares-panel .
```

`NODE_IMAGE` 是 Dockerfile 里 `FROM ${NODE_IMAGE}` 的构建参数，默认 `node:24-alpine`；其他可用的 Docker Hub 镜像源同理，填完整镜像地址（含仓库路径）即可。

---

## 部署后检查清单

无论使用哪个平台，部署完成后至少检查：

1. **健康检查**：访问 `/api/health`，确认 `ok`、`storage`、`assets`、`auth` 四个字段符合预期；
2. **首次初始化**：打开首页 → 登录 → 确认自动写入示例数据并能进入导航页；
3. **保存**：修改站点名称或添加一张卡片，等待自动保存后刷新页面，确认内容仍在；
4. **图片**：上传一张测试图片，确认能显示；删除后确认不再出现；
5. **公开访问**：退出管理员，确认访客能看到公开内容，且隐藏卡片 / 分组不出现在页面和 `/api/state` 中；
6. **备份**：在「管理控制台 → 备份与恢复」导出一份 JSON 快照。

## 数据迁移与备份

- 导航数据统一在「管理控制台 → 备份与恢复」导出 / 导入；
- 备份 JSON **不包含图片二进制**，只保存图片地址和对象 key；
- 切换平台时，除了导入 JSON，还需要把图片对象同步到新平台，或在导入后重新上传图片；
- Cloudflare R2、Vercel Blob、EdgeOne Blob 是独立存储，不会自动互相复制；
- Cloudflare D1/KV、Vercel Redis、EdgeOne Blob 之间也不会自动同步。切换平台后请以新平台的数据为准，不要同时编辑两套内容。
- 需要持续双向同步时，使用「管理控制台 → 实例同步」（见下文）。

## 实例同步

「管理控制台 → 实例同步」可以让一台 Hares-Panel 实例把导航数据与图片**同步**到另一台实例，覆盖
**Cloudflare Worker ↔ Docker ↔ Vercel ↔ EdgeOne** 的任意组合。适合在本地 Docker 和云端 Worker / Vercel / EdgeOne 各搭一套、希望数据保持一致的场景。

- 在「同步目标」填写另一台实例的**地址**和它的 **`ADMIN_PASSWORD`**；
- **测试连接**：只检查远端是否可达、是否为 Hares-Panel、存储是否就绪，不传输任何数据；
- **同步方向**：
  - **自动判断**（默认）：比较两端数据的更新时间，把较新的一方复制到较旧的一方（可推可拉）；
  - **本机 → 远端**：强制把本机数据覆盖到远端；
  - **远端 → 本机**：强制用远端数据覆盖本机；
- **同步图片**：默认开启，会把两端缺失的图片对象真实传输；关闭后只同步导航文本，图片地址保持原样。
- 同步由本机服务端发起，在服务器上完成跨实例请求，避免浏览器跨域限制；
- 同步会用一端的数据覆盖另一端，操作前建议先导出一份快照；
- 两端数据相同且都没有被改动时，同步会报告「无需同步」，不会重复写入。

> **单向拉取（内网 → 公网，本机不暴露）**：同步始终由**本机发起**，只需要本机能访问填写的远端地址，远端**无需反向访问本机**。例如内网实例填公网实例的地址、选「远端 → 本机」手动拉取，即可把公网实例的更新同步进内网实例，而内网实例无需暴露到公网。

> 说明：若两侧都被各自编辑过，自动判断只会按更新时间选取较新的一方整份覆盖，不会做字段级合并；需要精确控制时请用「上传 / 下载」手动选择。

## 从其他面板导入

「管理控制台 → 备份与恢复 → 导入备份」会自动识别三种文件：

- **Hares-Panel 原生备份**：包含 `app: "hares-panel"` 的 JSON；
- **FlatNas 备份**：包含 `groups` / `items` / `widgets` / `appConfig` 的 JSON；
- **Sun-Panel 配置**：`appName` 为 `Sun-Panel-Config`，或包含 `icons` 分组数组的 `.sun-panel.json`。

### 从 FlatNas 导入

FlatNas 导入规则：

- 分组标题、分组可见性、组内卡片会转换为本站分组与卡片；
- 卡片会尽量映射 `title`、`url`、`lanUrl`、`description1/2/3`、`openInNewTab`、`isPublic`、`icon`；
- FlatNas 导出文件同时包含 `groups[].items` 和顶层扁平 `items` 副本；导入会按卡片 `id` / 标题+地址去重，忽略重复副本，顶层多出的卡片放入「未分组卡片」；
- 卡片 `url` 为空时会回退使用 `backupUrls` / `alternateUrls`，`lanUrl` 为空时会回退使用 `backupLanUrls`；
- 站点名称与背景图会尝试从 `appConfig.customTitle` / `wallpaperConfig` 读取；
- 如果备份中没有导航卡片，会回退导入 bookmark 小组件的分类与链接；嵌套分类展开为 `父分类 / 子分类` 分组；
- 时钟、天气、待办、RSS 等其他小组件不会导入，导入结果中会列出提示；
- `/icon-cache/...`、`icons/...` 等 FlatNas 本地图标路径无法迁移（备份不包含图片本体），会留空并提示重新选择图标；`data:image/...` 内嵌图标和绝对 URL 会保留；
- 导入会替换当前服务端数据，操作前建议先导出一份本站备份。

仓库提供了一份可直接导入的测试文件：[examples/flatnas-backup-sample.json](../examples/flatnas-backup-sample.json)。它包含 3 个分组、7 张组内卡片、1 张顶层未分组卡片、隐藏分组/隐藏卡片、`backupUrls` 回退、内嵌 SVG 图标和本地图标路径，可用于验证转换结果。

### 从 Sun-Panel 导入

Sun-Panel 导入规则：

- 读取 `icons[]` 中的图标分组与组内卡片，按 `sort` 重新排序；
- 分组标题、分组描述、`hidden` / `isPublic` 会转换为本站分组属性；`cardStyle.style` 为 `0`（详情风格）时使用卡片样式，为 `1`（图标风格）时使用图标样式；
- 卡片会映射 `title`、`url`、`lanUrl`、`description`、`openMethod`；`openMethod` 1（当前页）转换为当前标签页，2（新窗口）转换为新标签页，3（站内浮层）转换为新标签页并在导入结果中提示；
- 图标支持 Sun-Panel 的三种类型：`itemType: 2` 图片 URL、`itemType: 3` Iconify 名称、`itemType: 1` 文字或 emoji；协议相对地址和 `data:image/...` 会保留；
- Sun-Panel 本地上传的图标（例如 `/upload/...`）无法迁移，因为备份不包含图片本体，会留空并提示重新选择图标；
- 如果文件包含 `styleConfig` / `panelConfig`，站点名称、Logo、背景图、时钟秒数、搜索框、内外网切换和系统状态开关也会尝试同步；
- Sun-Panel 的配置导出本身只包含图标分组，不包含待办、RSS 等其他模块数据；导入会替换当前服务端数据，操作前建议先导出一份本站备份。

仓库提供了一份可直接导入的测试文件：[examples/sun-panel-backup-sample.json](../examples/sun-panel-backup-sample.json)，包含 3 个分组、6 张卡片、内外网地址、描述和图片图标，可用于验证转换结果。

## 故障排查

**页面显示「服务端尚未就绪」？** 检查 `/api/health` 是否返回 JSON 且 `ok: true`；确认已配置 KV/D1、Upstash Redis、EdgeOne Blob 或 Docker 的 `./data` 目录，并在对应平台设置了 `ADMIN_PASSWORD`（Docker 可留空自动生成）。Docker 还需确认宿主机 `18000` 已映射到容器 `18000`。

**Vercel 网页部署后仍显示「服务端尚未就绪」？** 先看页面上的具体句子，再在浏览器打开 Production 域名的 `/api/health`（不要用带 hash 的 Preview 地址）：

- 返回 JSON 且 `storage` 为 `null`：Redis REST 没进 **Production**，或连完存储后没有 Redeploy；
- 返回 JSON 且 `assets` 为 `null`：缺少 `BLOB_READ_WRITE_TOKEN`；
- 返回 JSON 且 `auth` 为 `false`：缺少 `ADMIN_PASSWORD`；
- 返回的是前端网页、空白或 404：API 函数没挂上。确认仓库包含 `api/health.ts`，Framework 是 Vite，然后 **Redeploy**；
- 返回 500：函数启动失败。拉取包含 `api/health.ts` 的最新代码后再 Redeploy，不要用带 `__hp` 查询参数的旧 rewrite；
- 一直转圈 / 超时：Hobby 冷启动加上 Upstash 可能超过几秒，等 10 秒再点「重新检测」。

环境变量列表里多出来的 `KV_URL`、`REDIS_URL`、`BLOB_STORE_ID` 可以忽略。详细点击步骤见 [Vercel 网页控制台部署](#方式-a网页控制台部署推荐)。

**Vercel 导入失败或构建报 `next build`？** 网页只能导入 GitHub / GitLab / Bitbucket 上的完整源码，不能导入 Gitee，也不能只上传 `dist/`。Configure Project 时 Framework Preset 必须是 **Vite**（仓库有 `api/` 也不要改成 Next.js），不要 Override 构建命令。仓库不在 GitHub 时改用 [CLI 部署](#方式-bcli-部署)。

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

**`npm run build` 在 Windows 上报 `esbuild ... Access is denied`？** 构建脚本 [scripts/build.mjs](../scripts/build.mjs) 已把 `TEMP/TMP/TMPDIR` 指向项目内的 `.build-tmp`，正常使用 `npm run build` 即可。不要直接运行 `vite build`；如果仍然失败，请检查杀毒软件或项目目录写权限。

**`wrangler deploy` 报找不到 D1 / R2？** 需要先把 `wrangler.jsonc` 中的 `<D1_DATABASE_ID>` 换成真实 ID，并创建对应的 R2 bucket；详见上方「Cloudflare Workers」章节。`wrangler deploy --dry-run` 不会校验资源 ID。

**容器日志里的自动生成密码登不上？** 自动密码是 32 位 base64url 字符串，服务端不会 trim，多一个空格、少一个字符都会返回 401。旧版入口脚本生成的密码可能以 `-` 开头，日志里那一行还带前导空格，复制时最容易漏掉 `-`。取准确值：

```bash
docker exec <容器名> cat /data/admin-password
```

也可以直接设置 `ADMIN_PASSWORD` 环境变量覆盖它（设置后以环境变量为准）。新版镜像生成的首尾字符一定是字母或数字，并且密码单独一行输出，不再带前导空格。

**忘记密码？** 修改部署平台的 `ADMIN_PASSWORD`：Cloudflare 使用 `wrangler secret put`，Vercel 在 Environment Variables 中修改，EdgeOne 在项目环境变量中修改；保存后重新部署 / 刷新即可，无需在页面中重置。Docker 可以修改 `.env` 后执行 `docker compose up -d`；如果是首次启动自动生成的密码，直接查看 `./data/admin-password` 或 `docker compose logs hares-panel`。彻底重置：删除 `/data/admin-password` 后重启容器，会重新生成并打印新密码。

**Docker 通过外部反代访问异常？** 确认反向代理目标指向 `http://<NAS IP>:18000`，并转发 `Host`、`X-Forwarded-Proto`、`X-Forwarded-Host`。HTTPS 证书由外部 Nginx / Caddy 负责，容器内不申请证书；可查看对应反向代理的日志排查。

**飞牛 / 群晖的 Docker 向导里端口显示多少？** 新版镜像 `EXPOSE 18000` 且容器内监听 18000，所以选镜像创建容器、或导入仓库里的 `docker-compose.yml`，都会显示 `18000:18000`。如果显示 `3000:3000`，说明用的还是旧镜像（旧版 `EXPOSE 3000`），重新构建镜像即可。

**FlatNas / Sun-Panel 导入后图标空白？** 这两个面板的备份只保存本地上传图标的路径（例如 FlatNas 的 `/icon-cache/...`、Sun-Panel 的 `/upload/...`），不包含图片本体，因此无法直接迁移；导入时这些图标会留空并给出提示，重新选择图标或填写图片 URL 即可。FlatNas 的嵌套 bookmark 分类会展开为 `父分类 / 子分类` 分组。

### 其他静态托管

不再支持纯静态托管：应用需要同源 `/api` 才能运行。请使用 Workers、Vercel、EdgeOne Makers，或 Docker 自托管。
