# SQL Validation Pack

Bu klasor production hardening oncesi calistirilacak SQL dogrulama paketlerini icerir.

## Dosyalar

- `01_hot_path_explain.sql`
  Hot-path projection sorgulari icin `EXPLAIN ANALYZE`
- `02_summary_parity.sql`
  `event_summary`, `album_summary`, `profile_summary`, `notification_summary` parity kontrolu
- `03_visibility_rls_parity.sql`
  block, profile visibility ve capability tabanli parity kontrolleri
- `04_album_visibility_social_state_consistency.sql`
  profile/search/home album gorunurlugu ve social-state read model parity kontrolleri
- `05_rls_storage_audit.sql`
  RLS enablement, policy presence, active storage bucket policy parity ve signed-url yetki helper audit'i
- `06_projection_cursor_paths.sql`
  Home, profile content, search ve secondary projection'lar icin cursor / append-path `EXPLAIN ANALYZE`
- `07_client_mutation_idempotency.sql`
  `client_mutation_id` replay kontrolu ve receipt kaydi dogrulamasi
- `08_database_architecture_audit.sql`
  Domain table/view varligi, projection signature standardizasyonu, projection source kolonlari, `updated_by` trigger coverage ve zorunlu index seti audit'i

## Calistirma

`psql`, Supabase SQL Editor veya staging/prod-benzeri SQL oturumunda dosyalari sirayla calistir.

Onerilen sira:

1. `01_hot_path_explain.sql`
2. `02_summary_parity.sql`
3. `03_visibility_rls_parity.sql`
4. `04_album_visibility_social_state_consistency.sql`
5. `05_rls_storage_audit.sql`
6. `06_projection_cursor_paths.sql`
7. `07_client_mutation_idempotency.sql`
8. `08_database_architecture_audit.sql`

## Beklenen Cikti

- `EXPLAIN ANALYZE` planlari hot-path index setini kullaniyor olmali
- summary parity sorgulari mismatch donmemeli
- visibility/RLS kontrolleri block ve capability kurallarini dogru yansitmali
- album visibility/social-state kontrolleri profile, search ve home projection sonuclarini dogru yansitmali
- RLS/storage audit sorgulari kritik tablolar icin RLS ve policy coverage eksigi bulmamali
- cursor / append EXPLAIN planlari secondary projection ikinci sayfa ve `sort_mode` yollarinda da index kullanimini korumali
- duplicate `client_mutation_id` replay sorgulari ayni mutation icin ikinci yan etkiyi uretmemeli
- database architecture audit script'i projection signature, trigger ve index coverage eksigi bulmamali

## Notlar

- Scriptler ornek veri secimini kendi yapar; manuel UUID girme zorunlu degildir.
- Bos veri donen ortamda sorgular hata vermeden `null` veya bos sonuc dondurebilir.
- Production onayi, bu paket calistirilmadan verilmemelidir.
