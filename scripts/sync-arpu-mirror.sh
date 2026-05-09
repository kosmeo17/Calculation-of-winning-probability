#!/usr/bin/env bash
# 将 ARPU计算 目录下的静态页镜像为「胜出概率」仓库的 symlink，保证一改两边一致。
# 用法：在 Calculation-of-winning-probability 根目录执行 ./scripts/sync-arpu-mirror.sh
# 强制覆盖已有普通文件：FORCE=1 ./scripts/sync-arpu-mirror.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${ROOT}/../ARPU计算"
REL_PREFIX="../Calculation-of-winning-probability"
FILES=(app.js index.html styles.css)

if [[ ! -d "$DEST_DIR" ]]; then
  echo "error: mirror dir not found: $DEST_DIR" >&2
  exit 1
fi

for f in "${FILES[@]}"; do
  canon="$ROOT/$f"
  dest="$DEST_DIR/$f"
  target="${REL_PREFIX}/${f}"

  if [[ ! -e "$canon" ]]; then
    echo "error: missing canonical file: $canon" >&2
    exit 1
  fi

  if [[ -L "$dest" ]]; then
    cur="$(readlink "$dest")"
    if [[ "$cur" == "$target" ]]; then
      echo "OK: $f -> $target"
      continue
    fi
  fi

  if [[ -e "$dest" && ! -L "$dest" ]]; then
    if [[ "${FORCE:-}" == "1" ]]; then
      rm -f "$dest"
      echo "removed regular file, replacing with symlink: $f"
    else
      echo "skip: $dest exists as a regular file (set FORCE=1 to replace with symlink)" >&2
      continue
    fi
  fi

  ln -sf "$target" "$dest"
  echo "linked: $dest -> $target"
done
