#!/bin/bash
# 本地构建并安装 CC Switch 到 /Applications
set -e

APP_NAME="CC Switch"
APP_PATH="/Applications/${APP_NAME}.app"
BUNDLE_PATH="src-tauri/target/release/bundle/macos/${APP_NAME}.app"

cd "$(dirname "$0")/.."

echo "==> 关闭正在运行的 ${APP_NAME}..."
osascript -e "quit app \"${APP_NAME}\"" 2>/dev/null || true
sleep 1

echo "==> 构建 release 版本..."
pnpm build

echo "==> 安装到 /Applications..."
rm -rf "${APP_PATH}"
cp -rf "${BUNDLE_PATH}" "${APP_PATH}"

echo "==> 启动 ${APP_NAME}..."
open "${APP_PATH}"

echo "==> 完成！"
