#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
zig_command="${SHATTERED_ZIG:-zig}"
linker_command="${SHATTERED_PE_LINKER:-ld}"

command -v "${zig_command}" >/dev/null 2>&1 || {
  echo "Zig compiler not found. Install Zig 0.14+ or set SHATTERED_ZIG." >&2
  exit 127
}
command -v "${linker_command}" >/dev/null 2>&1 || {
  echo "GNU ld with i386pep support was not found." >&2
  exit 127
}

build_dir="$(mktemp -d)"
trap 'rm -rf "${build_dir}"' EXIT

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
  -o "${project_root}/ShatteredWebDungeon-Local.exe" \
  "${build_dir}/launcher.obj" \
  "${build_dir}/libws2_32.a" \
  "${build_dir}/libshell32.a" \
  "${build_dir}/libuser32.a" \
  "${build_dir}/libkernel32.a"

echo "Built ShatteredWebDungeon-Local.exe"
