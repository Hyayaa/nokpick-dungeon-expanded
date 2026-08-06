#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
zig_command="${SHATTERED_ZIG:-zig}"
linker_command="${SHATTERED_PE_LINKER:-ld}"
launcher_output="${project_root}/ShatteredWebDungeon-Local.exe"

validate_existing_launcher() {
  node - "${launcher_output}" <<'NODE'
const { readFileSync } = require("node:fs");
const path = process.argv[2];
const bytes = readFileSync(path);
if (bytes.length < 256 || bytes.subarray(0, 2).toString("ascii") !== "MZ") {
  process.exit(1);
}
const pe = bytes.readUInt32LE(0x3c);
if (
  pe + 94 > bytes.length ||
  bytes.subarray(pe, pe + 4).toString("binary") !== "PE\u0000\u0000" ||
  bytes.readUInt16LE(pe + 4) !== 0x8664 ||
  bytes.readUInt16LE(pe + 24 + 68) !== 2
) process.exit(1);
NODE
}

command -v "${zig_command}" >/dev/null 2>&1 || {
  if [[ -f "${launcher_output}" ]] && validate_existing_launcher; then
    echo "Zig compiler unavailable; reused the validated unchanged Windows launcher"
    exit 0
  fi
  echo "Zig compiler not found. Install Zig 0.14+ or set SHATTERED_ZIG." >&2
  exit 127
}
command -v "${linker_command}" >/dev/null 2>&1 || {
  echo "GNU ld with i386pep support was not found." >&2
  exit 127
}

build_dir="$(mktemp -d)"
trap 'rm -rf "${build_dir}"' EXIT
zig_global_cache="${ZIG_GLOBAL_CACHE_DIR:-${build_dir}/zig-global-cache}"
zig_local_cache="${ZIG_LOCAL_CACHE_DIR:-${build_dir}/zig-local-cache}"
mkdir -p "${zig_global_cache}" "${zig_local_cache}"

ZIG_GLOBAL_CACHE_DIR="${zig_global_cache}" \
ZIG_LOCAL_CACHE_DIR="${zig_local_cache}" \
"${zig_command}" cc \
  -target x86_64-windows-gnu \
  -c \
  -fno-builtin \
  -ffunction-sections \
  -fdata-sections \
  -Os \
  "${project_root}/tools/windows-launcher/launcher.c" \
  -o "${build_dir}/launcher.obj"

for library in kernel32 user32 shell32 ws2_32; do
  ZIG_GLOBAL_CACHE_DIR="${zig_global_cache}" \
  ZIG_LOCAL_CACHE_DIR="${zig_local_cache}" \
  "${zig_command}" dlltool \
    -m i386:x86-64 \
    -d "${project_root}/tools/windows-launcher/imports/${library}.def" \
    -l "${build_dir}/lib${library}.a"
done

"${linker_command}" \
  -mi386pep \
  --subsystem windows \
  --entry launcherEntry \
  --gc-sections \
  --dynamicbase \
  --nxcompat \
  --high-entropy-va \
  -s \
  -o "${launcher_output}" \
  "${build_dir}/launcher.obj" \
  "${build_dir}/libws2_32.a" \
  "${build_dir}/libshell32.a" \
  "${build_dir}/libuser32.a" \
  "${build_dir}/libkernel32.a"

echo "Built ShatteredWebDungeon-Local.exe"
