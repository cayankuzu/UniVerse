# UniVerse — Sunum İskeleti (Türkçe)

**Kural:** Uydurma pazar büyüklüğü, uydurma gelir, uydurma büyüme, uydurma testimonial yok.
Ölçülmemiş her şey **"henüz ölçülmedi"** diye yazılır. Bu, sunumu zayıflatmaz; güvenilir kılar.
**Son gözden geçirme:** 2026-09-04

---

## Tasarım sözleşmesi

Her slayt tek mesaj taşır. Kalabalık slayt, mesajı olmayan slayttır.

| Kural              | Değer                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Slayt başına mesaj | 1                                                                               |
| Slayt başına metin | En fazla 30 kelime                                                              |
| Boşluk oranı       | Slaytın en az %40'ı boş                                                         |
| Görsel             | Gerçek ekran görüntüsü (candidate build `1.0.134`) veya hiç                     |
| Renk               | `tokens.colors.primary` `#2563eb` tek vurgu · zemin `#ffffff` · metin `#0f172a` |
| Tipografi          | Inter — uygulamanın kendi ailesi. Başlık 40pt+, gövde 20pt+                     |
| Grafik             | Yalnız gerçek veri. Veri yoksa grafik yok.                                      |
| Slayt sayısı       | 10–12. Ek bilgi appendix'e.                                                     |

---

## Slayt 1 — Kapak

> **UniVerse**
> Kampüsün tek yerde.

Altta: sunan kişi, tarih, sürüm `1.0.134`.
Görsel: `HomeScreen` etkinlik akışı, cihaz çerçevesi içinde.

---

## Slayt 2 — Problem

> Kampüs duyurusu 24 saatte kayboluyor.

Üç satır, madde işareti yok:

- Etkinlik afişte, story'de ve grup sohbetinde ayrı ayrı duyuruluyor.
- Üçü de aranabilir değil; ertesi gün yok.
- Yeni gelen öğrenci hangi kulübün ne yaptığını kimseye soramadan öğrenemiyor.

**Sunum notu:** Bu slaytta sayı verilmez. Problem gözlemseldir; ölçülmüş bir problem gibi sunulmaz.

---

## Slayt 3 — Hedef kullanıcı

İki sütun, iki gerçek hesap türü (`accountTypes`):

| Öğrenci                             | Kulüp                                        |
| ----------------------------------- | -------------------------------------------- |
| Kampüste ne olduğunu görmek istiyor | Duyurusunun doğru kitleye ulaşmasını istiyor |
| Kulübü ve etkinliği arıyor          | Katılımı görmek istiyor                      |
| Etkinlik sonrası fotoğrafı arıyor   | Arşivin bir yerde kalmasını istiyor          |

**Sunum notu:** İki hesap türü ürün gerçeği; sunumda uydurulmuş persona kullanılmaz.

---

## Slayt 4 — Çözüm

> Kampüsteki insanları, kulüpleri ve etkinlikleri tek üniversite bağlamında keşfet.

Üç ekran görüntüsü yan yana: `HomeScreen` · `SearchScreen` · `AlbumViewScreen`.
Her birinin altında dört kelimelik etiket: `Akış` · `Arama` · `Albüm`.

---

## Slayt 5 — Gerçek kullanıcı yolculuğu

Tek bir yol, altı adım, hepsi var olan ekranlar:

```
Kayıt (üniversite + bölüm)
  → Akışta etkinlik
    → Etkinlik detayı
      → Katıl
        → Etkinlik günü
          → Albüm ve yorum
```

Altta tek satır: _Her adım candidate build'de mevcut bir ekrandır._

---

## Slayt 6 — Farklılaştırıcı

> Kampüs bilgisi bir profil alanı değil; keşfin çerçevesi.

| Genel sosyal ağ          | UniVerse                            |
| ------------------------ | ----------------------------------- |
| Kampüs bir alan          | Kampüs tüm keşfin bağlamı           |
| Etkinlik akışta kaybolur | Etkinlik ayrı içerik türü ve filtre |
| Fotoğraf story'de uçar   | Albüm etkinliğe bağlı kalır         |
| Konum genelde istenir    | İstenmez                            |

**Rakip adı yazılmaz.**

---

## Slayt 7 — Güvenlik, gizlilik ve teknik kalite

Dört kanıt, hepsi doğrulanabilir:

| Kanıt                                                   | Nerede doğrulanır                                    |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Konum izni yok — yalnız 4 izin                          | Store izin listesi                                   |
| Medya tek özel Storage kovasında, imzalı erişimle       | `docs/media-upload-security-runbook.md`              |
| Kilit ekranı bildirimi içerik taşımaz                   | `pushLockScreenPrivacy.contract.test.mjs`            |
| WCAG AA kontrast + 44dp dokunma hedefi makinece zorunlu | `check-text-contrast.cjs`, `check-touch-targets.cjs` |

**Sunum notu:** Bu slayt yatırımcı için değil, güven için. "Askeri düzeyde güvenlik" gibi bir cümle kurulmaz (P-06 yasak sütunu).

---

## Slayt 8 — Traction

> **Henüz ölçülmedi.**

Altında dürüst durum:

- Uygulama yayına hazırlanıyor; store hesabı ve gerçek kullanıcı verisi henüz yok.
- Ölçülecek olanlar tanımlı ve kurulu: `docs/marketing/measurement-plan.md`
- İlk ölçüm penceresi: ilk kampüs lansmanından sonraki 7 gün.

**Sunum notu:** Bu slaydı atlamak, sonradan sorulduğunda güveni kaybettirir. Boş traction'ı sahte sayıyla doldurmak yasaktır (M-01).

---

## Slayt 9 — Go-to-market

> Tek kampüs, kulüpten başlayarak.

| Sıra | Kanal                         |
| ---- | ----------------------------- |
| 1    | Kulüp yönetimleriyle birebir  |
| 2    | Etkinlik sonrası albüm        |
| 3    | Üniversite topluluk sayfaları |
| 4    | Store araması                 |

Altta tek satır: _Lansman eşiği: 3 kulüp hesabı, 5 yaklaşan etkinlik. Sağlanmadan geniş duyuru yok._

---

## Slayt 10 — İş modeli

> **Repository'de tanımlı bir gelir modeli yok.**

- Uygulamada satın alma, abonelik, reklam yüzeyi veya ödeme entegrasyonu bulunmuyor.
- Model belirlendiğinde ürün kararı olarak ayrıca ele alınacak.

**Sunum notu:** Var olmayan bir model uydurmak, sunumun en kolay yakalanan yalanıdır. Boş bırakmak daha güçlüdür.

---

## Slayt 11 — Sonraki adım

> Yeni özellik değil; kanıt.

| Adım                                     | Kanıt                                |
| ---------------------------------------- | ------------------------------------ |
| Same-SHA remote CI yeşil                 | GitHub Actions run ID'leri           |
| İmzalı Android + iOS artifact incelemesi | OTA/runtime parity kanıtı            |
| Gerçek cihazda push ve a11y turu         | `docs/push-real-device-matrix.md`    |
| İlk kampüs lansmanı                      | `go-to-market-plan.md` F1–F2         |
| İlk 7 günlük ölçüm                       | `measurement-plan.md` haftalık sayfa |

**Roadmap uydurulmaz.** Bu liste, yayın için gereken kanıtlardır — hayali özellik takvimi değil.

---

## Slayt 12 (opsiyonel) — Kapanış

> Kampüsün tek yerde.
> Konum izni istemiyoruz.

İletişim bilgisi. Başka hiçbir şey.

---

## Appendix (sorulursa)

| A-1 | Ürün yüzeyi | 24 ekran, 3 sekme, 11 bildirim türü, 4 izin, 51 HTTP route — `quality/feature-surface.snapshot.json` |
| A-2 | Mimari | `docs/mobile-architecture-blueprint.md`, `docs/database-architecture-blueprint.md` |
| A-3 | Gizlilik envanteri | `docs/network-and-data-inventory.md` |
| A-4 | İddia defteri | `docs/marketing/claims-register.md` |
| A-5 | Bilinen sınırlar | `docs/marketing/measurement-plan.md` §7 |

---

## Editable kaynak

Bu iskelet, sunum aracından bağımsızdır. Uygulanırken:

- Slayt oranı 16:9.
- Ekran görüntüleri `screenshot-storyboard.md` dosya adlarıyla aynı kaynaktan gelir.
- Her slaytın konuşma notuna, o slayttaki iddianın `claims-register.md` numarası yazılır (F-03, P-01 …). Bir slaytta numarası olmayan bir cümle varsa, o cümle sunumdan çıkar.
