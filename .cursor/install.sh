#!/usr/bin/env bash
# Cloud Agent install for dsh-yzj.
#
# dsh-yzj is a plugin BUNDLE for DeepSeek Harness. Its workspace packages depend
# on the harness via `link:../../../deepseek-harness/...` (see packages/*/package.json
# and AGENTS.md: "兄弟 checkout 是唯一事实源"). Because this repo is checked out at
# /workspace, that link path resolves to exactly /deepseek-harness, so the sibling
# harness MUST live there. The harness client packages ship their type/`lib`
# artifacts only after a build, so we clone the harness at the version this bundle
# targets (0.1.2-alpha.5) and build its libs before installing the workspace.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- Node -------------------------------------------------------------------
# package.json requires node ^22.19 || >=24; the base image's default `node`
# (exec-daemon) is 22.14. nvm ships a compatible 22.22.x — make it the default
# so interactive shells and this script agree.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
NODE_VERSION="$(nvm version 22 2>/dev/null || true)"
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" = "N/A" ]; then
  nvm install 22
  NODE_VERSION="$(nvm version 22)"
fi
nvm alias default "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION" >/dev/null
export PATH="$NVM_DIR/versions/node/$NODE_VERSION/bin:$PATH"
corepack enable >/dev/null 2>&1 || true
echo "node $(node -v) / pnpm $(pnpm -v)"

# --- Sibling harness checkout ----------------------------------------------
HARNESS_DIR=/deepseek-harness
HARNESS_TAG=dsh-v0.1.2-alpha.5
HARNESS_REPO=https://github.com/deepseek-ai/deepseek-harness.git

if [ ! -e "$HARNESS_DIR/.git" ]; then
  # /deepseek-harness sits at the filesystem root, owned by root; create it once
  # and hand it to the current (build/agent) user.
  if [ ! -d "$HARNESS_DIR" ]; then
    sudo mkdir -p "$HARNESS_DIR"
    sudo chown "$(id -u):$(id -g)" "$HARNESS_DIR"
  fi
  git clone --depth 1 --branch "$HARNESS_TAG" "$HARNESS_REPO" "$HARNESS_DIR"
fi

pushd "$HARNESS_DIR" >/dev/null
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
# The linked packages resolve their types from lib/types; build once (idempotent).
if [ ! -f packages/client/store/lib/types/index.d.ts ]; then
  pnpm run build:lib
fi
popd >/dev/null

# --- Workspace --------------------------------------------------------------
pushd "$REPO" >/dev/null
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
popd >/dev/null

echo "dsh-yzj install complete."
