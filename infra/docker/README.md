# UniVerse Docker validation

This layer is for repeatable backend, Worker, fault, security, and k6 validation. It is not a production runtime and does not containerize React Native, emulators, signing, EAS, Cloudflare deployment, or push-device testing.

## Source-of-truth boundaries

- `npx supabase@2.116.0` and `supabase/config.toml` own the only local Postgres/Auth/Storage/Realtime stack. Compose never starts a second database.
- Hosted Supabase, Cloudflare, and EAS remain provider managed.
- The load profile uses a deterministic synthetic RPC envelope to verify k6 scripts and semantic thresholds. Its numbers are not capacity evidence; release capacity still requires the credentialed staging k6 suite.
- Toxiproxy validates timeout/reset/latency/outage recovery against a synthetic HTTP provider contract. No production credentials or data enter these containers.
- No Mailpit service is added because this repository has no Docker-owned auth-mail contract. No scanner product is invented; the existing provider adapter remains fail-closed and is exercised by the repository contract suite.

## Toolchain parity

The tooling image pins the same Node major that every GitHub Actions workflow selects, by explicit
version and immutable digest. `npm run guard:toolchain-parity` fails closed when the workflows and
`Dockerfile.tooling` disagree, so the containerized quality gate cannot silently diverge from CI.

Because the image copies an explicit allowlist of validation inputs rather than the whole tree, a
contract test that starts reading a new source file would pass on the host and fail in the
container. `npm run guard:docker-test-manifest` parses the `COPY` manifest and the staged
`*.test.mjs` files and fails closed when a test reads a file the image does not copy.

## Commands

- `npm run docker:config` validates every Compose profile and dependency graph.
- `npm run docker:up:test` starts the canonical Supabase CLI stack and builds the tooling image, leaving the stack ready.
- `npm run docker:test` replays migrations, runs DB lint, the SQL validation pack, pgTAP RLS contracts, a disposable-schema dump/restore probe inside the canonical database, origin/report/push contracts, Worker tests, types, and Wrangler dry-run.
- `npm run docker:resilience` checks baseline, fixed latency, peer reset, provider outage, and recovery through Toxiproxy.
- `npm run docker:load` runs short synthetic smoke and sustained k6 gates.
- `npm run docker:security` runs Hadolint, creates a CycloneDX npm SBOM, and fails on fixable HIGH/CRITICAL Trivy findings.
- `npm run docker:evidence` verifies every profile artifact, binds it to the checked-out commit/tree and CI run, and writes an aggregate SHA-256 manifest.
- `npm run docker:down` stops Compose containers/networks and preserves volumes/artifacts.
- `DOCKER_CLEAN_CONFIRM=YES npm run docker:clean` explicitly removes only this Compose project's volumes and `artifacts/docker`.

All services run with a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, non-root users, bounded CPU/memory/PIDs, and narrow tmpfs mounts. The validation network is internal; only the Trivy scanner has outbound access to update its vulnerability database. No Docker socket, cloud credentials, broad host mount, production token, or real user fixture is mounted. All three build-context ignore files are identical default-deny allowlists, and the tooling Dockerfile copies only the exact validation inputs; a second in-image guard rejects credential-like files outside dependency `node_modules`.

Generated evidence is written to ignored `artifacts/docker` and includes the Git commit/tree, CI run identity, dirty-worktree flag, and checksums. CI refuses to run from a dirty checkout, and the aggregate manifest is created only after every required artifact matches the candidate SHA. Local images from a dirty tree use a `dirty-<SHA-prefix>` tag; only a clean checkout receives the `sha-<SHA-prefix>` tag. Failures, including cleanup failures, return non-zero; profile wrappers always remove their Compose containers and networks.
