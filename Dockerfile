# Base image. Docker Hub is often slow or unreachable from mainland networks;
# override it with a mirror when needed, e.g.
#   docker build --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:24-alpine .
ARG NODE_IMAGE=node:24-alpine

# --- build ------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:docker

# --- runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# Optional Alpine mirror. Leave empty to try the mirrors below in order; set
# e.g. --build-arg APK_MIRROR=https://dl-cdn.alpinelinux.org/alpine to pin one.
ARG APK_MIRROR=""

# tini reaps the Node process and forwards container signals. Official Alpine
# CDN is often very slow from mainland China, so a no-argument build tries
# mirrors first and keeps the official CDN as the last fallback.
RUN set -eu; \
    install_packages() { \
      timeout -k 5 "${APK_TIMEOUT:-60}" apk add --no-cache tini ca-certificates tzdata; \
    }; \
    if [ -n "$APK_MIRROR" ]; then \
      APK_TIMEOUT=180; \
      sed -i -e "s#https://dl-cdn.alpinelinux.org/alpine#$APK_MIRROR#g" \
             -e "s#https://mirrors.aliyun.com/alpine#$APK_MIRROR#g" \
             -e "s#https://mirrors.tuna.tsinghua.edu.cn/alpine#$APK_MIRROR#g" \
             /etc/apk/repositories; \
      install_packages; \
    else \
      INSTALLED=0; \
      for mirror in \
        https://mirrors.aliyun.com/alpine \
        https://mirrors.tuna.tsinghua.edu.cn/alpine \
        https://dl-cdn.alpinelinux.org/alpine; do \
        echo "[build] Installing Node runtime packages via $mirror" >&2; \
        sed -i -e "s#https://dl-cdn.alpinelinux.org/alpine#$mirror#g" \
               -e "s#https://mirrors.aliyun.com/alpine#$mirror#g" \
               -e "s#https://mirrors.tuna.tsinghua.edu.cn/alpine#$mirror#g" \
               /etc/apk/repositories; \
        if install_packages; then INSTALLED=1; break; fi; \
        echo "[build] Mirror failed, trying the next one" >&2; \
        rm -f /lib/apk/db/lock; \
      done; \
      if [ "$INSTALLED" -ne 1 ]; then \
        echo "[build] All Alpine mirrors failed; set APK_MIRROR to a reachable mirror" >&2; \
        exit 1; \
      fi; \
    fi

WORKDIR /app
COPY --from=build /app/server-dist/index.mjs /app/server/index.mjs
COPY --from=build /app/dist /app/dist
COPY docker/entrypoint.sh /usr/local/bin/ha-res-entrypoint
RUN chmod +x /usr/local/bin/ha-res-entrypoint

ENV NODE_ENV=production \
    HARES_RUNTIME=docker \
    HARES_DATA_DIR=/data \
    HARES_STATIC_DIR=/app/dist \
    APP_PORT=3000 \
    PORT=3000

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/ha-res-entrypoint"]
