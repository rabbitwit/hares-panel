# Hares-Panel · 飞牛 fnOS 应用包

把 Hares-Panel 打包成飞牛应用中心可安装的 `.fpk`。安装后应用默认占用宿主机端口 **18000**，映射到容器 **3000**，与仓库根目录的 `docker-compose.yml` 一致。

> 只有通过应用中心的「手动安装」入口安装这个 `.fpk`，才有默认 18000 的效果。直接「拉取镜像 → 运行」的创建容器表单只能读取镜像的 `EXPOSE 3000`，无法预填宿主机端口。

## 目录

```
fnos/
├── manifest                     # 应用元数据：service_port=18000
├── app/
│   ├── docker/docker-compose.yaml   # ${TRIM_SERVICE_PORT}:3000
│   └── ui/config                    # 桌面入口，端口 18000
├── cmd/                         # 生命周期脚本（启动/停止/状态）
├── config/
│   ├── privilege                # 运行身份
│   └── resource                 # docker-project 声明
├── wizard/                      # 安装向导（当前为空）
├── ICON.PNG / ICON_256.PNG      # 应用中心图标
└── build.ps1 / build.sh         # 打包脚本
```

## 关键字段

| 位置 | 值 | 说明 |
| --- | --- | --- |
| `manifest` 的 `service_port` | `18000` | 宿主机端口默认值 |
| compose `ports` | `${TRIM_SERVICE_PORT}:3000` | 宿主机 18000 → 容器 3000 |
| compose `volumes` | `${TRIM_PKGVAR}/data:/data` | 数据持久化，升级保留 |
| `app/ui/config` 的 `port` | `18000` | 桌面入口访问端口 |

镜像使用 Docker Hub 上的 `harswit2265/hares-panel:latest`。

## 打包

需要 [fnpack](https://developer.fnnas.com/docs/cli/fnpack/)（飞牛官方命令行工具）：

```powershell
# Windows
.\build.ps1 -Fnpack C:\path\to\fnpack.exe
```

```bash
# Linux / macOS
FNPACK=/path/to/fnpack ./build.sh
```

生成的 `hares-panel.fpk` 就在本目录下。

## 安装

1. 飞牛 fnOS → 应用中心 → 手动安装（或「安装应用」选择 `.fpk` 文件）；
2. 安装完成后从桌面图标打开，地址为 `http://<NAS IP>:18000`；
3. 首次启动会自动生成管理员密码，可在容器日志中查看，或读取应用数据目录里的 `admin-password`。

## 升级

修改 `manifest` 的 `version` 后重新打包安装即可；`${TRIM_PKGVAR}/data` 不会被清空。
