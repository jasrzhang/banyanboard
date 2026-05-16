# UAT Configuration

This file is created and maintained by `/banyan-uat-init`. It carries project-specific UAT infrastructure (base URLs, persona credentials, auth strategy, viewport presets, isolation strategy).

**Companion file**: `memory-bank/projectConfig.md` `## UAT` section carries project-wide *ergonomic* defaults (default sections, artifact git policy). Keep secrets/infra here; keep ergonomics there.

---

**Status**: Configured
**Last Updated**: 2026-05-16

## Environments

| Name | Base URL              | Default |
|------|-----------------------|---------|
| dev  | http://localhost:3000 | yes     |

> `/banyan-uat` refuses to run against environments where `name == "prod"`. There is no override flag — production UAT must be intentionally invoked via a separate (future) command.

## Auth

- **Strategy**: token+fallback
  - `token` — inject localStorage/cookies from `.auth/<persona>.json`, hard-reload. Fastest.
  - `login` — drive the IDP UI. Slower but resilient to expired tokens.
  - `token+fallback` (default) — try token first; on auth failure or 401, fall back to `login` and cache fresh tokens back to `.auth/<persona>.json`.
- **Credential vault**: `.auth/` (must be in `.gitignore`)
- **Token file pattern**: `.auth/<persona>.json`
- **Login selectors** (used when strategy includes `login`):
  - username: `input[name="username"]`
  - password: `input[name="password"]`
  - submit:   `button[type="submit"]`
  - post-login wait: url matches `/dashboard`

## Persona Map

Each row maps a persona role discovered in `productBrief.md` → a test account → an auth reference (token path or env var name for password).

| Role  | Test Account       | Auth Reference   |
|-------|--------------------|------------------|
| admin | [to be configured] | .auth/admin.json |
| user  | [to be configured] | .auth/user.json  |

## Viewports

| Name    | Width | Height | Default For    |
|---------|-------|--------|----------------|
| desktop | 1280  | 720    | all non-mobile |
| mobile  | 375   | 667    | mobile section |

## Execution

- **max_parallel_tabs**: 4
- **isolation_strategy**: auto          # auto | same-persona-only | incognito
  - `auto` (default) — probes incognito support at run start; falls back to `same-persona-only` if unavailable.
  - `same-persona-only` — explicit conservative. Walkers with the same resolved persona run in parallel; walkers with different personas serialize.
  - `incognito` — reserved for a future Claude-in-Chrome release.
- **auth_cookies_to_clear**:            # none — uses localStorage.clear() only
- **logout_url**: /logout               # path to hit for forced logout
- **screenshot_retention**: keep 10 most recent runs
- **default_timeout_ms**: 15000
- **ux_pattern_check**: enabled

## Notes

- The credential vault directory (`.auth/`) is already in `.gitignore`.
- UAT artifacts may include screenshots that contain test-account PII; configure `artifact_git_policy` in `projectConfig.md` accordingly.
- `--persona-override` flags warn when the supplied address does not match the project's documented test-account pattern. Update the Persona Map rather than relying on overrides for repeated runs.
- Update the Persona Map test account emails before running `/banyan-uat` for the first time.
