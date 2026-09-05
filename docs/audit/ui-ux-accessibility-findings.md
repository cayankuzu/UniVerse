# UI/UX ve Erişilebilirlik Denetimi — Bulgular ve Düzeltmeler

**Tarih:** 2026-09-04 · **Kapsam:** `src/mobile/app` altındaki bütün production `.ts`/`.tsx` dosyaları
**Sınır:** Yeni ekran, yeni CTA, yeni bileşen, yeni tema yok. Yalnız var olan yüzeyde ölçülebilir kusur düzeltmesi.

---

## 1. Yöntem

İki eksende ölçüm yapıldı; ikisi de öznel değil, hesaplanabilir:

| Eksen                | Ölçüt                       | Kaynak standart                                  |
| -------------------- | --------------------------- | ------------------------------------------------ |
| Metin/ikon kontrastı | Metin ≥ 4.5:1, grafik ≥ 3:1 | WCAG 2.2 SC 1.4.3 ve 1.4.11                      |
| Etkin dokunma alanı  | ≥ 44dp                      | Apple HIG 44pt, Material 48dp, WCAG 2.2 SC 2.5.8 |

Kontrast, tokenin **en kötü** eşleşmesine göre hesaplandı: bir ekranın metnin arkasına koyabileceği üç katman var — `surface` (#ffffff), `background` (#f8fafc), `surfaceVariant` (#f1f5f9). Bir token yalnız en açık katmanda geçiyorsa güvenli sayılmadı.

Ölçüm araçları repository'ye kalıcı olarak eklendi; tek seferlik bir denetim değil, kapı:

- `utils/guards/check-text-contrast.cjs` → `npm run guard:text-contrast`
- `utils/guards/check-touch-targets.cjs` → `npm run guard:touch-targets`

İkisi de `npm run check` içine bağlandı.

---

## 2. Kontrast bulguları

### 2.1 Sistemik: muted ailesi (≈180 kullanım)

| Token         | Önce      | `surfaceVariant` üzerinde | Sonra     | Sonuç    |
| ------------- | --------- | ------------------------- | --------- | -------- |
| `muted`       | `#64748b` | 4.34:1 ✗                  | `#5f6e83` | 4.74:1 ✓ |
| `mutedFg`     | `#64748b` | 4.34:1 ✗                  | `#5f6e83` | 4.74:1 ✓ |
| `textSubtle`  | `#64748b` | 4.34:1 ✗                  | `#5f6e83` | 4.74:1 ✓ |
| `iconMuted`   | `#64748b` | 4.34:1 ✗                  | `#5f6e83` | 4.74:1 ✓ |
| `neutralText` | `#6b7280` | 4.41:1 ✗                  | `#646a75` | 4.97:1 ✓ |
| `warningIcon` | `#d97706` | 2.91:1 ✗ (grafik)         | `#c2610a` | 3.83:1 ✓ |
| `dangerIcon`  | `#dc2626` | 4.41:1 ✗                  | `#d32222` | 4.77:1 ✓ |

**Neden token seviyesinde düzeltildi:** Aynı rol, aynı sorun, 180 çağrı yeri. Tek tek düzeltmek 180 ayrı karar demekti; token, tasarımın tek doğruluk kaynağı olduğu için düzeltme de oraya ait. Renkler **aynı ton ailesinde** kaldı — hue değişmedi, yalnız derinlik arttı. Ekranın görsel dili değişmedi.

### 2.2 Rol uyuşmazlığı: ikon rengi metin olarak kullanılmış

| Yer                              | Ne                   | Önce                 | Sonra         | Etki                                              |
| -------------------------------- | -------------------- | -------------------- | ------------- | ------------------------------------------------- |
| `RegistrationWizardSections.tsx` | Form alan hatası     | `red` 3.44:1         | `danger`      | **Hata metni**, ekranın en okunaklı yazısı olmalı |
| `VideoCameraCaptureHost.tsx`     | Kayıt süresi uyarısı | `red` 3.44:1         | `danger`      | Zaman baskısı altında okunan metin                |
| `EventDetailContent.tsx`         | "Katıldın" rozeti    | `successIcon` 3.58:1 | `successText` | Birincil durum onayı                              |
| `EventCardFooter.tsx`            | "Katıldın" rozeti    | `successIcon` 3.58:1 | `successText` | Aynı rozet, akış kartında                         |
| `UserListScreen.tsx`             | "Gizli" etiketi      | `warningIcon` 3.19:1 | `warning`     | 9px kalın metin                                   |
| `ProfileActionMenu.tsx`          | Şikâyet ikonu        | `amber` **2.15:1**   | `warning`     | Grafik eşiğinin bile altındaydı                   |

### 2.3 Hero gradyanı — karşılama ekranı

`WelcomeScreen` uygulamanın ilk ekranı ve store görselinin en güçlü adayı. Slogan, gradyanın en açık durağının (`primaryLight` #3b82f6) üzerine düşebiliyordu:

| Durum | Slogan rengi                                     | Kontrast          |
| ----- | ------------------------------------------------ | ----------------- |
| Önce  | `primarySoft` üzerinde `primaryLight`            | **3.01:1** ✗      |
| Sonra | `primarySofter` üzerinde `primary`…`primaryDark` | 4.75:1 – 6.16:1 ✓ |

Yapılan: gradyan durakları `[primaryLight, primary, primaryDark]` sırasına alındı — ışık yukarıdan gelir, metin aşağıdaki derin duraklara oturur. Bu, hem AA'yı geçiriyor hem de klasik bir hero aydınlatması. Slogan pastel kaldı (`primarySofter`), böylece başlıkla arasındaki hiyerarşi bozulmadı.

### 2.4 Kasıtlı istisna: FeedToast

Toast, `foreground` renginin %95 opaklıkta olduğu koyu bir katmanda durur. Tone renkleri o katmana göre seçilmiştir (7.37:1 – 12.96:1). Kod bunu artık söylüyor: `resolveTone` alanının adı `color` yerine `accent` oldu, üstünde neden koyu katmana göre ölçüldüğünü açıklayan bir not var.

---

## 3. Dokunma hedefi bulguları

| Yer                             | Kontrol                | Görünen | Etkin (sonra) |
| ------------------------------- | ---------------------- | ------- | ------------- |
| `CommentPanelComposer.tsx`      | Hızlı tepki çipi       | 38×34   | 54×50         |
| `CommentPanelComposer.tsx`      | Yorum gönder           | 42×42   | 58×58         |
| `CommentThreadBlock.tsx`        | Yanıtları göster/gizle | min 34  | 50            |
| `DetailViewerOverlayLayout.tsx` | Geri                   | 36×36   | 52×52         |
| `DetailViewerOverlayLayout.tsx` | Kapat                  | 32×32   | 48×48         |
| `EventLocationModal.tsx`        | Kopyala                | 28×28   | 48×48         |

Görünen boyutlar **değiştirilmedi** — yoğunluk bilinçli bir tasarım kararı. Eksik alan `hitSlop` ile geri alındı; görsel aynı, hedef büyüdü.

### Rol ve durum eksikleri

| Yer                              | Eksik                                     | Etki                                                                                                                    |
| -------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `EventDetailContentSections.tsx` | `accessibilityRole`, `accessibilityState` | Katılımcı çubuğu bir sayfa açıyor ama ekran okuyucuya düğme olduğunu söylemiyordu; devre dışıyken de bunu bildirmiyordu |
| `EventCardAttendanceBar.tsx`     | Aynı                                      | Aynı kontrolün akış kartındaki ikizi                                                                                    |

---

## 4. DRY bulgusu

`EventDetailLocationModal.tsx` ve `EventCardLocationModal.tsx` bayt bayt aynıydı; yalnız üç fark vardı: import sırası, bileşen adı ve **"Adres" etiketinin punto farkı** (`tiny` 9px / `caption` 10px). Yani kopya olmakla kalmıyor, aynı etiketi iki ekranda iki farklı boyutta gösteriyordu.

Tek `EventLocationModal` bileşenine indirildi; okunaklı olan punto (`caption`) her iki ekranda geçerli oldu. `guard:duplicate-modules` 1032 modülde başka kopya bulamıyor.

---

## 5. Kaldırılan ölü kod

`clearSensitiveClientState` bir `keepUiPrefs` seçeneği kabul ediyor ama gövdesinde hiç okumuyordu — çağıran "UI tercihlerim korunur" sanabilirdi, oysa `clearPersistedWarmupPreferences()` her koşulda çalışıyordu. Sessizce yanlış çalışan bir seçenek, hiç olmayan bir seçenekten kötüdür; kaldırıldı.

---

## 6. Ekran okuyucu duyuruları — iOS sessizliği

`accessibilityLiveRegion` React Native'de **yalnız Android** propudur. On iki yüzey değişikliğini
duyurmak için tek başına buna güveniyordu; iOS'ta hiçbiri konuşmuyordu:

| Yüzey                                          | Ne duyurulmuyordu                     |
| ---------------------------------------------- | ------------------------------------- |
| `AppNetworkStatusBanner`                       | Çevrimdışına düşme                    |
| `FeedToast`                                    | Uygulamanın ana geçici geri bildirimi |
| `AppActivityBanner`                            | Yükleme aşaması ve hatası             |
| `AsyncState`                                   | Yükleniyor ve hata durumu             |
| `TextField`, `SelectField`                     | Doğrulama hatası                      |
| `CategorySelector`                             | Seçim limiti ve doğrulama hatası      |
| `CommentPanelComposer`                         | Yorum gönderilemedi                   |
| `CreateEventSchedulePickerField`               | Geçersiz tarih                        |
| `SettingsScreen`, `SettingsDeleteAccountModal` | Hesap silme hatası                    |
| `RegistrationWizardSections`                   | Şifre kural durumu                    |

`useLiveRegionAnnouncement` iOS yarısını kapatıyor. Metin **gerçekten değiştiğinde** duyurur — aynı
mesajla yeniden render sessiz kalır — ve Android'de hiçbir şey yapmaz, çünkü orada live region zaten
konuşuyor; iki kez okunması gürültü olurdu.

İki yüzey bilinçli olarak bire bir aynalamıyor ve bunu kodda söylüyor:

- **Yükleme çubuğu** yüzdeyi değil aşamayı duyurur. 1'den 100'e sayan bir yükleme her şeyin üstüne konuşurdu.
- **Şifre kural listesi** yalnız geçerliliğe geçişi duyurur. Beş kuralı her tuş vuruşunda tekrarlamak,
  yazmanın kendisini bastırırdı; kurallar tek tek gezinerek okunabilir durumda kalıyor.

`check-live-region-parity.cjs` bu propu kullanıp hook'u kullanmayan bir dosyada kırmızı yanıyor.

---

## 7. Türkçe kopya doğruluğu

Dokuz kullanıcı-görünür metin diakritiklerini kaybetmişti; hepsi **onay ve hata** yüzeylerinde,
yani kullanıcının en çok dikkat ettiği yerlerde:

| Yer                                                                                   | Önce                      | Sonra                     |
| ------------------------------------------------------------------------------------- | ------------------------- | ------------------------- |
| `useCreateEventScreenState.ts`, `AlbumViewScreen.tsx`, `useEditProfileScreenState.ts` | `"Cik"`                   | `"Çık"`                   |
| `useCreateEventScreenState.ts`, `AlbumViewScreen.tsx`                                 | `"Taslak kapatilsin mi?"` | `"Taslak kapatılsın mı?"` |
| `useCreateEventFormState.ts`                                                          | `"Medya kirpilamadi."`    | `"Medya kırpılamadı."`    |
| `useCreateEventFormState.ts`                                                          | `"Medyalar secilemedi."`  | `"Medyalar seçilemedi."`  |
| `useCreateEventFormState.ts`, `useAlbumUploadWorkflowActions.ts`                      | `"Video kirpilamaz."`     | `"Video kırpılamaz."`     |
| `storage.image.ts`                                                                    | `"Dosya secilmedi."`      | `"Dosya seçilmedi."`      |
| `eventInteractionPresentation.ts`                                                     | `"Uni Gerekli"`           | `"Üni Gerekli"`           |

Hepsinin komşusu zaten doğruydu — aynı diyalogun `message` satırı "taslağı" yazıyordu, aynı switch'in
diğer dalları "Giriş Gerekli" ve "Erişim Yok" idi. Yani bunlar tercih değil, gözden kaçmış satırlardı.

**Neden guard yakalamamıştı:** `check-turkish-copy.cjs` yalnız JSX attribute'larına bakıyordu.
Artık kopya taşıyan object key'lerini (`title:`, `confirmLabel:` …) ve metni ekrana koyan hata
sink'lerini de okuyor. Bu genişletme dokuzuncu hatayı kendisi buldu.

ASCII'ye katlanmış **backend hata eşleştiricileri** (`"fotograf boyutu cok buyuk"`) kapsam dışında
kalmaya devam ediyor: onlar okunacak metin değil, karşılaştırılacak değer.

**Kapsam dışı:** `shared/catalog/categories.ts` içindeki bazı katalog değerleri de ASCII katlanmış
("Gomulu Sistemler", "Elektrik Muhendisligi"). Bunlar **kalıcı veri**; kullanıcı satırlarında ve
`feature-surface.snapshot.json` içindeki `valueSha256` alanında referanslanıyor. Yeniden adlandırmak
mevcut kayıtları öksüz bırakır, dolayısıyla ayrı bir veri taşıma kararıdır — kopya düzeltmesi değil.

---

## 8. Doğrulama

| Kapı                               | Sonuç                                                             |
| ---------------------------------- | ----------------------------------------------------------------- |
| `npm run guard:text-contrast`      | PASS — her metin ve ikon eşiğini geçiyor                          |
| `npm run guard:touch-targets`      | PASS — boyutu yazılı her pressable rol ve 44dp etkin alan taşıyor |
| `npm run guard:ui-system`          | PASS                                                              |
| `npm run guard:duplicate-modules`  | PASS — 1034 modül                                                 |
| `npm run check:types`              | PASS                                                              |
| `npm run lint`                     | PASS (0 uyarı)                                                    |
| `npm run format:check:all`         | PASS                                                              |
| `npm run guard:live-region-parity` | PASS — 12 live-region yüzeyi VoiceOver için de duyuruyor          |
| `npm run guard:turkish-copy`       | PASS — 909 modül                                                  |
| `npm run test:ci`                  | 322 suite / 1118 test PASS                                        |

Guard'ların gerçekten yakaladığı doğrulandı: bir `hitSlop` geçici olarak kaldırıldığında `check-touch-targets` `DetailViewerOverlayLayout.tsx:53`'ü bildirdi; kontrast token'ı geri alındığında `check-text-contrast` ilgili satırları listeledi; `AsyncState`'ten hook çıkarıldığında `check-live-region-parity` onu bildirdi.

---

## 9. Cihaz turuna bırakılan ölçüm: alt boşluk

Yedi ekran hem `SafeAreaView edges={["bottom"]}` hem de içerik `paddingBottom` içinde
`insets.bottom` kullanıyor: `VerifyEmailScreen`, `CreateEventScreen`, `NotificationsScreen`,
`BlockedUsersScreen`, `PermissionsSettingsScreen`, `PrivacySettingsScreen`, `SettingsScreen`.

`useBottomNavPadding` de `getMainBottomTabHeight(insets.bottom)` üzerinden inset'i **üçüncü kez**
sayıyor. Üstelik `shouldShowRootTabs` alt sekme çubuğunu yalnız Home/Search/Profile'da gösteriyor;
bu yedi ekranda çubuk yok, ama yeri ayrılıyor.

Çentikli bir iPhone'da (inset 34pt) `SettingsScreen` için kabaca:

```
SafeAreaView(bottom)            34pt
+ contentContainer paddingBottom max(109, 54) = 109pt
= 143pt
```

**Neden bu turda değiştirilmedi:** Bu bir `contentContainerStyle.paddingBottom`; içerik kısa olduğunda
liste kaymadığı için kullanıcı bunu boş alan olarak görmeyebilir. Gerçek etkisi yalnız cihazda
ölçülür. Boşluğu cihaza bakmadan daraltmak, düzeltmekten çok bozma riski taşır — ve bu, ürünü
"daha doğru" değil "farklı" yapardı.

**Cihaz turunda ölçülecek:** yukarıdaki yedi ekranda son öğe ile ekran altı arasındaki mesafe;
çentikli ve çentiksiz birer cihazda; alt sekme çubuğunun görünmediği doğrulanarak. Ölçüm fazlalığı
doğrularsa düzeltme `useBottomNavPadding` çağrısını sekme çubuğunun gerçekten görünür olduğu
ekranlarla sınırlamaktır — yeni bir bileşen veya yeni bir düzen değil.

---

## 10. Kapsam dışı bırakılanlar

Dürüstlük gereği açıkça yazılır:

| Konu                                     | Neden yapılmadı                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| VoiceOver / TalkBack ile uçtan uca tur   | Gerçek cihaz gerekiyor. Statik kanıt cihaz kanıtının yerine geçmez — `claims-register.md` T-04 `TASLAK`.                |
| Görsel regresyon baseline'ı              | Deterministik fixture ve baseline onay mekanizması ayrı bir iş; ekran görüntüsü diff'i otomatik olarak "iyi" sayılamaz. |
| Font scale 1.3 / 1.5 turu                | Cihaz/simülatör turu gerekiyor.                                                                                         |
| Küçük/standart/büyük telefon sınıfı turu | Aynı.                                                                                                                   |
| Karanlık tema                            | `N/A — EXPLICIT PRODUCT SCOPE`. Ürün tek temalıdır.                                                                     |
| Yeni dil / RTL                           | `N/A — EXPLICIT PRODUCT SCOPE`.                                                                                         |
