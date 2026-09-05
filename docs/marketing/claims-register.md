# UniVerse — İddia Kayıt Defteri (Claims Register)

**Kapsam:** Store listing, reklam, sunum, basın ve topluluk paylaşımlarında kullanılabilecek her iddia.
**Kural:** Bu dosyada kaydı olmayan iddia yayınlanmaz. `TASLAK` satırlar dışarı çıkmaz.
**Son gözden geçirme:** 2026-09-04 · **Sahip:** Cayan Kuzu
**Bağlı candidate:** `config/app-release.json` → version `1.0.134`, Android versionCode `134`, iOS buildNumber `134`, runtimeVersion `1.0.134`
**Yüzey kaynağı:** `quality/feature-surface.snapshot.json`

---

## Nasıl okunur

| Sütun              | Anlamı                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Durum              | `ONAYLI` = yayınlanabilir · `TASLAK` = kanıt bekliyor · `YASAK` = kullanılamaz                    |
| Kanıt              | Repository'deki dosya, tablo, test veya çalıştırılmış ölçüm. "Öyle hissettiriyor" kanıt değildir. |
| İzin verilen ifade | Birebir kullanılacak Türkçe cümle. Kelimeyi değiştirmek yeni kayıt gerektirir.                    |

Bir iddia iki koşulu birden sağlamadan `ONAYLI` olamaz: (1) kanıt sütunundaki dosya candidate SHA'da mevcut, (2) ifade, ekranın gerçekten yaptığından fazlasını vaat etmiyor.

---

## 1. Ürün işlevi iddiaları

| #    | İddia                                                                              | Durum  | Destekleyen yüzey                                     | Kanıt                                                                                                             | İzin verilen ifade                                                                     | Yasak abartı                                                                            |
| ---- | ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| F-01 | Kayıt, öğrenci ve kulüp olmak üzere iki hesap türü sunar.                          | ONAYLI | `StudentRegisterScreen`, `ClubRegisterScreen`         | `feature-surface` → `taxonomy.accountTypes` = `club, student`                                                     | "Öğrenci ya da kulüp olarak katıl."                                                    | "Herkes katılabilir." (Üniversite bağlamı zorunlu.)                                     |
| F-02 | Profil, üniversite ve bölüm bilgisiyle kurulur.                                    | ONAYLI | `StudentRegistrationProfileStep`, `EditProfileScreen` | `catalog.universities` = 202 değer · `catalog.departments` = 598 değer                                            | "Üniversiteni ve bölümünü seç, profilin kampüs bağlamına otursun."                     | "Türkiye'deki tüm üniversiteler." (202 kayıtlı değer; kapsam iddiası değil.)            |
| F-03 | Ana akış; etkinlik ve albüm içeriğini kaynak, hesap türü ve sıraya göre filtreler. | ONAYLI | `HomeScreen`                                          | `taxonomy.homeContentFilters` (3) · `homeAccountFilters` (3) · `homeSourceFilters` (3) · `homeSortOptions` (2)    | "Akışı etkinlik/albüm, kulüp/öğrenci ve takip ettiklerin olarak daralt."               | "Kişiselleştirilmiş algoritma." · "Yapay zekâ önerisi." (Öneri motoru yok, filtre var.) |
| F-04 | Etkinlik oluşturma, düzenleme, silme ve katılım vardır.                            | ONAYLI | `CreateEventScreen`, `EventDetailScreen`              | `api.httpRoutes` → `POST/PATCH/DELETE .../events...` · `public.events`, `public.event_attendees`                  | "Etkinliği oluştur, güncelle, katılımı gör."                                           | "Bilet satışı." · "Takvime otomatik ekleme." (İkisi de yok.)                            |
| F-05 | Etkinlik görünürlüğü herkese açık veya yalnız üyelere olarak ayarlanır.            | ONAYLI | `CreateEventScreen`                                   | `taxonomy.eventVisibilities` = `members_only, public`                                                             | "Etkinliği herkese açık ya da yalnız üyelere göster."                                  | "Özel davetli listesi." (Davet sistemi yok.)                                            |
| F-06 | Etkinliğin albümü, yorumu ve beğenisi vardır.                                      | ONAYLI | `AlbumViewScreen`, `CommentPanel`                     | `public.album_photos`, `album_photo_comments`, `album_photo_likes`, `event_comments`, `event_likes`               | "Etkinliğin fotoğrafları, yorumları ve beğenileri aynı yerde."                         | "Sınırsız yükleme." (Kota sözü verme.)                                                  |
| F-07 | Arama; öğrenci, kulüp, etkinlik ve albüm üzerinde çalışır.                         | ONAYLI | `SearchScreen`                                        | `taxonomy.searchTypes` (4) · `searchSortOptions` (10)                                                             | "Öğrenci, kulüp, etkinlik ve albüm ara."                                               | "Anlamsal arama." · "Doğal dil araması."                                                |
| F-08 | Takip ilişkisi; gizli hesaplarda istek–onay ile çalışır.                           | ONAYLI | `ViewProfileScreen`, `UserListScreen`                 | `public.follows` · `notifications.types` → `follow`, `follow_request`, `follow_accepted` · `get_follow_state` RPC | "Gizli hesaplarda takip isteği onaya bağlıdır."                                        | "Anında herkese erişim."                                                                |
| F-09 | Hesap gizli yapılabilir ve e-posta görünürlüğü ayrı seçilebilir.                   | ONAYLI | `PrivacySettingsScreen`                               | `settings.privacyToggleCount` = 2 · copy `settings.privacy.state.*`                                               | "Hesabını gizle, e-postanı ayrıca sakla."                                              | "Tam anonimlik." (Profil adı görünür.)                                                  |
| F-10 | Kullanıcı engelleme ve içerik şikâyeti vardır.                                     | ONAYLI | `BlockedUsersScreen`, `ProfileActionMenu`             | `public.blocks`, `public.reports` · `taxonomy.reportTargetTypes` (5)                                              | "Rahatsız eden hesabı engelle; kullanıcıyı, etkinliği, albümü veya yorumu şikâyet et." | "Tamamen güvenli." · "Sahte hesap yoktur."                                              |
| F-11 | Uygulama içi bildirim listesi kategoriye göre filtrelenir.                         | ONAYLI | `NotificationsScreen`                                 | `notifications.types` (11) · `filterCategories` (5)                                                               | "Bildirimlerini sosyal, beğeni, yorum ve kulüp olarak ayır."                           | "Akıllı bildirim özeti."                                                                |
| F-12 | Hesap silme uygulama içinden yapılır.                                              | ONAYLI | `SettingsDeleteAccountModal`                          | `api.rpcNames` → `delete_own_account` · `settings.itemKeys` → `delete-account`                                    | "Hesabını uygulamadan silebilirsin."                                                   | "Verilerin anında yok olur." (Silme sunucuda sıraya girer.)                             |

## 2. Gizlilik ve veri iddiaları

Bu bölüm UniVerse'in en güçlü ve en kolay doğrulanabilir farkıdır. Her satır izin manifestinden okunur; pazarlama tarafında **uydurulamaz**, çünkü kaynak dosya store incelemesinde de aynıdır.

| #    | İddia                                                                          | Durum  | Kanıt                                                                                                                                                                        | İzin verilen ifade                                                     | Yasak abartı                                               |
| ---- | ------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| P-01 | Uygulama konum izni istemez.                                                   | ONAYLI | `native.androidPermissions` (9 izin) içinde `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` / arka plan konum **yok**; `iosUsageDescriptionKeys` içinde konum anahtarı yok | "Konum izni istemiyoruz. Kampüs bağlamı üniversite bilgisinden gelir." | "Hiçbir veri toplamıyoruz."                                |
| P-02 | Kamera, mikrofon, galeri ve bildirim dışında izin istenmez.                    | ONAYLI | `native.devicePermissionKeys` = `camera, microphone, notifications, photos` (4)                                                                                              | "Yalnızca dört izin: kamera, mikrofon, galeri, bildirim."              | İzin sayısını "sıfır" göstermek.                           |
| P-03 | Medya herkese açık bir adreste durmaz; tek bir özel Storage kovasında tutulur. | ONAYLI | `database.storageBuckets` = `make-e3557d40-media` (1) · `docs/media-upload-security-runbook.md`                                                                              | "Fotoğrafların herkese açık bir adreste durmaz."                       | "Fotoğrafını kimse göremez."                               |
| P-04 | Push bildirimi kilit ekranına içerik veya gönderen taşımaz.                    | ONAYLI | `buildPushTitle` / `buildPushBody` / `buildPushData` sabit; `pushLockScreenPrivacy.contract.test.mjs` (PASS) — payload yalnız `notificationId` taşır                         | "Kilit ekranında ne yazdığı değil, yalnız bildirim olduğu görünür."    | "Bildirimlerimiz uçtan uca şifreli."                       |
| P-05 | Bildirim izni kullanıcının kendi eylemiyle istenir.                            | ONAYLI | `PermissionsScreen`; `docs/push-current-contract.md`                                                                                                                         | "Bildirim iznini sen açana kadar istemiyoruz."                         | Otomatik izin baskısı ima etmek.                           |
| P-06 | Görünürlük kararları sunucuda uygulanır; UUID bilmek erişim vermez.            | ONAYLI | `can_view_profile`, `viewer_blocked_snapshot`, `get_profile_capabilities`, `get_event_capabilities` RPC'leri + RLS                                                           | "Kimin neyi görebileceğine sunucu karar verir."                        | "Askeri düzeyde güvenlik." · "Hacklenemez."                |
| P-07 | Oturum kapanışında yerel veri temizliği fail-closed çalışır.                   | ONAYLI | `clearSensitiveClientState.ts` — herhangi bir temizlik adımı düşerse hata fırlatır; `clearSensitiveClientState.test.ts`                                                      | "Çıkış yaptığında cihazdaki verin temizlenir."                         | "Verilerin sunucudan da silinir." (Ayrı akış — bkz. F-12.) |

## 3. Ölçüm ve büyüklük iddiaları

| #    | İddia                                                          | Durum     | Neden                                                        | Yerine kullanılacak                                          |
| ---- | -------------------------------------------------------------- | --------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| M-01 | Kullanıcı sayısı, indirme sayısı, aktif kulüp sayısı           | **YASAK** | Ölçülmedi. Store ve analytics verisi yayın sonrası oluşacak. | Sayı vermeden işlevi anlat.                                  |
| M-02 | "Türkiye'nin en büyük / en iyi öğrenci uygulaması"             | **YASAK** | Karşılaştırmalı kanıt yok.                                   | "Kampüsünü tek yerde topla."                                 |
| M-03 | "%X daha fazla etkinlik keşfi"                                 | **YASAK** | Kontrollü ölçüm yok.                                         | `measurement-plan.md` çalıştıktan sonra yeniden değerlendir. |
| M-04 | "X üniversitede kullanılıyor"                                  | **YASAK** | Katalogda 202 üniversite **tanımlı**; bu kullanım değildir.  | Yalnız F-02 ifadesiyle, katalog büyüklüğü olarak.            |
| M-05 | Kulüp veya üniversite iş birliği ima etmek                     | **YASAK** | Yazılı anlaşma yok.                                          | Yalnız gerçek, yazılı iş birlikleri duyurulur.               |
| M-06 | Sahte kullanıcı yorumu, sahte katılımcı sayısı, sahte etkinlik | **YASAK** | Dürüstlük ve store politikası ihlali.                        | Store görselleri yalnız candidate build'den alınır.          |

## 4. Teknik kalite iddiaları

| #    | İddia                                                            | Durum  | Kanıt                                                                                                               | İzin verilen ifade                                         |
| ---- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| T-01 | Çevrimdışı yazılan işlem bağlantı dönünce gönderilir.            | ONAYLI | `mutationActionQueue.ts`, `uploadQueue.ts`, `usePersistentQueueProcessor.ts` ve testleri                            | "Bağlantın kesilirse işlemin kuyrukta bekler."             |
| T-02 | Arayüz WCAG AA metin kontrastını her yüzeyde karşılar.           | ONAYLI | `utils/guards/check-text-contrast.cjs` (PASS) · `tokens.test.ts` 31 test                                            | "Yazılar her ekranda okunaklı kontrastta."                 |
| T-03 | Dokunma hedefleri 44dp etkin alanı karşılar.                     | ONAYLI | `utils/guards/check-touch-targets.cjs` (PASS)                                                                       | "Küçük görünen düğmeler bile rahat basılır."               |
| T-04 | Ekran okuyucu ile uçtan uca kullanım                             | TASLAK | Statik kanıt var; VoiceOver/TalkBack cihaz turu `docs/push-real-device-matrix.md` ile mühürlenmeli.                 | — (cihaz kanıtı gelene kadar yayınlanmaz)                  |
| T-06 | Hata ve durum değişiklikleri iki platformda da sesli bildirilir. | ONAYLI | `useLiveRegionAnnouncement` + `utils/guards/check-live-region-parity.cjs` (PASS, 12 yüzey) · 6 birim testi          | "Hata ve durum değişikliklerini ekran okuyucu da duyurur." |
| T-07 | Kullanıcıya görünen Türkçe metinler diakritiklerini korur.       | ONAYLI | `utils/guards/check-turkish-copy.cjs` (PASS, 909 modül) — JSX attribute, kopya object key'i ve hata sink'i kapsanır | "Uygulamanın Türkçesi doğru yazılmıştır."                  |
| T-05 | "Hızlı" / "anlık" performans                                     | TASLAK | `docs/performance-verification-checklist.md` doldurulmadan ölçüm iddiası yok.                                       | —                                                          |

### T-04 ile T-06 arasındaki fark

T-06, duyurunun **kodda var olduğunu** söyler ve makine ile doğrulanır. T-04, bir kullanıcının
ekran okuyucuyla baştan sona gerçekten iş yapabildiğini söyler ve bunu yalnız cihaz turu kanıtlar.
İkincisi kanıtlanmadan T-06'yı "uygulama ekran okuyucuyla tam uyumlu" diye genişletmek yasaktır.

## 5. Gözden geçirme ritmi

- Her release candidate'ta bu dosya yeniden okunur; `capturedFromCommit` değiştiyse F ve P satırlarının kanıtı yeniden doğrulanır.
- `TASLAK` bir satır iki release boyunca kanıtlanmazsa `YASAK`'a düşer.
- Store metni, reklam metni ve sunum cümlesi bu dosyadaki "izin verilen ifade" ile birebir eşleşir.
- Kanıt sütunundaki bir dosya silinirse ilgili satır otomatik olarak `TASLAK`'a döner.
