# Local Secrets

This directory is intentionally ignored except for this README.

Do not commit private keys, service-account JSON, keystores, provisioning material,
auth tokens, or provider credentials. Release and submit jobs must read those values
from GitHub Actions, EAS, Supabase, Sentry, Apple, Google Play, or local OS secret
stores.

If a credential was ever committed, treat it as exposed until the provider confirms
revocation or rotation and audit-log review is complete.
