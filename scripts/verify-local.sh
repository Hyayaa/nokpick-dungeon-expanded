#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

echo "[verify] architecture, regression, and performance checks"
npm run test:quick

echo "[verify] dependency-free local bundle"
npm run build:local

echo "[verify] Windows launcher"
npm run build:launcher:windows

echo "[verify] local artifact checks"
npm run test:artifact

echo "[verify] production build, artifact checks, and rendered metadata"
npm test

echo "[verify] all local release checks passed"
