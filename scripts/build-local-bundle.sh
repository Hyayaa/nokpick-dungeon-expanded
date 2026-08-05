#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${project_root}/local-dist"

cd "${project_root}"
npx vite build --config vite.local.config.ts

mkdir -p "${output_dir}/assets"
cp -R "${project_root}/public/assets/." "${output_dir}/assets/"
cp "${project_root}/public/favicon.svg" "${output_dir}/favicon.svg"

test -f "${output_dir}/index.html"
test -f "${output_dir}/assets/sprites/player.png"

echo "Built dependency-free local bundle:"
du -sh "${output_dir}"
