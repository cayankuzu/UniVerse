# Provider state audit

Observed: 2026-08-31 (Europe/Istanbul)

This record contains only non-secret control-plane observations. Provider state can change after
the observation time, so the protected workflows must capture fresh same-SHA evidence before a
release. Repository or local test success is not substituted for a provider/runtime result.

## Automated in this hardening run

- GitHub environments `development`, `preview`, and `production` exist. Production is limited to
  protected branches, requires the existing independent collaborator `eheperson`, and prevents
  self-review. This replaces the original self-review deadlock in which the workflow initiator was
  also the only permitted reviewer.
- `main` requires a pull request, strict up-to-date status checks, resolved conversations, linear
  history, one approval, and the `internal-verify`, `secret-scan`, `sast`, and
  `docker-validate-immutable` checks. All four required checks are bound to the GitHub Actions app
  (`app_id=15368`), so a generic third-party status context cannot satisfy them. Force-push and
  deletion remain disabled and administrator enforcement remains enabled.
- The existing EAS project identity remains `@cayanns-team/universe`, project
  `c7565eaa-d013-430f-9576-217c4beefa3f`. Missing `development` and `preview` update channels and
  their same-named branches were created without publishing an update. The existing `production`
  channel/branch was not changed.
- A canonical local Supabase stack replays the migration chain through `supabase/config.toml`.
  Local SQL/RLS validation and a separate disposable PostgreSQL dump/restore drill use synthetic
  or schema-only data; production was neither reset nor migrated by this run.

## Local Docker containment incident and remediation

- An initial, local-only tooling image used a broad build-context copy before the Docker layer was
  hardened. That build admitted this workstation's ignored `.secrets` directory into the local
  build context and was treated as a local disclosure to the trusted daemon/cache. The suspect
  image was never pushed, exported, attested, uploaded, or used as release evidence.
- The exact suspect images and their dependent broad-copy cache records were removed. The final
  Dockerfile uses an exact source allowlist, all three Docker ignore files are identical
  default-deny lists, and an in-image guard rejects credential-like files. A fresh audit reported
  `broad_copy_records=0`; no `universe-validation-tooling:sha-*` or `dirty-*` image remained before
  the final rebuild.
- This proves local containment on the inspected trusted daemon, not that a separate untrusted
  daemon never observed a secret. If workstation/daemon trust is in doubt, follow
  [credential-incident-response.md](credential-incident-response.md) and rotate only the affected
  credentials; no automatic production credential rotation was attempted without provider scope.

## Verified fail-closed external boundaries

- Wrangler authentication can read the selected Cloudflare account, but neither
  `universe-edge-preview` nor `universe-edge-production` exists there. No Worker, route, secret,
  DNS, WAF, or deployment state was created.
- No isolated UniVerse preview Supabase project is present. Development and preview Worker origins
  therefore remain `.invalid`; they must not be replaced with the production project as a shortcut.
- EAS `development` and `preview` environments contain no remote variables. Production exposes only
  a masked iOS service-file secret in the CLI inventory. No value was read or copied, and no preview
  build/update was started with missing environment parity.
- The three GitHub environments contain no environment secret names. Their workflows therefore
  remain fail-closed until separately scoped preview/production credentials are provisioned; no
  repository-level credential was copied into them as a shortcut.
- The latest observed signed iOS production build is runtime/build `1.0.133 (133)`, not the current
  `1.0.134 (134)` candidate. The production update branch has no published update group. No OTA
  capability or rollout is claimed from source configuration.
- The available Sentry upload credential returned `401` in the prior current-version build run.
  It was not weakened, copied, or treated as symbolication/release-health evidence.
- No physical Android or iOS device is attached to this run. Emulator, Jest, Docker, and artifact
  inspection cannot close the two-platform push/deep-link/accessibility/performance matrix.

## Consequence

It is safe to merge repository hardening only after the required same-SHA checks pass. It is not
safe to deploy Cloudflare preview, publish OTA, migrate production, submit stores, or declare
release GO until isolated provider configuration and the runtime evidence gates in
[release-readiness.md](release-readiness.md) are complete.
