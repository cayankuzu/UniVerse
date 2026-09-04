# UniVerse — Store Görseli ve Önizleme Storyboard'u

**Kural:** Her kare, candidate build'de (`1.0.134`) gerçekten var olan bir ekrandan alınır.
Var olmayan kontrol, sahte sayı, sahte kullanıcı, sahte rozet veya uydurma bildirim **çizilmez**.
**Son gözden geçirme:** 2026-09-04

---

## 1. Neden bu sıra

Store galerisinde kullanıcı ortalama olarak ilk 2–3 kareyi görür; geri kalanı için yatay kaydırma gerekir. Bu yüzden ilk üç kare birbirini tekrar etmeden **üç farklı kullanıcı işini** anlatır ve her biri tek bir mesaj taşır. Sıra, `positioning-and-messaging.md` mesaj hiyerarşisiyle birebir aynıdır — kullanıcı reklamda gördüğü cümleyi store'da, store'da gördüğünü uygulamada bulur.

| Kare | Kullanıcı işi | Mesaj katmanı | Kaynak ekran |
|---|---|---|---|
| 1 | "Neler oluyor?" | Destek 1 — Etkinliği kaçırma | `HomeScreen` (etkinlik filtresi açık) |
| 2 | "Kimi/neyi bulurum?" | Destek 2 — Kulübü ve öğrenciyi bul | `SearchScreen` (kulüp sekmesi) |
| 3 | "Sonrasında ne kalır?" | Destek 3 — Albüm | `AlbumViewScreen` |
| 4 | "Ben nasıl görünürüm?" | Bağlam | `ProfileScreen` (kulüp profili) |
| 5 | "Kontrol bende mi?" | Güven | `PrivacySettingsScreen` |
| 6 | "Etkinliği nasıl açarım?" | Kulüp segmenti | `CreateEventScreen` |

Kare 6 yalnız Play'de kullanılır (Play 8 görsele izin verir, App Store 10). App Store'da 5 kare yeterlidir; fazlası tıklama oranını artırmaz.

---

## 2. Kare kare storyboard

Her karede: **üstte tek satır başlık**, altta gerçek ekran görüntüsü. Başlık, ekranın yapabildiğinden fazlasını vaat etmez.

### Kare 1 — Etkinlik akışı

| Alan | İçerik |
|---|---|
| Başlık | `Yaklaşan etkinlikleri kaçırma` |
| Alt satır (opsiyonel, küçük) | `Kampüsündeki etkinlikler tek akışta` |
| Ekran | `HomeScreen`, içerik filtresi `events`, kaynak filtresi `all` |
| Görünmesi gereken | En az 2 etkinlik kartı; tarih, konum, katılım göstergesi; alt sekme çubuğu |
| Görünmemesi gereken | Boş durum, hata bandı, çevrimdışı bandı, yükleme iskeleti |
| Fixture kuralı | Etkinlik adları sentetik ve açıkça kurgusal; gerçek bir kulübün adı **kullanılmaz** (M-05) |
| Claims | F-03, F-04 |

### Kare 2 — Arama

| Alan | İçerik |
|---|---|
| Başlık | `Kulüpleri ve öğrencileri bul` |
| Ekran | `SearchScreen`, tür sekmesi `clubs`, sonuç listesi dolu |
| Görünmesi gereken | Arama alanı yazılı hâlde, 3–4 sonuç satırı, tür sekmeleri |
| Görünmemesi gereken | Klavye (ekranın yarısını kapatır), boş sonuç |
| Claims | F-07, F-01 |

### Kare 3 — Albüm

| Alan | İçerik |
|---|---|
| Başlık | `Etkinliğin anısı burada kalır` |
| Ekran | `AlbumViewScreen`, ızgara dolu, bir fotoğrafta yorum sayacı görünür |
| Görünmesi gereken | Etkinlik başlığı, fotoğraf ızgarası, beğeni/yorum sayacı |
| Görünmemesi gereken | Yükleme yer tutucusu, kırık görsel |
| Fixture kuralı | Fotoğraflar telifsiz veya kendi çekimimiz; tanınabilir yüz için yazılı izin |
| Claims | F-06 |

### Kare 4 — Kulüp profili

| Alan | İçerik |
|---|---|
| Başlık | `Kulüp ve öğrenci profilleri` |
| Ekran | `ProfileScreen`, kulüp hesabı |
| Görünmesi gereken | Kulüp adı, kategori, takipçi/etkinlik sayacı, etkinlik sekmesi |
| Görünmemesi gereken | Doğrulama rozeti benzeri bir işaret (üründe yok — uydurulamaz) |
| Claims | F-01, F-02 |

### Kare 5 — Gizlilik

| Alan | İçerik |
|---|---|
| Başlık | `Konum izni istemiyoruz` |
| Alt satır | `Hesabını gizle, e-postanı ayrıca sakla` |
| Ekran | `PrivacySettingsScreen`, iki anahtar görünür |
| Görünmesi gereken | Hesap gizliliği ve e-posta görünürlüğü anahtarları, durum açıklamaları |
| Claims | P-01, F-09 |

### Kare 6 — Etkinlik oluştur (yalnız Play)

| Alan | İçerik |
|---|---|
| Başlık | `Kulübünün etkinliğini yayımla` |
| Ekran | `CreateEventScreen`, form doldurulmuş, görünürlük seçimi görünür |
| Claims | F-04, F-05 |

---

## 3. Teknik özellikler

### Boyutlar

| Hedef | Piksel | Not |
|---|---|---|
| App Store 6.9" (zorunlu) | 1290 × 2796 | iPhone 16 Pro Max sınıfı |
| App Store 6.5" (zorunlu) | 1242 × 2688 veya 1284 × 2778 | |
| Play telefon | 1080 × 1920 (min 320, max 3840) | 16:9 veya 9:16; en fazla 8 görsel |
| Play özellik grafiği | 1024 × 500 | Metin **güvenli alanda**: kenarlardan 64 px içeri |

### Güvenli alan ve tipografi

- Başlık üst kenardan **en az 120 px** aşağıda başlar (App Store'da üstteki ~%12'lik alan galeri kırpmasında riskli).
- Başlık punto: 6.9" karede **en az 64 px**; küçük ekranda okunmalı. Kural: başlığı 1290 px genişlikte yaz, sonra %25 küçültüp oku — hâlâ okunuyorsa geçer.
- Başlık **tek satır**. İki satıra taşan başlık, mesajın çok uzun olduğunu gösterir.
- Ekran görüntüsü çerçevesi cihaz mockup'ı içinde; cihaz çerçevesi alt kenarda kırpılabilir.
- Arka plan: `tokens.colors.primary` → `primaryDark` dikey geçiş. Aynı gradyan `WelcomeScreen` hero'sunda kullanılır; galeri ile uygulama aynı görünür.
- Başlık rengi `#ffffff`; `primary` üzerinde 5.17:1 kontrast (AA geçer, `tokens.test.ts` ile aynı hesap).

### Dosya adlandırma

```
appstore/tr/6.9/01-etkinlik-akisi.png
appstore/tr/6.9/02-arama-kulup.png
appstore/tr/6.9/03-album.png
appstore/tr/6.9/04-kulup-profili.png
appstore/tr/6.9/05-gizlilik.png
play/tr/phone/01-etkinlik-akisi.png
...
play/tr/feature-graphic.png
```

---

## 4. Video önizleme (App Store, 15–30 sn)

Yalnız gerçek ekran kaydı. Kurgu ekran, hızlandırılmış sahte etkileşim, var olmayan geçiş yok.

| Saniye | Sahne | Kaynak |
|---|---|---|
| 0–3 | `HomeScreen` etkinlik akışı, yavaş kaydırma | Gerçek kayıt |
| 3–7 | Bir etkinlik kartına dokun → `EventDetailScreen` | Gerçek kayıt |
| 7–11 | Katıl → durum değişimi ("Katıldın" rozeti) | Gerçek kayıt |
| 11–16 | `AlbumViewScreen` ızgara, bir fotoğrafa dokun | Gerçek kayıt |
| 16–20 | `SearchScreen` kulüp araması | Gerçek kayıt |
| 20–24 | `PrivacySettingsScreen` — kapanış kartı: "Konum izni istemiyoruz" | Gerçek kayıt + metin overlay |

Ses yok (store önizlemeleri çoğunlukla sessiz izlenir). Metin overlay'leri store başlıklarıyla **aynı cümleler**.

---

## 5. Yasaklar

- Gerçek build'de olmayan bir ekran, düğme, rozet veya sayaç çizmek.
- Katılımcı/takipçi/beğeni sayısını gerçekte olmayan bir büyüklükte göstermek.
- Gerçek bir kulübün adını, logosunu veya üniversite armasını izinsiz kullanmak.
- Uygulama mağazası derecelendirmesi veya ödül görseli uydurmak.
- Fixture içeriğini gerçek kullanıcı içeriği gibi sunmak.
- Başlıkta ekranın yapamadığını vaat etmek (örn. "Takvimine ekle" — böyle bir işlev yok).

---

## 6. Figma / editable kaynak

Figma MCP bağlı **değil**. Bu yüzden storyboard yukarıdaki ölçü, güvenli alan, renk ve dosya adı bilgisiyle uygulanabilir bırakıldı.

Figma açılırsa:
- Ayrı bir `Marketing Assets` sayfası oluşturulur; production UI frame'lerine dokunulmaz.
- Frame adları dosya adlarıyla aynı olur (`01-etkinlik-akisi`).
- Figma Make kullanılmaz — mockup üretimi gerçek ekran görüntüsü yerine geçemez.
