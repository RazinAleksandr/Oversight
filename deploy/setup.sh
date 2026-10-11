#!/usr/bin/env bash
# One-time (idempotent) server setup: deploy checkout, systemd timer, nginx container, first deploy.
# Run as root on the server: bash deploy/setup.sh
set -euo pipefail
BASE=/srv/oversight
REPO_URL=${REPO_URL:-https://github.com/RazinAleksandr/Oversight.git}
PORT=${PORT:-80}

mkdir -p "$BASE"
[[ -d "$BASE/repo/.git" ]] || git clone -q "$REPO_URL" "$BASE/repo"
git -C "$BASE/repo" fetch -q origin main && git -C "$BASE/repo" reset -q --hard origin/main
chmod +x "$BASE/repo/deploy/deploy.sh"
cp "$BASE/repo/deploy/nginx.conf" "$BASE/nginx.conf"

install -m 644 "$BASE/repo/deploy/oversight-deploy.service" /etc/systemd/system/
install -m 644 "$BASE/repo/deploy/oversight-deploy.timer" /etc/systemd/system/
systemctl daemon-reload

"$BASE/repo/deploy/deploy.sh" --force

if ! docker inspect oversight-web >/dev/null 2>&1; then
  docker run -d --name oversight-web --restart unless-stopped -p "$PORT:80" \
    -v "$BASE:$BASE:ro" -v "$BASE/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.27-alpine
fi
systemctl enable --now oversight-deploy.timer
echo "ok: serving $BASE/current on port $PORT"
