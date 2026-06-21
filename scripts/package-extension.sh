#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -e "console.log(require('${ROOT_DIR}/package.json').version)")"
OUT_DIR="${ROOT_DIR}/dist"
OUT_FILE="${OUT_DIR}/creator-chapter-helper-v${VERSION}.zip"

mkdir -p "${OUT_DIR}"
rm -f "${OUT_FILE}"

cd "${ROOT_DIR}"
zip -r "${OUT_FILE}" \
  manifest.json \
  assets/icons \
  src \
  -x '*.DS_Store'

echo "${OUT_FILE}"
