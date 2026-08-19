#!/bin/bash
set -Eeuo pipefail

cd "${COZE_WORKSPACE_PATH}"
if [ -f "./.cozeproj/scripts/init_env.sh" ]; then
    echo "⚙️ Initializing environment..."
    # 使用 bash 执行，确保即使没有 x 权限也能跑
    bash ./.cozeproj/scripts/init_env.sh
else
    echo "⚠️ Warning: init_env.sh not found, skipping environment init."
fi
echo "Installing dependencies..."
# 安装所有依赖（包含 Taro 核心和 React）
pnpm install

echo "Building the Taro project..."
# 串行构建部署所需产物，避免并行构建内存峰值过高导致部署容器 OOM 被杀
# - server: 运行时服务（deploy_run.sh 启动 server/dist/main.js）
# - weapp: 微信小程序包（dist/）
pnpm build:server
pnpm build:weapp

echo "Build completed successfully! Assets are in /dist"
