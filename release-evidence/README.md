# Release Evidence Folder

This folder is a template location for AAuniverse release evidence.

Create one folder per final release candidate:

```text
release-evidence/<version>/<commit-sha>/
  00-scope-and-adr/
  01-security/
  02-tests-and-coverage/
  03-android/
  04-ios/
  05-performance/
  06-load-and-database/
  07-accessibility-ux/
  08-observability/
  09-store-privacy/
  10-rollout-rollback/
  GO-NO-GO.md
```

Allowed contents:

- redacted reports
- command output summaries
- run IDs
- dashboard links
- signing fingerprints or metadata
- screenshots that do not contain private user data
- signed decision records

Forbidden contents:

- private keys
- keystores
- provisioning profile secrets
- service-role keys
- auth tokens
- production user PII
- raw production database dumps

The final GO decision must reference the same commit SHA for automated checks, staging
runtime evidence, signed Android/iOS artifacts, privacy/store checks, observability, and
rollback rehearsal.
