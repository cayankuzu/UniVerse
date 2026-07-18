# ADR-0001: Network Trust and Certificate Pinning

Status: accepted for the current release candidate repo baseline  
Date: 2026-07-14  
Owners: mobile, security, SRE

## Context

The app talks to Supabase, Sentry, Expo/EAS update infrastructure, and provider-owned
storage/CDN endpoints. Blind certificate pinning across these domains can turn routine
provider certificate rotation into a production outage. A JavaScript-only pin list would
also be misleading because it would not enforce trust in the native network stack.

The current threat model covers public Wi-Fi, user-installed CAs, proxy debugging,
rooted devices, token leakage through logs, and signed media URL replay.

## Decision

Do not add certificate pinning for the current release candidate unless the app is moved
behind an app-owned API domain with an owned certificate lifecycle and an emergency
rotation channel.

This is an explicit risk-acceptance decision, not a placeholder implementation.
No fake JS pin configuration is allowed.

## Compensating Controls

- Android cleartext traffic stays disabled by platform defaults and release config.
- TLS provider validation remains the native OS trust path.
- Mobile binaries must not contain service-role keys or provider private keys.
- Auth/session storage remains SecureStore-first.
- API redaction tests protect tokens, URL query tokens, email, and PII in logs.
- Signed media URLs are short lived and resolved through controlled helpers.
- `npm run security:verify:internal` and the release guard chain remain required.

## Revisit Triggers

- A dedicated first-party API gateway/domain becomes the only app data plane.
- Security review requires protection against enterprise/user-installed CA interception.
- A provider domain offers stable SPKI pin operations with documented backup pins.
- Incident response identifies TLS interception as a realistic abuse path.

## If Pinning Is Adopted Later

- Implement it in the native stack, not only in JS.
- Keep at least two active SPKI pins and one backup pin.
- Add a tested remote emergency bypass or staged rotation plan.
- Prove rollover in staging before production.
- Document owner, expiry, alerting, and rollback in the release evidence bundle.

## Release Evidence Required

For a 10/10 release claim, attach one of these to `release-evidence/<version>/<sha>/01-security/`:

- this ADR plus security-owner signoff that pinning remains intentionally out of scope; or
- native pinning implementation evidence, backup pin evidence, and a successful rotation test.
