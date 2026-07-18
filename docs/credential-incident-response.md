# Credential Incident Response

Updated: 2026-07-15

This file defines the evidence required to close any historic secret exposure for this repo. Do not store secret values here.

## Inventory

Track only metadata:

- Provider and credential type: Apple, Android signing, Firebase Admin, Supabase service-role, Sentry, EAS, GitHub.
- Credential ID or fingerprint.
- Owner.
- First suspected exposure date.
- Rotate/revoke decision.
- Rotation or revocation date.
- Access-log review link.
- Store signing continuity note, if the credential is a signing identity.

## Closure Requirements

- Current tree secret scan is clean.
- Full git history secret scan is clean, or every finding has a linked rotate/revoke record.
- Provider access logs were reviewed from the suspected exposure date.
- Store signing keys were not rotated unless platform continuity procedures were approved.
- EAS, GitHub, Supabase, Firebase, Sentry, and Apple secrets are stored only in provider secret stores.

## Commands

```powershell
npm run security:secrets
npm run security:secrets:history
```

`security:secrets:history` requires `gitleaks` and a full clone or `fetch-depth: 0` checkout.
