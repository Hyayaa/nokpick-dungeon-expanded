#!/usr/bin/env bash
set -euo pipefail

archive="${1:-}"
checkout="${2:-$(pwd)}"

if [[ -z "${archive}" || ! -f "${archive}" ]]; then
  echo "Usage: $0 <validated-source.zip> [checkout-directory]" >&2
  exit 64
fi
if [[ ! -d "${checkout}" || ! -f "${checkout}/package.json" ]]; then
  echo "The checkout must be an existing project directory with package.json." >&2
  exit 64
fi

command -v unzip >/dev/null || {
  echo "restore-source-overlay.sh requires unzip." >&2
  exit 69
}
command -v rsync >/dev/null || {
  echo "restore-source-overlay.sh requires rsync." >&2
  exit 69
}

temporary_root="$(mktemp -d)"
cleanup() {
  rm -rf -- "${temporary_root}"
}
trap cleanup EXIT

echo "[restore] validating source archive"
unzip -tq "${archive}" >/dev/null
unzip -q "${archive}" -d "${temporary_root}"

source_root="${temporary_root}"
if [[ ! -f "${source_root}/package.json" ]]; then
  mapfile -t roots < <(
    find "${temporary_root}" -mindepth 1 -maxdepth 1 -type d -print
  )
  if [[ "${#roots[@]}" -ne 1 || ! -f "${roots[0]}/package.json" ]]; then
    echo "The archive must contain a project root or one project directory." >&2
    exit 65
  fi
  source_root="${roots[0]}"
fi

echo "[restore] overlaying source while preserving the warm checkout"
rsync \
  -a \
  --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.sites-runtime/' \
  "${source_root}/" \
  "${checkout}/"

echo "[restore] source updated; Git metadata, dependencies, and npm cache were reused"
