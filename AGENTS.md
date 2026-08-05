# Project workflow

- Treat routine changes as local-only. Do not deploy unless the user explicitly
  asks for deployment.
- Do not run automatic browser visual QA unless the user explicitly asks for it
  or the preview environment materially changes. Use deterministic game tests,
  local/production builds, artifact validation, and a local HTTP smoke check.
- Keep one warm checkout. Restore a newer validated source ZIP with
  `scripts/restore-source-overlay.sh`; it preserves Git metadata, `node_modules`,
  and the npm cache instead of deleting and reinstalling them.
- Run `npm run install:ci` only when the lockfile/runtime stamp does not match.
  A matching install is reused without network access or `npm ci`.
- During implementation, use `npm run test:quick` after a coherent batch of
  edits. Run `npm run verify:local` exactly once as the final release gate; do
  not duplicate its builds or validations unless diagnosing a failure.
- Commit every validated task locally so the warm checkout remains the current
  baseline. Workspace cleanup outside this repository is not controlled by the
  project, so the Library ZIP remains the durable recovery source.
- Keep the downloadable source ZIP and its existing ChatGPT Library item on
  the latest validated local commit.
