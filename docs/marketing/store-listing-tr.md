# UniVerse — Store Listing (Türkçe)

**Dil:** Yalnız Türkçe. Yeni dil eklenmez.
**Uygulama adı:** `UniVerse` — değişmez. Ad değişikliği ayrı bir marka ve store risk kararıdır.
**Bağlı candidate:** version `1.0.134` · Android versionCode `134` · iOS buildNumber `134`
**Kural:** Aşağıdaki her cümle `claims-register.md` içinde bir satıra bağlıdır. Kayıtsız cümle yayımlanmaz.

---

## 1. App Store (iOS)

### Ad (30 karakter sınırı)

```
UniVerse
```

8 karakter. Alt başlık için 22 karakter serbest kalıyor ama ada anahtar kelime doldurma **yapılmaz** — marka adı tek başına durur.

### Alt başlık / Subtitle (30 karakter)

```
Kampüs etkinlik ve kulüpleri
```

28 karakter. `etkinlik` ve `kulüp` en yüksek niyetli iki kelime; ikisi de uygulama içi copy ile aynı terim.

### Promosyon metni (170 karakter — sürüm çıkmadan güncellenebilir)

```
Üniversitendeki kulüpleri ve yaklaşan etkinlikleri tek yerde gör. Etkinliğin
albümü, yorumları ve beğenileri aynı ekranda kalır. Konum izni istemiyoruz.
```

152 karakter. İlk cümle işlev (F-03), ikincisi fark (F-06), üçüncüsü güven (P-01).

### Anahtar kelime alanı (100 karakter, virgülle, boşluksuz)

```
kampüs,üniversite,kulüp,etkinlik,öğrenci,bölüm,albüm,duyuru,topluluk,fakülte
```

76 karakter. Kurallar:

- Ad ve alt başlıktaki kelimeler burada **tekrarlanmaz** (Apple ikisini birleştirir).
- Rakip marka adı yok.
- Çoğul/tekil ikilisi yazılmaz; Apple kökten eşleştirir.
- Kalan 24 karakter bilinçli boş: ölçüm sonrası tek değişken denemek için ayrıldı (`store-experiments` bölümü).

### Açıklama (ilk 3 satır ekranda görünür — en kritik alan)

```
Üniversitendeki kulüpleri, yaklaşan etkinlikleri ve kampüsteki öğrencileri
tek yerde bul. Etkinliği oluştur, katıl, fotoğrafları etkinliğin albümünde
sakla. Konum izni istemiyoruz.

NE YAPABİLİRSİN

• Etkinlikleri gör ve katıl
  Yaklaşan etkinlikleri akışta gör; etkinliği herkese açık ya da yalnız
  üyelere görünür yayımla.

• Kulüpleri ve öğrencileri bul
  Öğrenci, kulüp, etkinlik ve albüm ara. Akışı kulüp/öğrenci ve takip
  ettiklerin olarak daralt.

• Etkinliğin anısını sakla
  Etkinliğin fotoğrafları, yorumları ve beğenileri aynı yerde kalır.

• Kampüs bağlamında profil
  Üniversiteni ve bölümünü seç; profilin kampüs bağlamına otursun.
  Öğrenci ya da kulüp olarak katılabilirsin.

• Bildirimleri ayır
  Takip, beğeni, yorum ve kulüp bildirimlerini kategoriye göre gör.

GİZLİLİK

• Konum izni istemiyoruz. Kampüs bağlamı üniversite bilgisinden gelir.
• Yalnızca dört izin: kamera, mikrofon, galeri, bildirim.
• Fotoğrafların herkese açık bir adreste durmaz.
• Kilit ekranında bildirimin içeriği değil, yalnız bildirim olduğu görünür.
• Hesabını gizle, e-postanı ayrıca sakla.
• Rahatsız eden hesabı engelle; kullanıcıyı, etkinliği, albümü veya yorumu
  şikâyet et.
• Hesabını uygulamadan silebilirsin.
```

### App Store gizlilik beyanı (Data Types)

Gerçek veri akışıyla eşleşmelidir. `network-and-data-inventory.md` ile birlikte doldurulur.

| Apple kategorisi                  | Beyan                        | Gerekçe / kanıt                  |
| --------------------------------- | ---------------------------- | -------------------------------- |
| Contact Info → Email              | Toplanır, hesaba bağlı       | Kayıt akışı; `profiles`          |
| Contact Info → Name               | Toplanır, hesaba bağlı       | Profil adı                       |
| User Content → Photos or Videos   | Toplanır, hesaba bağlı       | `album_photos`, `media_assets`   |
| User Content → Other User Content | Toplanır, hesaba bağlı       | Yorumlar                         |
| Identifiers → User ID             | Toplanır, hesaba bağlı       | `profiles.id`                    |
| Diagnostics → Crash Data          | Toplanır, hesaba bağlı değil | Sentry                           |
| Diagnostics → Performance Data    | Toplanır, hesaba bağlı değil | `client_telemetry_events`        |
| **Location**                      | **Toplanmaz**                | Konum izni yok — P-01            |
| **Contacts**                      | **Toplanmaz**                | Rehber izni yok                  |
| **Search History**                | **Toplanmaz**                | Arama sorgusu kalıcı saklanmıyor |
| Tracking                          | **Yok**                      | Üçüncü taraf reklam SDK'sı yok   |

---

## 2. Google Play (Android)

### Uygulama adı (30 karakter)

```
UniVerse
```

### Kısa açıklama (80 karakter — arama sonucunda görünür)

```
Kampüsündeki kulüpleri, etkinlikleri ve öğrencileri tek yerde bul.
```

66 karakter. Play'de kısa açıklama sıralamaya girer; üç birincil kelime (`kulüp`, `etkinlik`, `öğrenci`) burada.

### Tam açıklama (4000 karakter)

```
UniVerse, üniversitendeki kulüpleri, yaklaşan etkinlikleri ve kampüsteki
öğrencileri tek yerde toplar. Etkinliği oluştur, katıl, fotoğrafları
etkinliğin albümünde sakla. Konum izni istemiyoruz.


ETKİNLİKLER

Yaklaşan etkinlikleri akışında gör ve katıl. Kulüpsen etkinliği oluştur,
güncelle ve katılımı gör. Etkinliği herkese açık ya da yalnız üyelere
görünür yayımlayabilirsin.


KULÜPLER VE ÖĞRENCİLER

Öğrenci, kulüp, etkinlik ve albüm ara. Akışını içerik türüne, kulüp/öğrenci
ayrımına ve takip ettiklerine göre daralt.


ALBÜM VE YORUM

Etkinliğin fotoğrafları, yorumları ve beğenileri aynı yerde kalır.
Etkinlik bittikten sonra da o gün orada ne olduğunu bulursun.


KAMPÜS BAĞLAMINDA PROFİL

Üniversiteni ve bölümünü seçerek başlarsın. Öğrenci ya da kulüp olarak
katılabilirsin; ikisinin profili farklı bilgileri gösterir.


BİLDİRİMLER

Takip, takip isteği, beğeni, yorum ve kulüp bildirimlerini kategoriye göre
ayır. Bildirim iznini sen açana kadar istemiyoruz.


GİZLİLİK VE GÜVENLİK

• Konum izni istemiyoruz. Kampüs bağlamı üniversite bilgisinden gelir.
• Yalnızca dört izin kullanılır: kamera, mikrofon, galeri, bildirim.
• Fotoğrafların herkese açık bir adreste durmaz.
• Kilit ekranında bildirimin içeriği görünmez.
• Hesabını gizli yapabilir, e-posta görünürlüğünü ayrı seçebilirsin.
• Rahatsız eden hesabı engelle; kullanıcıyı, etkinliği, albümü veya yorumu
  şikâyet et.
• Hesabını uygulama içinden silebilirsin.


UniVerse Türkçe çalışır.
```

### Play Data Safety formu

| Play alanı                                                     | Beyan                                          | Gerekçe                                           |
| -------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Konum (yaklaşık/kesin)                                         | **Hayır**                                      | `androidPermissions` içinde konum izni yok — P-01 |
| Kişisel bilgi → E-posta, ad                                    | Evet, toplanır · şifreli aktarım · silinebilir | Kayıt akışı, `delete_own_account`                 |
| Fotoğraf ve video                                              | Evet, toplanır · şifreli aktarım · silinebilir | `album_photos`                                    |
| Ses                                                            | Hayır (kayıt saklanmaz)                        | Mikrofon yalnız video çekiminde kullanılır        |
| Uygulama etkinliği → Uygulama içi arama geçmişi                | **Hayır**                                      | Sorgu kalıcı saklanmıyor                          |
| Uygulama bilgileri ve performansı → Çökme günlükleri, tanılama | Evet · hesaba bağlı değil                      | Sentry, `client_telemetry_events`                 |
| Kişiler                                                        | **Hayır**                                      | Rehber izni yok                                   |
| Veri paylaşımı (üçüncü taraf)                                  | **Hayır**                                      | Reklam/attribution SDK'sı yok                     |
| Veri silme talebi                                              | Evet, uygulama içinden                         | `delete_own_account` RPC                          |

### İçerik derecelendirmesi ve UGC beyanı

- Uygulama kullanıcı üretimi içerik barındırır (fotoğraf, yorum).
- Moderasyon araçları: engelleme (`public.blocks`), şikâyet (`public.reports`, 5 hedef türü).
- Beyan, gerçek davranışla eşleşir: **admin paneli yoktur**; şikâyetler sunucu tarafında kayda geçer ve operasyon süreciyle ele alınır (`docs/moderation-*`).

---

## 3. Yayın öncesi kontrol listesi

- [ ] Her cümle `claims-register.md` içinde `ONAYLI` bir satıra bağlı
- [ ] `TASLAK` iddiadan gelen tek cümle yok (T-04, T-05 metinde geçmiyor)
- [ ] Ekran görüntüleri yalnız candidate build'den (`screenshot-storyboard.md`)
- [ ] Gizlilik beyanı `network-and-data-inventory.md` ile satır satır eşleşiyor
- [ ] Anahtar kelimelerde rakip marka adı yok
- [ ] Uygulama içi terimlerle store terimleri aynı (`etkinlik`, `kulüp`, `albüm`, `takip`)
- [ ] Sayısal büyüklük iddiası yok (M-01 … M-04)
