#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f ".env" ]; then
  echo "[INFO] deploy/.env 未找到，默认使用 HTTP (:80) 模式创建 .env（绑定域名后请修改 DOMAIN=...）"
  echo "DOMAIN=:80" > .env
fi

echo "[1/3] 拉取最新代码..."
git -C .. pull --ff-only || true

echo "[2/3] 构建并启动《明途 · 舆图纪》生产容器与 Caddy HTTPS 网关..."
docker compose up -d --build --remove-orphans

echo "[3/3] 检查健康状态..."
docker compose ps
echo "✅ 部署完成！健康检查接口：/api/health"
