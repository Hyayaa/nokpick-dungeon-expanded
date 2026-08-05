#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

echo "[verify] lint and game regression checks"
npm run lint
npm run test:game
npm run test:perf

echo "[verify] dependency-free local bundle"
npm run build:local

echo "[verify] production build, artifact checks, and rendered metadata"
npm test

echo "[verify] all local release checks passed"
