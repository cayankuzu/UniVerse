# UniVerse – Veritabanı Mimarisi Blueprint

Bu belge, UniVerse için **basit, anlaşılır, az şema ile çok iş yapan**, ölçeklenebilir ve sürdürülebilir bir veritabanı mimarisini tanımlar. Büyük sosyal ağların (Instagram, Facebook, Reddit) kullandığı prensiplere uyumlu, Supabase/PostgreSQL tabanlı bir yapı hedeflenir.

---

## 1. Hedefler ve Prensipler

- **Tek doğruluk kaynağı**: Her veri parçası tek bir tabloda/kolonda tutulur; çakışan kopyalar yok.
- **Okuma/yazma ayrımı**: Yazma (insert/update/delete) normalize tablolara; okuma (feed, profil, bildirim listeleri) projection/RPC ile hazır veri.
- **Basit şema**: Gereksiz tablo/kolon yok; her alanın net bir amacı var.
- **Index-first**: Her sık çalışan sorgu pattern’i için önceden indeks; full table scan yok.
- **RLS her yerde**: Tüm tablolar RLS ile korunur; public/anon doğrudan hassas veriye erişemez.
- **Migration-first**: Şema değişikliği hep migration dosyası ile; manuel SQL production’da çalıştırılmaz.
- **Debug edilebilir**: Audit alanları, tutarlı isimlendirme ve validation script’leri ile sorun takibi kolay.

---

## 2. Şema Yapısı ve İsimlendirme

### 2.1. Tablo İsimlendirme

- **Tekil, küçük harf, snake_case**: `profiles`, `events`, `event_attendees`, `album_photos`, `notifications`.
- **İlişki tabloları**: İki varlığı birleştiren tablolar net isimle: `follows`, `blocks`, `event_likes`, `album_photo_comments`.
- **Çoğul kullanılmaz**: Tablo adı tekil (`profile` değil `profiles` – çoğul tercih edilebilir, projede `profiles` kullanılıyor).

### 2.2. Kolon İsimlendirme

- **Primary key**: `id` (uuid) veya domain’e özel `user_id`, `event_id` (tablo adı + `_id`).
- **Foreign key**: `user_id`, `event_id`, `club_id`, `follower_id`, `following_id` – hedef tablo net anlaşılır.
- **Zaman**: `created_at`, `updated_at` (timestamptz). Projection invalidation için: `last_activity_at`, `sync_version`.
- **Soft delete**: `deleted_at` (timestamptz, null = silinmemiş).
- **Audit (MVP)**: Mutable ana kaynaklarda `updated_by` (uuid); oluşturan taraf için mevcut FK (`user_id`, `club_id`) yeterli kabul edilir.

### 2.3. Normalizasyon Kuralları

- **Tekrarlanan değerler** ayrı tabloda (örn. enum yerine küçük lookup tablosu sadece gerçekten ortak ve değişebilir ise).
- **Sayılar**: Sık kullanılan sayaçlar (like_count, followers_count) ya materialized view/summary view’da ya da denormalize kolon olarak güncellenir; her seferinde `COUNT(*)` ile hesaplanmaz.
- **Büyük metin/blob**: Gerekmedikçe aynı tabloda; ayrı “content” tablosu sadece gerçekten büyük ve ayrı erişim gerekiyorsa.

---

## 3. Domain Tabloları (Özet)

Mevcut repo ile uyumlu, kanonik set:

| Domain        | Tablolar                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------- |
| Kimlik/Profil | `profiles`                                                                               |
| Sosyal graf   | `follows`, `blocks`                                                                      |
| Kulüp         | `club_memberships`                                                                       |
| Etkinlik      | `events`, `event_attendees`, `event_likes`, `event_comments`, `event_comment_likes`      |
| Albüm/Medya   | `album_photos`, `album_photo_likes`, `album_photo_comments`, `album_photo_comment_likes` |
| Bildirim      | `notifications`                                                                          |
| Moderation    | `reports`                                                                                |
| Storage       | `media_assets`                                                                           |
| Telemetri     | `client_telemetry_events`                                                                |

- **Yazma**: Bu tablolara insert/update/delete; RLS ve trigger’lar burada.
- **Okuma**: UI doğrudan bu tabloları karmaşık join ile sorgulamaz; projection RPC’lerinden beslenir.

---

## 4. Projection (Read Model) Mimarisi

### 4.1. Amaç

- Feed, profil, bildirim, arama, takipçi listesi gibi ekranlar **hazır, tek RPC çağrısıyla** veri alır.
- Ağır join ve filtreleme sunucuda bir kez yapılır; sonuç standart bir zarf (envelope) ile döner.
- İstemci sadece envelope’ı parse edip cache’e yazar; ekranda tekrarlı sorgu mantığı yok.

### 4.2. Kanonik Projection Envelope

Tüm projection RPC’lerinin dönüş tipi aynı yapıda olmalı:

```json
{
  "items": [ ... ],
  "updated_items": [ ... ],
  "deleted_ids": [ ... ],
  "next_cursor": "..." | null,
  "server_time": "ISO8601",
  "delta_token": "..."
}
```

- **items**: Sayfa veya delta’daki ana kayıtlar (ID + UI’da gereken alanlar).
- **updated_items**: Delta modunda değişen kayıtlar (patch için).
- **deleted_ids**: Delta modunda kaldırılması gereken ID’ler.
- **next_cursor**: Sonraki sayfa için token; null ise son sayfa.
- **server_time**: İstemci cache stratejisi için.
- **delta_token**: Bir sonraki delta isteğinde gönderilir; “bu tokenden sonra ne değişti?” sorusuna cevap verir.

### 4.3. RPC Parametre Standardı

Tüm projection fonksiyonları ortak parametre setine uyumlu olmalı:

- **viewer_id** (uuid, default auth.uid()): İstek yapan kullanıcı.
- **cursor** (text): Pagination cursor.
- **limit_count** (integer): Sayfa boyutu (üst sınır sabit, örn. 100).
- **since** (timestamptz): “Bu tarihten sonra güncellenenler” için delta filtre.
- **delta_token**: İstemcinin elindeki son token; sunucu buna göre sadece değişiklikleri döner.

Domain’e özel ek parametreler (target_username, filter_name, tab_name vb.) bu standartların üzerine eklenir.

### 4.4. Projection Invalidation (Touch) Mekanizması

- İlgili tabloda veri değiştiğinde (insert/update/delete), ilgili satırın **projection güncelliği** işaretlenir.
- Bunun için her kritik tabloda:
  - **last_activity_at** (timestamptz): Son değişiklik zamanı.
  - **sync_version** (bigint): Her güncellemede artan sürüm.
- Trigger’lar:
  - Ana tablo güncellenince `bump_projection_row()` ile `last_activity_at` ve `sync_version` güncellenir.
  - İlişkili tablolar (event_likes, event_comments, follows vb.) değişince `touch_*` fonksiyonları ile ilgili event/profile/notification satırları “dokunulur”.
- Böylece delta sorguları `WHERE last_activity_at >= since` veya `sync_version > X` gibi tek alan üzerinden verimli çalışır.

### 4.5. Summary View’lar

Sayaç ve özet bilgiler tekrar hesaplanmasın diye view’lar kullanılır:

- **event_summary**: event_id, likes_count, comments_count, attendees_count, album_count, last_activity_at, sync_version.
- **album_summary**: photo_id, likes_count, comments_count, images_count, last_activity_at, sync_version.
- **profile_summary**: user_id, followers_count, following_count, members_count, events_count, albums_count, clubs_count, unread_notifications_count, pending_*_count, last_activity_at, sync_version.
- **notification_summary**: user_id, unread_count, latest_activity_at.

Bunlar RPC’lerin içinde join edilir; istemci doğrudan view’a erişmez.

---

## 5. İndeks Stratejisi

### 5.1. Genel Kurallar

- Her foreign key üzerinde en az bir indeks (join ve RLS için).
- Sıralama + filtreleme birlikte kullanılıyorsa **kompozit indeks**: (filter_col, sort_col DESC, id).
- Projection sorguları için: `(owner_id veya user_id, last_activity_at DESC, id DESC)` pattern’i standarttır.

### 5.2. Kritik İndeks Örnekleri (Mevcut Yapı ile Uyumlu)

- **events**: (visibility, last_activity_at DESC, id), (club_id, last_activity_at DESC, id).
- **album_photos**: (event_id, last_activity_at DESC, id), (user_id, last_activity_at DESC, id).
- **notifications**: (user_id, is_read, last_activity_at DESC, id).
- **follows**: (follower_id, status, last_activity_at), (following_id, status, last_activity_at).
- **event_comments**: (event_id, created_at DESC, id).
- **album_photo_comments**: (photo_id, created_at DESC, id).

Yeni projection veya yeni filtre eklendiğinde ilgili sorgu için EXPLAIN ANALYZE çalıştırılır; full scan varsa indeks eklenir.

### 5.3. İndeks Bakımı

- Gereksiz indeks yok: Yazma ağırlıklı tablolarda her ek indeks insert/update maliyetini artırır.
- Validation: `supabase/validation/01_hot_path_explain.sql` ve `06_projection_cursor_paths.sql` ile hot path’lerin indeks kullandığı periyodik kontrol edilir.

---

## 6. RLS (Row Level Security) ve Güvenlik

### 6.1. Zorunluluk

- Tüm kullanıcı verisi taşıyan tablolarda RLS **aktif** olmalı.
- Policy’ler: SELECT için “görebilir mi?”, INSERT/UPDATE/DELETE için “sahibi mi / yetkili mi?” net tanımlanır.

### 6.2. Ortak Pattern’ler

- **Sahip bazlı**: `WHERE user_id = auth.uid()` veya `WHERE club_id IN (yetkili_club_ids)`.
- **Çift taraflı ilişki**: Mesajlar için `sender_id = auth.uid() OR receiver_id = auth.uid()`.
- **Görünürlük**: `can_view_profile(target_id)`, `can_view_event(event_id)` gibi helper fonksiyonlar RLS ve RPC’lerde ortak kullanılır.
- **Blok**: `is_blocked_pair(a, b)` true ise iki taraf birbirinin içeriğini göremez; tüm feed/profile/notification sorguları buna göre filtrelenir.

### 6.3. Projection RPC’ler

- `SECURITY DEFINER` + `SET search_path = public`: RPC kendi yetkisiyle çalışır, içeride viewer ve yetki kontrolleri açıkça yazılır.
- RPC içinde: Önce `viewer_id := coalesce(viewer_id_param, auth.uid())`, sonra tüm filtrelerde bu viewer ve `can_view_*` / block kontrolleri kullanılır.
- Client’tan gelen `user_id`/`target_id` gibi değerler “bu kullanıcı şunu görebilir mi?” sorusuna cevap vermek için kullanılır; asla tek başına “yetki” sayılmaz.

### 6.4. Audit ve Validation

- `supabase/validation/05_rls_storage_audit.sql`: Kritik tablolarda RLS açık mı, policy var mı, storage policy’leri uyumlu mu kontrol eder.
- Yeni tablo eklendiğinde bu script güncellenir; production öncesi çalıştırılır.

---

## 7. Migration ve Şema Versiyonlama

### 7.1. Migration Dosyaları

- Tüm şema ve veri değişiklikleri `supabase/migrations/` altında, kronolojik isimli dosyalarda: `YYYYMMDDHHMMSS_açıklayıcı_ad.sql`.
- Geri alınabilir değişiklikler için (mümkünse) down migration veya ayrı rollback script düşünülür; en azından dokümante edilir.

### 7.2. İçerik Kuralları

- Bir migration: Tek bir mantıksal değişiklik (tek tablo, tek RPC, tek indeks seti).
- Büyük refactor’lar birkaç migration’a bölünür; her biri uygulanabilir ve test edilebilir olmalı.
- Veri dönüşümü gerekiyorsa: Önce şema, sonra veri güncelleme, sonra eski kolon/kısım kaldırma aşamalı yapılır.

### 7.3. Çalıştırma ve Doğrulama

- Migration’lar sırayla uygulanır (`supabase db push` veya eşdeğer).
- Migration sonrası: İlgili validation script’leri (01–06) hedef ortamda çalıştırılır; RLS, indeks ve projection parity kontrolleri geçmeli.

---

## 8. Tutarlılık ve Transaction Kullanımı

### 8.1. Yazma İşlemleri

- Bir kullanıcı aksiyonu birden fazla tabloyu güncelliyorsa (örn. follow + notification insert): Aynı RPC veya transaction içinde yapılır.
- Sayaç güncelleme (followers_count vb.): Ya trigger ile otomatik ya da RPC içinde tek transaction’da; yarım kalan güncelleme kalmaz.

### 8.2. Optimistic Locking (İsteğe Bağlı)

- Çakışan güncellemelerde: `sync_version` veya `updated_at` ile “bu satır hâlâ benim okuduğum gibi mi?” kontrolü yapılabilir; değişmişse conflict dönülür, client güncel veriyi çekip tekrar dener.

### 8.3. Soft Delete

- Kritik tablolarda `deleted_at` kullanımı: Silme fiziksel DELETE yerine UPDATE deleted_at = now(). Tüm SELECT’lerde `deleted_at IS NULL` filtresi uygulanır; projection RPC’lerde bu zorunludur.

---

## 9. Ölçeklenebilirlik ve Performans

### 9.1. Okuma Yükü

- Tüm ağır listeler projection RPC ile; client tek tek tablo join’i yapmaz.
- Sık kullanılan projection sonuçları ileride Redis/edge cache ile cache’lenebilir; şema ve RPC imzası buna uygun tutulur (delta_token, server_time ile tutarlılık korunur).

### 9.2. Yazma Yükü

- Trigger sayısı ve tetiklenen iş mantığı sade tutulur; ağır hesaplamalar mümkünse async job’a taşınır.
- Batch insert (örn. telemetri): `log_client_telemetry_batch(jsonb)` gibi tek RPC ile toplu yazım desteklenir.

### 9.3. İlerideki Adımlar (MVP Sonrası)

- **Read replica**: Okuma sorguları replica’ya yönlendirilebilir; yazma hep primary’de.
- **Partitioning**: Çok büyüyen tablolar (notifications, event_comments) tarih veya user_id’ye göre partition’a ayrılabilir.
- **Arşivleme**: Eski veriler arşiv tablosuna taşınarak ana tablo boyutu sınırda tutulur.

---

## 10. Debug ve Gözlemlenebilirlik

### 10.1. Audit Alanları

- **created_at**, **updated_at**: Tüm kritik tablolarda.
- **updated_by**: Mutable ana kaynaklarda (profiles, events); kim son güncelledi takibi için.
- **last_activity_at**, **sync_version**: Projection invalidation ve delta debug için.

### 10.2. Loglama

- RPC içinde hassas veri (şifre, token, email) log’lanmaz.
- Hata durumunda: request_id, viewer_id, RPC adı, hata kodu loglanır; production’da yapılandırılmış log tercih edilir.

### 10.3. SQL Validation Pack

- `supabase/validation/` altındaki script’ler:
  - Hot path’lerin EXPLAIN planı.
  - Summary/parity kontrolleri.
  - RLS ve storage audit.
  - Projection cursor/append path’lerin indeks kullanımı.
- Her büyük migration veya release öncesi bu set çalıştırılır; beklenen çıktı dokümante edilir.

---

## 11. MVP İçin Veritabanı Checklist’i

1. **Şema**: Tüm domain tabloları net, tekrarsız; isimlendirme tutarlı.
2. **Projection envelope**: Tüm listeleme RPC’leri aynı envelope (items, updated_items, deleted_ids, next_cursor, server_time, delta_token) döner.
3. **Parametre standardı**: cursor, limit_count, since, delta_token ve viewer parametreleri kullanılır.
4. **Touch mekanizması**: last_activity_at + sync_version + trigger’lar ile projection invalidation çalışır.
5. **İndeksler**: Tüm hot path’ler için uygun kompozit indeksler var; EXPLAIN full scan göstermez.
6. **RLS**: Kritik tablolarda RLS açık, policy’ler net; validation script’leri geçer.
7. **Migration**: Tüm değişiklikler migration dosyası ile; production’da manuel şema değişikliği yok.
8. **Soft delete**: Kritik tablolarda deleted_at kullanımı ve tüm SELECT’lerde filtre uygulanır.
9. **Audit**: created_at, updated_at ve (gereken yerde) updated_by mevcut.
10. **Validation**: Release öncesi 01–06 validation pack çalıştırılmış ve sonuçlar kabul edilmiş.

Bu blueprint, mevcut Supabase yapınızla uyumludur; yeni projection veya tablo eklerken bu dokümandaki kurallara uyarak basit, ölçeklenebilir ve debug edilmesi kolay bir veritabanı mimarisini sürdürebilirsiniz.
