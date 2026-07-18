# Media Upload Security Runbook

## Binding Invariants

- Album media publication requires an `upload_sessions` row owned by the uploader.
- Every item carries the client-observed byte size and SHA-256 checksum.
- An item remains private and `pending`/`quarantined` until the scanner returns a signed-in-service response with provider, MIME, size, SHA-256, and `passed`/`failed` verdict.
- Missing scanner configuration, timeout, malformed response, checksum mismatch, MIME mismatch, or size mismatch fails closed.
- `album_photos_require_verified_upload` performs the final item/session transition in the album insert transaction. The client finalize endpoint only verifies that transaction.
- Rejected object removal failures enter `storage_cleanup_jobs`; retries use exponential backoff and stop in `dead_letter` after 20 attempts.

## Scanner Contract

Edge runtime secrets:

- `MEDIA_SCAN_WEBHOOK_URL`
- `MEDIA_SCAN_WEBHOOK_TOKEN`
- `MEDIA_SCAN_TIMEOUT_MS` between `2000` and `30000`; default `12000`

The webhook receives `bucket`, `objectPath`, `ownerId`, `contentType`, and `sizeBytes`. A successful response must contain:

```json
{
  "verdict": "passed",
  "provider": "scanner-provider",
  "checksumSha256": "64-lowercase-hex-characters",
  "contentType": "image/jpeg",
  "sizeBytes": 12345,
  "reason": null
}
```

The scanner must inspect object bytes from the private bucket; it must not trust request MIME metadata. Token comparison, provider allowlisting, scanner egress restrictions, malware signature updates, and scanner-side audit retention are infrastructure responsibilities.

## Deployment Order

1. Provision the scanner and its secrets in staging.
2. Apply `20260718153000_secure_upload_state_machine.sql`.
3. Deploy the server function and verify health reports `mediaScannerConfigured=true`.
4. Run valid image/video, spoofed MIME, checksum mismatch, scanner timeout, and scanner 5xx cases.
5. Deploy the mobile client only after the server and migration are healthy.
6. Repeat in production and set `RELEASE_MEDIA_SCANNER_CONFIRMED=true` only after evidence is attached to the release SHA.

## Monitoring and Recovery

- Alert on scanner 5xx/timeout rate, `scan_state='failed'`, `storage_cleanup_jobs` backlog, `dead_letter`, and upload session age.
- A rising pending cleanup count means object deletion or storage permissions are degraded.
- Retry pending cleanup through the owner-scoped sweep endpoint or an authorized operations worker using `claim_storage_cleanup_jobs`.
- Investigate every dead-letter object; delete it through a service-role operations path and record the incident before marking the job complete.
- Never restore the legacy `skipped` verdict. During scanner outage, disable new uploads or keep drafts queued; existing reads remain available.

## Rollback

Do not roll back to fail-open publishing. If scanner or migration health is uncertain, stop new album uploads at the product/feature-control layer, retain private quarantined objects, and keep projection reads active.
