# Production Runbook

## Gozlenecek Metrikler

- RPC `p50/p95/p99`
- `http_req_failed`
- DB CPU / connection / lock
- Sentry crash-free session rate
- Sentry release health / native crash / JS exception count
- notification badge `p95`
- cold screen open `p95`
- mutation rollback rate
- upload failure rate
- media scanner timeout/failure rate
- `storage_cleanup_jobs` pending/dead-letter sayisi
- queued mutation backlog / stale retry sayisi

## Alarm Esikleri

- projection RPC `p95 > 400ms`
- notification badge `p95 > 300ms`
- cold screen open `p95 > 1200ms`
- mutation failure rate `> 1%`
- rollback rate beklenenden yuksek

## Semptom -> Muhtemel Kaynak

- `Home` yavas: `home_feed_projection`, DB row scan veya feed index eksigi
- notifications yavas: `notifications_projection`, `notification_badge_projection`, unread count sorgusu
- profile tab yavas: `profile_overview_projection`, `profile_content_projection`
- search yavas: `search_results_projection`, filtre/sort plani veya eksik index
- upload sorunlu: storage signing, queue retry veya signed URL
- upload quarantine birikiyor: scanner sagligi, checksum/MIME uyusmasi veya scanner secret/config drift
- rollback spike: optimistic patch envelope uyumsuzlugu veya mutation hata burst'u
- crash spike: Sentry release regression, sourcemap/symbol eksigi veya native bridge sorunu
- queue birikiyor: background mutation processor, retry backoff veya owner-scoped queue resume sorunu

## Ilk Kontroller

1. Hot-path projection RPC'lerini ve DB lock durumunu kontrol et.
2. `notifications_projection`, `home_feed_projection`, `profile_content_projection` surelerini ayir.
3. Mobil telemetry icinde `screen_sync`, `projection`, `upload`, `mutation` eventlerini incele.
4. Sentry release health, crash-free sessions ve preview/prod event akislarini kontrol et.
5. `legacyEdgeReadsEnabled=false` oldugunu dogrula.
6. Slow query threshold'u asan SQL kayitlarini ayir.
7. Health yanitinda `mediaScannerConfigured=true` ve cleanup kuyruğunda `dead_letter=0` oldugunu dogrula.

## Mitigation

1. Sorun tek projection'da ise ilgili sorgu icin `EXPLAIN ANALYZE` ciktisini kaydet.
2. Index eksigi varsa yeni composite veya partial index uygula.
3. Mutation rollback spike varsa patch envelope ve optimistic reducer parity kontrol et.
4. Upload failure spike varsa signed URL, bucket policy ve queue retry loglarini incele.
5. Sentry stack trace minified ise source map / symbol upload adimini yeniden dogrula.
6. Queued mutation backlog buyuyorsa stuck `pending/uploading` kayitlarini, retry timestamp'lerini ve owner scoping loglarini incele.
7. Sadece gerekirse ilgili feature flag'i kisa sureli kapat; uzun sureli compat geri donusu yapma.

## Rollback Threshold

- `http_req_failed` kalici olarak `%1` ustune cikarsa
- hot-path RPC `p95` kalici olarak `400ms` ustunde kalirsa
- badge veya notifications akisi kullaniciyi bloke edecek seviyede bozulursa
- yaygin mutation rollback veya failure burst olursa

## Escalation Owner

- mobil projection ve cache sorunlari: mobile/app veri katmani sahibi
- RPC, index, summary ve RLS sorunlari: Supabase DB sahibi
- edge deploy, health ve env sorunlari: release sahibi

## Post-Release Health Check

1. Production acilisindan sonra ilk 15 dakikada preview olmayan yeni Sentry release eventleri dogrula.
2. `release-health:*:app-launch` mesajlari ve navigation breadcrumblari akiyor mu kontrol et.
3. Home / Search / Profile / Notifications warm relaunch hizlarini telemetry ile karsilastir.
4. Android phone ve Android tablet portrait icin birer canli smoke sonucu kayda al.
