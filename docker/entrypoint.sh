#!/bin/sh
# Hares-Panel Docker entrypoint: prepare persistent data, generate a first-run
# admin password, then hand PID 1 over to the Node server.
set -eu

DATA_DIR="${HARES_DATA_DIR:-/data}"
APP_PORT="${APP_PORT:-18000}"
export DATA_DIR APP_PORT

mkdir -p "$DATA_DIR/assets"

# Generate an admin password on first boot instead of shipping a default one.
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  if [ -s "$DATA_DIR/admin-password" ]; then
    ADMIN_PASSWORD="$(cat "$DATA_DIR/admin-password")"
    echo "[hares-panel] 使用已保存的管理员密码：$DATA_DIR/admin-password"
  else
    ADMIN_PASSWORD="$(head -c 24 /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_')"
    printf '%s\n' "$ADMIN_PASSWORD" > "$DATA_DIR/admin-password"
    chmod 600 "$DATA_DIR/admin-password" 2>/dev/null || true
    echo "============================================================"
    echo " Hares-Panel 首次启动，已自动生成管理员密码："
    echo " $ADMIN_PASSWORD"
    echo " 密码同时保存在容器内 $DATA_DIR/admin-password"
    echo " 也可以通过设置 ADMIN_PASSWORD 环境变量覆盖。"
    echo "============================================================"
  fi
  export ADMIN_PASSWORD
fi

echo "[hares-panel] 启动 Node HTTP 服务（容器端口 $APP_PORT）"
exec node /app/server/index.mjs
