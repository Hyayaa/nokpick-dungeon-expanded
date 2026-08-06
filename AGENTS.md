# Project workflow

- Treat routine changes as local-only. Do not deploy unless the user explicitly
  asks for deployment.
- Do not run automatic browser visual QA unless the user explicitly asks for it
  or the preview environment materially changes. Use deterministic game tests,
  local/production builds, artifact validation, and a local HTTP smoke check.
- Keep one warm Git checkout and continue routine work on a focused feature or
  fix branch created from the current remote baseline.
- Run `npm run install:ci` only when the lockfile/runtime stamp does not match.
  A matching install is reused without network access or `npm ci`.
- During implementation, use `npm run test:quick` after a coherent batch of
  edits. Run `npm run verify:local` exactly once as the final release gate; do
  not duplicate its builds or validations unless diagnosing a failure.
- Commit every validated task and publish it through a draft GitHub Pull
  Request so the remote branch remains the durable recovery source.
- Do not build or distribute source or Windows ZIP packages unless the user
  explicitly requests a packaged release.
