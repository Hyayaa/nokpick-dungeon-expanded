#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${project_root}/public/source/shattered-web-dungeon-source.zip"
temporary_archive="$(mktemp "${TMPDIR:-/tmp}/shattered-web-source.XXXXXX.zip")"
trap 'rm -f "${temporary_archive}"' EXIT
rm -f "${temporary_archive}"

cd "${project_root}"
mkdir -p "$(dirname "${output}")"

# Package only files tracked by the durable local Git baseline. Excluding the
# downloadable archive itself avoids recursive growth on every release.
git ls-files \
  | sed '\|^public/source/shattered-web-dungeon-source\.zip$|d' \
  | zip -q "${temporary_archive}" -@

unzip -tq "${temporary_archive}" >/dev/null
mv "${temporary_archive}" "${output}"
trap - EXIT

echo "Updated ${output}"
