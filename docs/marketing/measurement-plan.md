# UniVerse — Ölçüm Planı

**Kural:** Yeni kullanıcı özelliği eklenmez, yeni analytics vendor'ı kurulmaz. Ölçüm, var olan üç kaynaktan yapılır.
**Son gözden geçirme:** 2026-09-04

---

## 1. Ölçüm kaynakları (üçü de mevcut)

| Kaynak | Ne verir | Nerede |
|---|---|---|
| Store konsolları | Gösterim, store sayfası görüntüleme, kurulum, kaynak kırılımı, kaldırma | App Store Connect, Play Console |
| Uygulama içi telemetri | Ekran, mutation, upload, projection, api_request, security olayları | `logEvent` → `recordTelemetry` → `public.client_telemetry_events` |
| Sentry | Crash-free oturum, hata oranı, sürüm karşılaştırması | Sentry projesi |

**Dördüncü bir vendor eklenmez.** Pazarlama attribution'ı için SDK kurmak, gizlilik duruşunu (P-01, P-02) ve KISS ilkesini bozar; kazanılan hassasiyet buna değmez.

---

## 2. Gizlilik sınırı — telemetriye ne girmez

`redaction.ts` her olayı `recordTelemetry` öncesinde geçirir. Ama redaksiyona güvenmek yerine, olayların **tasarımı** zaten PII taşımaz:

| Asla girmez | Neden |
|---|---|
| E-posta, ad, kullanıcı adı | `EMAIL_PATTERN` maskeler; ayrıca olay şemasında alan yok |
| Mesaj/yorum içeriği | Ölçüm için gereksiz |
| Access/refresh token, imzalı URL | `SENSITIVE_KEY_PATTERNS`, `AUTH_VALUE_PATTERN`, `QUERY_SECRET_PATTERN` |
| Kesin konum | Zaten toplanmıyor (P-01) |
| Özel medya URL'si | Ölçüm için gereksiz |
| Ham arama sorgusu | Yalnız uzunluk sınıfı ve sonuç sayısı yazılır, metin değil |

Meta alanları 160 karakterde kesilir, dizi 8 elemanda kırpılır. Bu, kazayla büyük bir payload'ın telemetriye sızmasını yapısal olarak engeller.

---

## 3. Funnel olayları

Hepsi **mevcut** akışlardan türetilir. Yeni ekran, yeni CTA, yeni izin gerekmez.

| Adım | Olay | Kategori | Kaynak | Notu |
|---|---|---|---|---|
| 1. Store | store sayfası görüntüleme, kurulum | — | Store konsolu | Uygulama dışı |
| 2. İlk açılış | `app_cold_start` | `screen` | Startup | Var olan başlangıç ölçümü |
| 3. Kayıt başlangıcı | `screen:Register` | `screen` | `logScreenView` | Ekran görüntülemesi |
| 4. Kayıt tamamlama | `auth_register_completed` | `mutation` | Kayıt mutation'ı `status: ok` | |
| 5. **İlk değer — keşif** | `first_value_discovery` | `screen` | `HomeScreen` veya `SearchScreen` ilk kez boş olmayan sonuç gösterdiğinde | Segment A |
| 6. **İlk değer — yayımlama** | `first_value_publish` | `mutation` | İlk etkinlik oluşturma `status: ok` | Segment B |
| 7. **İlk değer — takip** | `first_value_follow` | `mutation` | İlk takip/takip isteği `status: ok` | Segment C |
| 8. Çekirdek eylem başarısı | mutation olayları `status: ok` | `mutation` | Katılım, yorum, beğeni, yükleme | |
| 9. Çekirdek eylem hatası | mutation olayları `status: error` / `rollback` | `mutation` | Aynı yüzey | Rollback ayrı sayılır |
| 10. D1 / D7 dönüş | Store konsolu retention | — | App Store Connect / Play Console | Cihaz düzeyinde, PII'siz |

**İlk değer olayları neden üç tane:** Ürünün iki hesap türü ve üç JTBD'si var (`positioning-and-messaging.md`). Tek bir "aktivasyon" tanımı, kulüp yöneticisinin başarısını öğrencinin ölçütüyle yargılamak olurdu.

---

## 4. Kalite metrikleri (pazarlama kararlarını bunlar kilitler)

| Metrik | Kaynak | Kural |
|---|---|---|
| Crash-free oturum oranı | Sentry | Sürüm hedefinin altına düşerse **kampanya durur** |
| p95 ekran açılışı | `screen` + `durationMs` | Bozulursa genişleme durur |
| Mutation hata oranı | `mutation` `status:error` / toplam | Yükselirse creative değil, ürün düzeltilir |
| Rollback oranı | `mutation` `status:rollback` | Optimistic UI'ın kullanıcıya yalan söylediği durumlar |
| Kuyruk birikmesi | `upload-queue-backlog`, `mutation-queue-backlog` | Zaten var; ağ kalitesinin göstergesi |

**Kilit kural:** Kurulum artışı, kalite metriklerinden birini bozuyorsa kampanya başarılı sayılmaz. Büyüme, stabiliteyi harcayarak alınmaz.

---

## 5. Raporlama

### Haftalık tek sayfa

```
Hafta: ____              Sürüm: 1.0.___

HUNI
  store sayfası görüntüleme   ____
  kurulum                     ____   (dönüşüm %__)
  kayıt tamamlama             ____   (%__)
  first_value_discovery       ____   (%__)
  first_value_publish         ____
  first_value_follow          ____
  D1 dönüş                    %__
  D7 dönüş                    %__

KALİTE
  crash-free oturum           %__
  mutation hata oranı         %__
  rollback oranı              %__
  p95 ekran açılışı           ___ ms

KARAR
  [ ] devam   [ ] durdur   [ ] geri al
  Gerekçe: ______________________________
```

### Yorumlama kuralları

- **Örneklem eşiği:** Bir adım için 100'den az gözlem varsa oran yazılır ama **karar verilmez**.
- **Tek değişken:** Aynı hafta hem store görselleri hem creative değiştiyse, ikisinin de etkisi ölçülemez. Değişiklikler sıraya konur.
- **Karşılaştırma tabanı:** Bir sonraki hafta değil, aynı fazın önceki haftası. Kampüs takvimi (sınav haftası, tatil) mevsimsellik yaratır.
- **Negatif sonuç da sonuçtur:** Bir açı çalışmadıysa kaydedilir ve kapatılır; "biraz daha bekleyelim" bir karar değildir.

---

## 6. Ölçülmeyeni ölçülmüş gibi göstermeme

| Söylenemez | Neden | Söylenebilir |
|---|---|---|
| "Kullanıcılar %X daha fazla etkinlik buluyor" | Kontrol grubu yok | "Bu hafta ___ kullanıcı ilk kez etkinlik listesi gördü" |
| "10.000 kullanıcı kapasitesi doğrulandı" | Deterministik mock kapasite kanıtı değildir | Hosted staging ölçümü yapılana kadar sessiz kal |
| "Uygulama hızlı" | `performance-verification-checklist.md` boş | Ölçüm dolduğunda `T-05` yeniden değerlendirilir |
| "Retention sektör ortalamasının üstünde" | Karşılaştırma verisi yok | Kendi haftalık eğilimini göster |

---

## 7. Bu planın bilinen sınırları

Dürüstlük gereği açıkça yazılır:

1. **Kanal düzeyinde attribution zayıftır.** Attribution SDK'sı olmadığı için "hangi gönderi kaç kurulum getirdi" kesin bilinemez; yalnız store konsolunun kaynak kırılımı ve zaman korelasyonu vardır.
2. **D1/D7 cihaz düzeyindedir**, kullanıcı düzeyinde değil. Aynı kişinin iki cihazı iki kullanıcı gibi görünür.
3. **Telemetri örneklemlidir ve ağ koşullarına bağlıdır.** Çevrimdışı bir oturumun olayları geç gelir.
4. Bu üç sınır, gizlilik duruşunun **bilinçli bedelidir**. Daha hassas ölçüm için kullanıcı takibi eklenmeyecektir.
