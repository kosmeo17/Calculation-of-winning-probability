#!/usr/bin/env bash
# 兼容旧名：与 sync-arpu-mirror.sh 相同。
exec "$(cd "$(dirname "$0")" && pwd)/sync-arpu-mirror.sh" "$@"
