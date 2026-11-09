# Hares-Panel · 飞牛 fnOS 原生应用包

把 Hares-Panel 打包成飞牛应用中心可安装的 `.fpk`。安装后由应用中心直接启动捆绑的 Node 进程，**不依赖 Docker、不拉取镜像**。默认监听宿主机端口 **18000**。

从旧的 Docker 版应用包升级时，请先卸载旧应用（可选择保留数据），再安装本原生包。

## 目录

```
fnos/
├── manifest                     # 应用元数据：service_port=18000
├── app/
│   ├── bin/hares-panel          # 前台启动脚本（生成密码、exec Node）
│   ├── ui/                      # 桌面入口
│   ├── runtime/node             # 打包时放入的 Linux x64 Node（不入库）
│   ├── server/index.mjs         # 打包时放入的服务端（不入库）
│   └── web/                     # 打包时放入的前端（不入库）
├── cmd/                         # 生命周期脚本（start/stop/status 管理进程）
├── config/
│   ├── privilege                # 运行身份 hares-panel
│   └── resource                 # 空：原生应用，无 docker-project
├── wizard/                      # 安装向导 + 卸载向导
├── ICON.PNG / ICON_256.PNG      # 应用中心图标
└── build.cmd / build.ps1 / build.sh   # 打包脚本（Windows 用 build.cmd）
```

## 关键字段

| 位置 | 值 | 说明 |
| --- | --- | --- |
| `manifest` 的 `service_port` | `18000` | 宿主机端口默认值 |
| 应用目录 | `${TRIM_APPDEST}` | 官方安装目录（target），启动脚本按此解析 |
| 进程监听 | `0.0.0.0:${TRIM_SERVICE_PORT}` | 由 `cmd/main start` 拉起，端口就绪后才返回成功 |
| 数据目录 | `${TRIM_PKGVAR}/data` | 数据持久化，升级保留 |
| 日志 | `${TRIM_PKGVAR}/hares-panel.log` | 进程输出 |
| 启动错误 | `${TRIM_TEMP_LOGFILE}` | 失败时写入，应用中心会展示 |
| `app/ui/config` 的 `port` | `18000` | 桌面入口访问端口 |

应用包内嵌官方 Node.js **linux-x64** 运行时（与 `package.json` 的 `engines.node` 24.x 对齐）以及 `dist/` + `server-dist/`，运行时无需安装 Docker 或系统 Node。

## 打包

需要 **Node.js 24** 和 [fnpack](https://developer.fnnas.com/docs/cli/fnpack/)（飞牛官方命令行工具）。首次打包会下载 Linux Node 二进制（缓存到仓库 `.tmp/fnos-node/`）。

Windows 请用 `build.cmd`（内部以 Bypass 调用 `build.ps1`，不受执行策略拦截）：

```powershell
# Windows
.\build.cmd

# fnpack 不在 PATH 时指定路径（路径有空格必须加引号）
.\build.cmd -Fnpack "D:\Program Files\fnpack\fnpack.exe"
```

```bash
# Linux / macOS
FNPACK=/path/to/fnpack ./build.sh
```

生成的 `hares-panel.fpk` 就在本目录下（体积约数十 MB，含 Node 运行时，不提交到 Git）。

可用环境变量覆盖捆绑的 Node 版本：

```powershell
$env:HARES_FNOS_NODE_VERSION = "24.11.0"
.\build.cmd
```

## 安装

1. 飞牛 fnOS → 应用中心 → 手动安装（或「安装应用」选择 `.fpk` 文件）；
2. 安装向导 `wizard/install` 会提示设置**管理员密码**（可选）：
   - 填写密码：`cmd/install_callback` 会写入 `${TRIM_PKGVAR}/data/admin-password`，首次启动即用该密码；
   - 留空：首次启动自动生成随机密码，可查看应用日志 `${TRIM_PKGVAR}/hares-panel.log` 或数据目录里的 `admin-password`；
3. 安装完成后从桌面图标打开，地址为 `http://<NAS IP>:18000`，用第 2 步设置的密码登录。

当前包架构为 **x86_64**（`manifest` 的 `platform=x86`）。

## 升级

修改项目根目录 `package.json` 的 `version` 后，同步 `package-lock.json` 的版本，再重新打包安装即可（打包脚本会自动把版本同步到 `manifest`）；`${TRIM_PKGVAR}/data` 不会被清空。

从 Docker 版 `.fpk` 换到本原生包不属于普通升级：请卸载旧应用后再安装。若卸载时选择「保留数据」，新包仍使用同一 `${TRIM_PKGVAR}/data`，导航数据可以接上。

## 卸载

卸载应用时，`wizard/uninstall` 会弹出确认向导，让用户选择卸载后**保留还是删除应用数据**（默认保留）：

- 选「保留数据」：`${TRIM_PKGVAR}/data` 会保留，数据不会被清空；
- 选「同时删除所有数据」：`cmd/uninstall_callback` 会删除 `${TRIM_PKGVAR}/data`。

数据是否删除由用户在向导中的选择决定，脚本不会擅自清除用户数据。
