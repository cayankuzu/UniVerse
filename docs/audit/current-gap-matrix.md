# Current gap matrix

Audit date: 2026-09-04
Baseline reviewed: `1caace7fa52dd56e8fd968983b1b1a1ea36da7cd`
Candidate: `e22e5c4f0de2d82f6fcecddfd85fb44c810b6699`
Version / runtime: `1.0.134` / `1.0.134`

This matrix records what was re-verified against the working tree rather than accepted from an
earlier report. Status values follow the audit contract:

- `CONFIRMED` — the finding still reproduces.
- `FIXED IN THIS CANDIDATE` — reproduced, then fixed and locked behind a guard.
- `NOT REPRODUCIBLE` — did not reproduce against this tree.
- `RUNTIME/PROVIDER EVIDENCE REQUIRED` — cannot be settled from the repository.

## Findings re-verified in this pass

|   # | Finding                                                                                                     | Status                             | Evidence                                                                                                                              |
| --: | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | `searchProjectionApi.test.ts` mocked the runtime config without `APP_ENV`, breaking the public-env contract | FIXED IN THIS CANDIDATE            | Suite failed to run; the mock now spreads the real module and the suite passes                                                        |
|   2 | `guard:security-mobile` asserted a `hardSignOut` call shape the source had outgrown                         | FIXED IN THIS CANDIDATE            | Guard failed on green code; assertions rewritten and extended to cover the delete-account push purge                                  |
|   3 | `guard:dependency-audit` failed on four unapproved production advisories                                    | FIXED IN THIS CANDIDATE            | `browserslist` pinned to a genuinely patched `^4.28.8`; the rest documented with reachability analysis                                |
|   4 | `decode-uri-component` denial of service was reachable through React Navigation deep-link parsing           | FIXED IN THIS CANDIDATE            | Custom `getStateFromPath` strips query/fragment; guard + `rootNavigation.deepLink.test.ts` prove hostile input yields identical state |
|   5 | Docker quality image ran Node 26 while every CI workflow ran Node 22                                        | FIXED IN THIS CANDIDATE            | Image repinned to `node:22.23.2` by digest; `guard:toolchain-parity` fails closed on divergence                                       |
|   6 | Two contract-test dependencies were missing from the tooling image `COPY` manifest                          | FIXED IN THIS CANDIDATE            | Container profile failed while the host passed; `guard:docker-test-manifest` now catches that class                                   |
|   7 | Semgrep scanned Supabase CLI local-stack state, so local and CI scanned different files                     | FIXED IN THIS CANDIDATE            | `supabase/.temp` and `.branches` excluded from the scan stage; Semgrep reports 0 findings                                             |
|   8 | `albums.owner.ts` existed twice, identical except import depth                                              | FIXED IN THIS CANDIDATE            | Data layer owns it, feature re-exports; `guard:duplicate-modules` compares 1029 modules                                               |
|   9 | `authFixtureSeed.ts` shipped four exported fixtures nothing referenced                                      | FIXED IN THIS CANDIDATE            | Module reduced 193 → 86 lines; unused `fixtureMedia` groups and keys removed with it                                                  |
|  10 | Student registration name field read `"Adin ve Soyadin"`                                                    | FIXED IN THIS CANDIDATE            | Only ASCII-folded string a user sees; `guard:turkish-copy` covers display attributes with zero false positives across 909 modules     |
|  11 | Product surface unchanged (24 routes/screens, 3 tabs, 11 notification types, 4 permissions)                 | NOT REPRODUCIBLE (no drift)        | `guard:no-new-product-surface` reports the source still equals the frozen snapshot                                                    |
|  12 | `guard:expo-doctor` fails on a Node 26 workstation                                                          | CONFIRMED (environment)            | Two legacy-package probes abort because `npm explain` exits non-zero for absent packages; passes on the pinned CI Node 22             |
|  13 | Jest prints a worker-teardown warning on high-parallelism local runs                                        | CONFIRMED (cosmetic)               | No individual suite reproduces it; `test:ci` and `test:coverage` use `--runInBand` and print nothing. No suite fails                  |
|  14 | `guard:k6-env` blocks without staging credentials                                                           | CONFIRMED (intended)               | Fail-closed by design; credentialed staging load remains an external gate                                                             |
|  15 | Signed Android/iOS artifacts, device matrix, provider state, store review                                   | RUNTIME/PROVIDER EVIDENCE REQUIRED | Cannot be produced from this workstation; tracked as E2–E8 in `quality/release-scorecard.json`                                        |

## Automated gates re-run against this candidate

| Gate                                                          | Result                                              |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `npm run check` (typecheck + all guards + Worker)             | Pass                                                |
| `npm run lint` (zero warnings)                                | Pass                                                |
| `npm run format:check:all`                                    | Pass                                                |
| Jest                                                          | 321 suites, 1084 tests, all passing                 |
| `npm run guard:diff-coverage`                                 | 93.22% changed-line coverage against a 90% gate     |
| `npm run security:sast`                                       | 0 findings                                          |
| `npm run security:secrets` / `:history`                       | No leaks in the working tree or across full history |
| `npm run guard:dependency-audit`                              | Pass with four documented, time-bounded advisories  |
| `npm run docker:test` / `:resilience` / `:load` / `:security` | Pass; 8 checksummed artifacts bound to a clean tree |

## What is deliberately not claimed

Every one of the 35 areas remains unscored and `NO-GO` in
[quality/release-scorecard.json](../../quality/release-scorecard.json).
`npm run guard:release-scorecard` refuses a score unless the area's `evidenceLevel` is
`RUNTIME_VERIFIED` and its `missingEvidence` list is empty, so the scoring rule is enforced rather
than promised. Repository work being complete is not the same as a release being ready, and the
outstanding evidence is external: signed artifacts, two-platform device runs, credentialed staging
load and restore, provider dashboards, and store review.
