# UniVerse — Go-to-Market ve Kanal Planı

**Kural:** Yeni ürün özelliği yok. Plan, var olan yüzeyi doğru kitleye ulaştırmakla ilgilidir.
**Son gözden geçirme:** 2026-09-04 · **Sahip:** Cayan Kuzu

---

## 1. Kampüs kampüs başlangıç (neden tek kampüs)

Bir sosyal keşif ürününün değeri, aynı bağlamdaki kullanıcı yoğunluğuna bağlıdır. 20 kampüse dağılmış 500 kullanıcı, tek kampüsteki 200 kullanıcıdan daha az değer üretir: akış boş görünür, arama sonuç vermez, ilk deneyim başarısız olur.

Bu yüzden başlangıç **tek kampüstür**. Katalogda 202 üniversite tanımlı olması pazarlama hedefi değil, ürünün hazır olduğu kapsamdır.

**Kampüs seçim ölçütü** (sıralı):

1. Kurucunun fiziksel erişimi olan kampüs,
2. Aktif kulüp sayısı yüksek olan kampüs,
3. Yönetimi tanıdık en az 3 kulüp.

---

## 2. Kanallar

Kanallar ürünün gerçek yüzeyinden türetildi. Ürün kulüp ve etkinlik etrafında kurulu olduğu için dağıtım da kulüp ve etkinlik etrafından yürür.

| #   | Kanal                         | Neden bu ürüne uyuyor                                                                 | İlk adım                                               | Maliyet   |
| --- | ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------- |
| K-1 | Kulüp yönetimleriyle birebir  | Kulüp, hem kullanıcı hem içerik üreticisi. Bir kulüp geldiğinde takipçileri de gelir. | 3 kulübe `CreateEventScreen` akışını yüz yüze göster   | Emek      |
| K-2 | Etkinlik sonrası albüm        | En doğal yayılma: etkinliğe gelen 60 kişi fotoğrafları aramak için gelir              | Etkinlik gününde albümü aç, kulübün duyurmasını sağla  | Emek      |
| K-3 | Üniversite topluluk sayfaları | Öğrencinin zaten baktığı yer                                                          | `ad-creative-briefs.md` Açı 1'in organik biçimi        | Emek      |
| K-4 | Kampüs micro-creator          | Kampüste tanınan 1–2 öğrenci                                                          | Yalnız gerçekten kullanan kişiyle; iş birliği etiketli | Düşük     |
| K-5 | Store araması (ASO)           | `kulüp`, `etkinlik`, `kampüs` niyetli arama                                           | `store-listing-tr.md` yayında                          | Sıfır     |
| K-6 | Küçük ücretli test            | Yalnız ölçüm eşiği sağlanıyorsa                                                       | Tek kampüsün coğrafi hedeflemesi, tek açı              | Kontrollü |

**Kanal olmayanlar:** Toplu e-posta listesi satın alma, otomatik takip botu, uygulama içi zorunlu davet kapısı, sahte hesapla içerik doldurma. Hiçbiri kullanılmaz.

---

## 3. İçerik tohumlama — dürüstlük sınırı

Boş bir akış ilk kullanıcıyı kaybettirir. Ama akışı sahte içerikle doldurmak da yasaktır (M-06). İzin verilen tek yol:

- **Gerçek kulüpler, gerçek etkinlikler.** Lansman öncesi K-1 ile gelen 3 kulüp, gerçek yaklaşan etkinliklerini yayımlar.
- Kulüp hesabı kulübün kendisi tarafından açılır; onun adına içerik üretilmez.
- Etkinlik yoksa akış boş kalır ve boş durum ekranı bunu dürüstçe söyler. Doldurma yapılmaz.

**Lansman eşiği:** en az 3 kulüp hesabı ve en az 5 yaklaşan etkinlik. Bu sağlanmadan geniş duyuru yapılmaz.

---

## 4. Funnel ve UTM

### Funnel

```
gösterim → store sayfası → kurulum → kayıt tamamlama
   → first_value_* → D1 dönüş → D7 dönüş
```

Her adımın karşılığı `measurement-plan.md` içinde bir olaydır. Ölçülemeyen adım funnel'da yer almaz.

### Kampanya adlandırma

```
uv_<kanal>_<aci>_<segment>_<yyyymm>
```

| Parça   | İzinli değerler                                        |
| ------- | ------------------------------------------------------ |
| kanal   | `kulup`, `album`, `topluluk`, `creator`, `aso`, `paid` |
| aci     | `etkinlik`, `kulup`, `gizlilik` (Açı 1/2/3)            |
| segment | `yeni`, `yonetici`, `aktif`                            |

Örnek: `uv_topluluk_gizlilik_yeni_202609`

### Attribution sınırı

- Üçüncü taraf attribution SDK'sı **yok** ve eklenmeyecek (KISS + gizlilik).
- Ölçüm, store konsolu kaynak raporu + uygulama içi privacy-safe olay sayacı ile yapılır.
- Kullanıcı düzeyinde kanal eşleştirmesi yapılmaz; yalnız toplam düzeyde bakılır.
- Bu, ölçümün bilinen ve kabul edilmiş sınırıdır — daha hassas attribution için gizlilikten ödün verilmez.

---

## 5. Zaman planı

Tarihler değil, **kapılar**. Bir kapı geçilmeden sonraki başlamaz.

| Faz                   | Kapı                                                                           | Çıktı                                 |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| F0 — Hazırlık         | Store listing yayında; `claims-register` `TASLAK` satırı metinde kullanılmıyor | Store sayfası canlı                   |
| F1 — Tohumlama        | 3 kulüp + 5 yaklaşan etkinlik                                                  | Akış boş değil                        |
| F2 — Dar duyuru       | K-1, K-2 çalışıyor                                                             | İlk gerçek etkinlik albümü            |
| F3 — Kampüs duyurusu  | D7 dönüş ölçülebilir hâlde                                                     | K-3, K-4 açılır                       |
| F4 — Ölçülü genişleme | `first_value_*` oranı iki hafta üst üste stabil                                | İkinci kampüs veya küçük ücretli test |

**Geri adım kuralı:** Herhangi bir fazda D7 dönüş oranı bir önceki fazın altına düşerse genişleme durur; sebep bulunana kadar bir sonraki faza geçilmez.

---

## 6. İkinci kampüse geçiş ölçütü

Yeni kampüs açmadan önce mevcut kampüste hepsi sağlanmalı:

- [ ] En az 5 aktif kulüp hesabı
- [ ] Ayda en az 10 yeni etkinlik
- [ ] Kurulum → `first_value_*` oranı iki hafta üst üste aynı seviyede veya üstünde
- [ ] Crash-free oturum oranı sürüm hedefinin üstünde
- [ ] Açık P0 güvenlik/gizlilik bulgusu yok

Bu liste tamamlanmadan ikinci kampüs açmak, ilk kampüsteki yoğunluğu bölerek her ikisini de zayıflatır.

---

## 7. Store deneyleri

- Baseline dönüşüm ve minimum trafik oluşmadan deney **başlatılmaz**.
- Bir testte tek hipotez: ya ilk üç görsel, ya kısa açıklama — ikisi birden değil.
- Uygulama içine A/B altyapısı eklenmez; deney yalnız store yüzeyinde yapılır (App Store Product Page Optimization / Play store listing experiments).
- Kazanan, yalnız kurulum artışına bakarak ilan edilmez: kurulum artarken `first_value_*` veya D7 düşüyorsa varyant **uygulanmaz**.
- İlk deney önerisi: Kare 5'i (gizlilik) 1. sıraya almak vs. mevcut sıra. Hipotez: gizlilik mesajı store'da en ayırt edici kanıt olduğu için ilk karede daha yüksek dönüşüm verebilir.
