#!/usr/bin/env bash
# Server-side continuous deploy (run every minute by oversight-deploy.timer).
# Fetches origin/main into $BASE/repo; when it moved, tests + builds it and atomically
# switches $BASE/current to the new release, which nginx serves. Usage: deploy.sh [--force]
# The body is wrapped in main() so bash parses it fully before `git reset` rewrites this file.
set -euo pipefail

main() {
  local base=${OVERSIGHT_BASE:-/srv/oversight}
  local repo=$base/repo
  exec 9>"$base/deploy.lock"
  flock -n 9 || exit 0

  cd "$repo"
  git fetch -q origin main
  local sha cur failed
  sha=$(git rev-parse origin/main)
  cur=$(cat "$base/deployed" 2>/dev/null || true)
  failed=$(cat "$base/failed" 2>/dev/null || true)
  if [[ "${1:-}" != "--force" ]]; then
    [[ "$sha" == "$cur" ]] && exit 0
    [[ "$sha" == "$failed" ]] && exit 0 # don't rebuild a broken commit every minute
  fi

  echo "deploying ${sha:0:7} (live: ${cur:0:7})"
  echo "$sha" >"$base/failed" # cleared on success
  git reset -q --hard "$sha"
  npm ci --no-audit --no-fund --loglevel=error
  npm test
  npm run build

  mkdir -p "$base/releases"
  rm -rf "$base/releases/$sha"
  cp -r dist "$base/releases/$sha"
  ln -sfn "releases/$sha" "$base/current.tmp"
  mv -T "$base/current.tmp" "$base/current"
  echo "$sha" >"$base/deployed"
  rm -f "$base/failed"
  # nginx config lives in the repo too; apply it when it changed
  if ! cmp -s deploy/nginx.conf "$base/nginx.conf"; then
    cp deploy/nginx.conf "$base/nginx.conf"
    docker exec oversight-web nginx -s reload || echo "warning: nginx reload failed"
  fi
  # keep the 3 newest releases
  ls -1dt "$base"/releases/* | tail -n +4 | xargs -r rm -rf
  echo "deployed ${sha:0:7}"
}

main "$@"
