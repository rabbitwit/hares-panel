# Hares-Panel

> 现代化自托管导航面板：内外网切换、图标库、壁纸、备份恢复，单容器 Docker 部署，数据保存在本地 `./data`。

Hares-Panel 是一个面向 NAS、家庭服务器和云主机的导航首页。前端与 API 打包在同一个镜像中，只依赖一个持久化目录即可运行。

## 功能特性

- **导航与分组**：分组、卡片、拖拽排序、隐藏、默认收起、角标、描述和打开方式。
- **内外网切换**：自动识别网络环境，优先使用内网或外网地址；卡片可单独配置内网地址。
- **搜索**：多搜索引擎、默认引擎、排序、搜索框占位符和新标签页开关。
- **图标**：内置离线图标、Iconify 在线搜索、图片 URL、本地上传、图标颜色和自动 favicon。
- **外观**：多套渐变壁纸、自定义壁纸 URL、上传图片、图库、模糊、遮罩、圆角、光效和明暗主题。
- **服务端存储**：导航数据保存为 `/data/state.json`，不再依赖浏览器本地存储。
- **图片持久化**：上传的图片保存在 `/data/assets/`，容器重建后仍然保留。
- **备份恢复**：支持导出/导入 Hares-Panel JSON 备份，也能识别 FlatNas、Sun-Panel 的备份并迁移分组和卡片。
- **管理员认证**：密码来自 `ADMIN_PASSWORD`；未设置时首次启动自动生成。登录令牌使用 HMAC-SHA256 签名。
- **单容器部署**：镜像内同时提供 SPA 和 `/api/*`，无需额外的 Node 服务或数据库。
- **健康检查**：内置 `GET /api/health`，方便 Docker、NAS 和反向代理监控。

> Hares-Panel 只负责运行自己的导航站，不管理宿主机上的其他 Docker 容器。

## 镜像信息

| 项目 | 说明 |
| --- | --- |
| 镜像 | `hareswit2265/hares-panel:latest` |
| 容器端口 | `3000` |
| 默认宿主机端口 | `18000` |
| 数据目录 | `/data` |
| 健康检查 | `GET /api/health` |
| 基础镜像 | Node.js 24 Alpine |
| 时区 | 默认 `Asia/Shanghai` |

## 快速部署（Docker Compose，推荐）

### 1. 创建部署目录

```bash
mkdir -p hares-panel
cd hares-panel
```

### 2. 创建 `docker-compose.yml`

```yaml
services:
  hares-panel:
    image: hareswit2265/hares-panel:latest
    container_name: hares-panel
    restart: unless-stopped
    stop_grace_period: 20s
    ports:
      - "${PANEL_PORT:-18000}:3000"
    environment:
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
      SESSION_SECRET: ${SESSION_SECRET:-}
      HARES_RUNTIME: docker
      HARES_STATE_MAX_MB: ${HARES_STATE_MAX_MB:-16}
      HARES_ASSET_MAX_MB: ${HARES_ASSET_MAX_MB:-16}
      TZ: ${TZ:-Asia/Shanghai}
    volumes:
      - ./data:/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 20s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
```

### 3. 创建 `.env`（可选但推荐）

```dotenv
# Docker Hub 镜像
HARES_IMAGE=hareswit2265/hares-panel:latest

# 管理员密码。留空时首次启动自动生成，并保存到 ./data/admin-password
ADMIN_PASSWORD=

# 可选：登录令牌签名密钥。留空时自动生成并保存到 ./data/session-secret
SESSION_SECRET=

# 宿主机端口。默认 18000，不占用 80/443
PANEL_PORT=18000

# 导航数据 / 单张图片大小上限（MB）
HARES_STATE_MAX_MB=16
HARES_ASSET_MAX_MB=16

TZ=Asia/Shanghai
```

至少建议设置一个强密码：

```dotenv
ADMIN_PASSWORD=替换成你的强密码
```

### 4. 启动

```bash
docker compose up -d
```

如果你把文件保存为其他名字，例如 `docker-compose.hub.yml`：

```bash
docker compose -f docker-compose.hub.yml up -d
```

### 5. 访问并登录

浏览器打开：

```text
http://<服务器IP>:18000
```

如果 `ADMIN_PASSWORD` 留空，首次启动会自动生成密码：

```bash
docker compose logs hares-panel
# 或直接读取宿主机文件
cat ./data/admin-password
```

登录后即可在管理控制台修改站点信息、添加分组和卡片。

## 使用 `docker run` 部署

不使用 Compose 时：

```bash
docker run -d \
  --name hares-panel \
  --restart unless-stopped \
  -p 18000:3000 \
  -e ADMIN_PASSWORD='替换成你的强密码' \
  -e TZ=Asia/Shanghai \
  -v "$PWD/data:/data" \
  hareswit2265/hares-panel:latest
```

查看日志：

```bash
docker logs -f hares-panel
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HARES_IMAGE` | 示例占位符 | Compose 使用的镜像名，改成实际 Docker Hub 镜像即可。 |
| `PANEL_PORT` | `18000` | 宿主机端口，映射到容器 `3000`。 |
| `ADMIN_PASSWORD` | 首次启动自动生成 | 管理员登录密码。留空时生成随机密码并保存到 `/data/admin-password`。 |
| `SESSION_SECRET` | 自动生成 | HMAC 登录令牌签名密钥。留空时保存到 `/data/session-secret`。 |
| `HARES_STATE_MAX_MB` | `16` | 导航数据 JSON 的大小上限（MB）。 |
| `HARES_ASSET_MAX_MB` | `16` | 单张上传图片的大小上限（MB）。 |
| `TZ` | `Asia/Shanghai` | 容器时区。 |

> `HARES_RUNTIME=docker` 已由镜像默认设置，Compose 中保留它只是为了明确运行模式，可以不改。

## 数据持久化

容器内所有持久化数据都在 `/data`，Compose 默认映射到宿主机的 `./data`：

```text
data/
├── state.json        # 导航数据（完整 JSON 文档）
├── assets/           # 上传的图片
├── session-secret    # 登录令牌签名密钥
└── admin-password    # 自动生成的管理员密码（仅在未设置 ADMIN_PASSWORD 时使用）
```

注意事项：

- 请定期备份整个 `data/` 目录。
- 不要删除或随意修改 `session-secret`，否则现有登录状态会失效。
- `data/` 中包含密码和会话密钥，请限制目录权限。
- 文件存储按单容器设计，不要让多个容器副本同时写入同一个 `data/` 目录。
- 容器升级、重建、重新拉取镜像都不会删除挂载目录中的数据。

备份示例：

```bash
docker compose stop
tar czf "hares-panel-backup-$(date +%F).tar.gz" data
docker compose start
```

只迁移导航内容时，也可以在面板中导出 JSON 备份。注意 JSON 不包含图片二进制，图片需要同步 `data/assets/`。

## 反向代理与 HTTPS

镜像只提供 HTTP，不内置 TLS。公网访问时请把面板放在 Nginx、Caddy、Traefik 或 NAS 自带的反向代理后面，并只暴露反向代理端口。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:18000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        client_max_body_size 32m;
    }
}
```

Caddy 示例：

```caddyfile
panel.example.com {
    reverse_proxy 127.0.0.1:18000
}
```

不要把 `18000` 直接暴露到公网。证书、域名和 80/443 端口由外部反向代理负责。

## 健康检查

```bash
curl http://127.0.0.1:18000/api/health
```

正常响应会包含：

```json
{
  "app": "hares-panel",
  "ok": true,
  "runtime": "docker",
  "storage": "file",
  "assets": "file",
  "auth": true
}
```

- `ok` 为 `false` 时先检查 `./data` 是否可写。
- `auth` 为 `false` 表示没有设置 `ADMIN_PASSWORD`，容器首次启动会自动生成；如果日志中没有生成密码，请检查挂载目录权限。

## 升级

```bash
cd hares-panel
docker compose pull
docker compose up -d
```

旧镜像可以稍后清理：

```bash
docker image prune -f
```

升级不会影响 `./data`。升级前仍建议先备份该目录。

## 常见问题

**镜像拉取失败？**

确认 `HARES_IMAGE` 已改成实际存在的 Docker Hub 镜像名；私有仓库需要先执行 `docker login`。NAS 为 ARM 架构时，还需要使用支持 `linux/arm64` 的镜像。

**页面提示服务端未就绪？**

检查容器状态和健康接口：

```bash
docker compose ps
docker compose logs -f hares-panel
curl http://127.0.0.1:18000/api/health
```

**端口 18000 已被占用？**

修改 `.env`：

```dotenv
PANEL_PORT=19000
```

然后重新执行 `docker compose up -d`。

**忘记管理员密码？**

如果密码是自动生成的，查看：

```bash
cat ./data/admin-password
```

或者直接在 `.env` 中设置新的 `ADMIN_PASSWORD`，然后执行：

```bash
docker compose up -d
```

**能否运行多个副本？**

当前文件存储按单容器设计，不支持多个副本同时挂载同一个 `data/` 目录。需要高可用时请改为共享存储或使用其他数据库方案。

## 维护者：构建并推送镜像

从仓库根目录构建多架构镜像并推送到 Docker Hub：

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t <DOCKERHUB_USERNAME>/hares-panel:latest \
  -t <DOCKERHUB_USERNAME>/hares-panel:0.1.0 \
  --push .
```

只构建本机架构：

```bash
docker build -t <DOCKERHUB_USERNAME>/hares-panel:latest .
docker push <DOCKERHUB_USERNAME>/hares-panel:latest
```

## 安全提示

- 首次登录后请立即确认管理员密码强度。
- 公网访问必须使用 HTTPS 反向代理，或通过 VPN / 内网访问。
- 请只使用本项目官方发布的镜像，或从源码自行构建，不要运行来源不明的第三方镜像。
- `data/` 目录包含凭据和会话密钥，不要提交到 Git，也不要在公开备份中泄露。
- 自定义 JavaScript 会以管理员身份在页面中执行，只应使用自己信任的脚本。

## 许可

MIT License。详情请查看项目仓库中的 `LICENSE` 文件。
