# UniVerse — Konumlandırma ve Mesaj Hiyerarşisi

**Kural:** Bu belge yeni özellik tarif etmez. Var olan 24 ekranın anlattığı değeri sıraya koyar.
Her cümlenin arkasında `claims-register.md` içinde bir satır vardır.
**Son gözden geçirme:** 2026-09-04 · **Sahip:** Cayan Kuzu

---

## 1. Tek cümlelik konum

> **Kampüsteki insanları, kulüpleri ve etkinlikleri tek üniversite bağlamında keşfet.**

Bu cümlenin taşıdığı üç kanıt — ve başka hiçbiri:

| Kanıt | Nereden geliyor | Claims kaydı |
|---|---|---|
| Kampüs bağlamı profilin içinde | Kayıtta üniversite + bölüm seçimi (202 / 598 katalog değeri) | F-02 |
| Kulüp ve öğrenci ayrı hesap türü | `accountTypes` = `club, student` | F-01 |
| Etkinlik, albüm, yorum aynı akışta | `homeContentFilters`, `event_*` ve `album_*` tabloları | F-03, F-04, F-06 |

**Neden bu cümle:** Ürün bir "sosyal ağ" değil, bir **bağlam filtresidir**. Genel sosyal ağlarda kampüs bilgisi bir alan; burada tüm keşfin çerçevesi. Mesajın merkezine "bağlam" konur, "topluluk" değil — çünkü topluluk büyüklüğü iddiası M-01 ile yasaklıdır.

---

## 2. Hedef segmentler ve JTBD

Segmentler analytics'ten değil, üründeki gerçek rollerden türetildi: `accountTypes` iki tanedir, dolayısıyla iki birincil segment vardır. Üçüncüsü birincinin bir alt durumudur.

### Segment A — Yeni gelen öğrenci (birinci sınıf / yatay geçiş)

| Alan | İçerik |
|---|---|
| Durum | Kampüse yeni geldi, hangi kulübün ne yaptığını bilmiyor. Etkinlikleri Instagram story'lerinden ve koridor afişlerinden duyuyor; ikisi de kaybolur. |
| Motivasyon | Bir şeyi kaçırmamak ve "içeriden biri" olmak. |
| Engel | Bilgi dağınık ve zamana bağlı. Kime sorulacağı belli değil. |
| Mevcut çözüm | `SearchScreen` → `searchTypes` = kulüp/etkinlik; `HomeScreen` → `homeAccountFilters` = `clubs` |
| İlk anlamlı değer anı | **Kendi üniversitesinden bir kulübü veya etkinliği ilk kez listede görmek.** Ölçüm adı: `first_value_discovery` (`measurement-plan.md`). |

### Segment B — Kulüp yöneticisi

| Alan | İçerik |
|---|---|
| Durum | Etkinliği duyurmak için 3–4 kanal kullanıyor; katılımı tahmin ediyor; fotoğrafları etkinlikten sonra kimse bulamıyor. |
| Motivasyon | Duyurunun doğru kitleye ulaşması ve etkinlik sonrası görünürlük. |
| Engel | Duyuru dağınık, katılım ölçülemiyor, arşiv yok. |
| Mevcut çözüm | `CreateEventScreen`, `eventVisibilities`, `event_attendees`, `AlbumViewScreen` |
| İlk anlamlı değer anı | **İlk etkinliği yayımlamak ve ilk katılımcıyı görmek.** Ölçüm adı: `first_value_publish`. |

### Segment C — Aktif öğrenci (B'nin izleyicisi)

| Alan | İçerik |
|---|---|
| Durum | Zaten birkaç kulübü takip ediyor; sorunu keşif değil, takip. |
| Motivasyon | Takip ettiklerinden haber almak, etkinlik sonrası albümü görmek. |
| Engel | Genel akışta kampüs içeriği kayboluyor. |
| Mevcut çözüm | `homeSourceFilters` = `following`; 11 bildirim türü; `NotificationsScreen` kategori filtresi |
| İlk anlamlı değer anı | **İlk takip + ilk bildirimin gelmesi.** Ölçüm adı: `first_value_follow`. |

---

## 3. Mesaj hiyerarşisi

Tek ana değer önerisi, üç destek, bir güven mesajı. Sıra değişmez — reklam da store da sunum da bu sırayı izler.

```
        ANA:  Kampüsün tek yerde.
                     |
   +-----------------+-----------------+
   |                 |                 |
DESTEK 1         DESTEK 2          DESTEK 3
Etkinliği        Kulübü ve         Etkinlikten
kaçırma          öğrenciyi bul     sonra albüm
   |                 |                 |
   +-----------------+-----------------+
                     |
              GÜVEN: Konum izni istemiyoruz.
```

| Katman | Cümle | Kanıt | Nerede kullanılır |
|---|---|---|---|
| Ana | "Kampüsün tek yerde." | F-03 | Store başlığı altı, reklam ilk kare, sunum kapağı |
| Destek 1 | "Yaklaşan etkinlikleri kaçırma." | F-04, F-05 | Screenshot 1 başlığı |
| Destek 2 | "Kulüpleri ve öğrencileri bul." | F-01, F-07 | Screenshot 2 başlığı |
| Destek 3 | "Etkinliğin fotoğrafları, yorumları ve beğenileri aynı yerde." | F-06 | Screenshot 3 başlığı |
| Güven | "Konum izni istemiyoruz." | P-01 | Store açıklaması 3. satır, reklam alt yazısı, sunum güvenlik slaytı |

**Güven mesajının yeri neden bu kadar önde:** Bu, rakiplerin veremeyeceği ve incelemede doğrulanabilen tek iddia. Kampüs uygulaması kategorisinde konum izni beklenen bir şeydir; istememek fark yaratır ve store'un izin listesinden okunabilir.

---

## 4. Marka sesi

| İlke | Yapılır | Yapılmaz |
|---|---|---|
| Kısa | "Kulüpleri keşfet." | "Kampüsündeki tüm kulüpleri keşfetmenin en kolay yolu!" |
| Doğal Türkçe | "Etkinliğe katıl." | "Event'e join ol." |
| İkinci tekil | "Profilini kur." | "Profilinizi kurunuz." |
| Sonuç odaklı | "Yaklaşan etkinlikleri gör." | "Gelişmiş etkinlik yönetim altyapısı." |
| Abartısız | "Kampüs bağlamında ara." | "Yapay zekâ destekli akıllı keşif." |

Uygulama içi copy ile store/reklam copy'si **aynı terimleri** kullanır:
`etkinlik`, `kulüp`, `albüm`, `takip`, `bildirim`, `profil`. Store'da "event", "topluluk", "gönderi" gibi eş anlamlı kullanma — kullanıcı indirdikten sonra aradığı kelimeyi ekranda bulamaz.

---

## 5. Yasaklı ikna kalıpları (dark pattern)

Bunlar kampanya hedefine ulaştırsa bile kullanılmaz:

| Kalıp | Neden yasak |
|---|---|
| Sahte aciliyet ("Son 3 kontenjan!") | Kontenjan sayacı üründe yok; uydurma olur. |
| Confirmshaming ("Hayır, yalnız kalmayı tercih ederim") | Öğrenciye yalnızlık üzerinden baskı. |
| Zorunlu davet ("3 arkadaş davet et, aç") | Böyle bir kapı üründe yok ve eklenmeyecek. |
| Sahte sosyal kanıt ("Binlerce öğrenci") | M-01 ile yasaklı. |
| Otomatik izin baskısı | P-05 ile çelişir. |
| FOMO ile bildirim ("Herkes orada, sen yoksun") | Push copy'si sabittir ve genelidir (P-04). |

---

## 6. Rakip konumlandırması

Rakip **adı geçmez**, rakip kötülenmez. Fark, kendi kanıtımızla anlatılır:

| Genel sosyal ağlarda | UniVerse'te | Kanıt |
|---|---|---|
| Kampüs bilgisi bir profil alanı | Kampüs bağlamı tüm keşfin çerçevesi | F-02, F-03 |
| Etkinlik akışta kaybolur | Etkinlik ayrı bir içerik türü ve filtre | F-03, F-04 |
| Etkinlik fotoğrafı story'de uçar | Albüm etkinliğe bağlı kalır | F-06 |
| Konum genelde istenir | İstenmez | P-01 |

Bu tablo sunumda kullanılabilir; store metninde kullanılmaz (karşılaştırma store politikası açısından risklidir).
