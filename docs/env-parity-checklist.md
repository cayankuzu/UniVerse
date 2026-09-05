# Env Parity Checklist

## Mobil Runtime

- `EXPO_PUBLIC_DISABLE_LEGACY_EDGE_READS=true`
- `EXPO_PUBLIC_APP_ENV` ilgili EAS profiliyle ayni olmali: `development`, `preview` veya `production`
- Development ve preview icin `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` ve
  `EXPO_PUBLIC_SUPABASE_FUNCTIONS_BASE_URL` acikca verilmelidir; production fallback kabul edilmez.
- Preview Supabase URL'i production project ref'inden farkli, canonical
  `https://<20-char-ref>.supabase.co` origin'i olmalidir. Credentials, path, query ve fragment
  reddedilir. Functions URL ayni origin ve tam
  `/functions/v1/server/make-server-e3557d40` path'ini kullanmalidir.
- `EXPO_PUBLIC_CLOUDFLARE_GATEWAY_URL` bos birakilirsa secili trafik dogrudan Supabase origin'e
  gider. Preview'da etkinlestirilecekse HTTPS canonical preview origin'i ve ayrica farkli HTTPS
  `EXPO_PUBLIC_CLOUDFLARE_PRODUCTION_GATEWAY_URL` deny hedefi zorunludur. Production'da gateway
  etkinse bu iki production degeri canonical origin olarak tam eslesmelidir.
- Production Supabase origin'i yalniz tracked `SUPABASE_PROJECT_ID` projesi olabilir; arbitrary
  HTTPS/custom origin kabul edilmez. `EXPO_PUBLIC_APP_ENV` ve `EXPO_PUBLIC_RELEASE_CHANNEL` enumlari
  release profillerinde acik ve birbiriyle ayni olmalidir; typo development'a dusmez.
- `EXPO_PUBLIC_USE_PROJECTION_SEARCH=true`
- `EXPO_PUBLIC_USE_PROJECTION_EVENT_DETAIL=true`
- `EXPO_PUBLIC_USE_PROJECTION_ALBUM=true`
- `EXPO_PUBLIC_USE_OPTIMISTIC_CREATE_EVENT=true`
- `EXPO_PUBLIC_USE_OPTIMISTIC_PROFILE_UPDATE=true`

## Edge / Supabase

- `ENABLE_LEGACY_EDGE_READS=false`
- `ENABLE_COMPAT_ROUTES=false`
- `EDGE_SLOW_REQUEST_MS=400`
- `SUPABASE_URL` dogru proje URL'i olmali
- `SUPABASE_SERVICE_ROLE_KEY` dogru production/staging secret'i olmali
- Worker development/preview origin, issuer ve Supabase degerleri izole proje saglanana kadar
  `.invalid` kalmalidir; production proje ref'i preview icin kullanilamaz.
- `MEDIA_SCAN_WEBHOOK_URL` private bucket byte tarayicisini gostermeli
- `MEDIA_SCAN_WEBHOOK_TOKEN` staging ve production icin farkli secret olmali
- `MEDIA_SCAN_TIMEOUT_MS=12000` (izin verilen aralik `2000..30000`)

## Validation

- staging ve production icin tum env degerleri yan yana karsilastirilmali
- projection flag drift olmamali
- compat rollback flag normal durumda kapali olmali
- test/load-test ortaminda kullanilan env ayrica belgelenmeli

## Release Validation / CI

- `EXPO_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SUPABASE_DB_URL`
- `K6_SUPABASE_URL`
- `K6_SUPABASE_ANON_KEY`
- `K6_TEST_EMAIL`
- `K6_TEST_PASSWORD`
- `K6_PROFILE_USERNAME`
- `K6_EVENT_ID`
- `K6_PHOTO_ID`
- `K6_TARGET_PROFILE_ID` ve `K6_TARGET_CLUB_ID` (`K6_ENABLE_MUTATIONS=true` ise)
- `K6_NOTIFICATION_ID` (`K6_ENABLE_MUTATIONS=true` ise)
- `RELEASE_EDGE_HEALTHCHECK_URL`
- `RELEASE_SENTRY_HEALTHCHECK_CONFIRMED`
- `RELEASE_SENTRY_TEST_EVENT_CONFIRMED`
- `RELEASE_NATIVE_SYMBOLS_VERIFIED`
- `RELEASE_MEDIA_SCANNER_CONFIRMED`
- `DIFF_COVERAGE_BASE_SHA`

## Release Validation Notes

- `full` rehearsal ve `release:verify`, projection detay yollarini dogrulamak icin `K6_PROFILE_USERNAME`, `K6_EVENT_ID` ve `K6_PHOTO_ID` env'lerine baglidir.
- load-test mutasyon seti aciksa hedef ID env'leri zorunludur; aksi halde rehearsal eksik kapsama ile yanlis guven verebilir.
- release cutover onayi verilmeden once healthcheck URL, SQL validation URL/credentials ve Sentry release env'leri ayni hedef ortam icin dogrulanmali.
