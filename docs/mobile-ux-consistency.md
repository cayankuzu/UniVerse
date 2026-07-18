# UniVerse Mobile UX Consistency Blueprint

Bu belge, mimari gecis sonrasi UI/UX tutarliligini korumak icin kullanilan kanonik kurallari toplar.

## 1. Ortak component yuzeyi

Yeni ekranlar once `shared/components` katmanina bakar. Tekrarlanan patternler ekran icinde yeniden yazilmaz.

Oncelikli ortak componentler:

- `AsyncState`
- `EmptyState`
- `AppListSkeleton`
- `AppButton`
- `AppTextField`
- `AppFlatList`
- `Avatar`

## 2. Loading, empty, error davranisi

Liste ekranlari icin zorunlu kurallar:

- ilk acilista snapshot yoksa `AppListSkeleton`
- snapshot varsa once last-known content
- hata halinde ortak `AsyncState`
- bos sonuc halinde ortak `EmptyState`

Kanonik dagilim:

- `AsyncState`: detail veya form benzeri tekil yuzeyler
- `AppFlatList` / `AppListScreen`: liste loading/error/empty secimini otomatik yapan katman
- `AppListSkeleton`: liste ve grid ilk-acilis iskeleti

Bu kurallar projection-first veri mimarisi ile uyumludur.

## 3. Screen rolu

Container ekranlar:

- navigation alir
- feature hook cagirir
- presentational componente veri gecirir

Presentational componentler:

- side-effect tasimaz
- data fetch bilmez
- reusable veya feature-local UI rolundedir

## 4. Form ve CTA yuzeyi

Form ve eylem yuzeylerinde ortak davranis:

- primary CTA tek ve net olmali
- validation mesajlari kisa ve tekrar etmeyen dilde olmali
- pending aksiyonlarda optimistic geri bildirim korunmali

## 5. Scroll ve liste deneyimi

- uzun listelerde `AppFlatList`
- row componentleri hafif ve tekrar render maliyeti dusuk olmali
- refresh ekrani sifirlamamali

## 6. I18n ve metin

Hard-coded string sayisi azaltilmali; ortak metinler `src/mobile/app/shared/i18n` katmaninda tutulmali.

Microcopy kurali:

- kisa
- yonlendirici
- teknik olmayan

## 7. Accessibility minimumlari

- ana CTA ve navigation aksiyonlarinda `accessibilityLabel`
- yeterli touch target
- okunur kontrast

## 8. Review checklist

Bir UI degisikligi merge olmadan once su sorulara evet denmelidir:

- ortak component varken ekran ici tekrar yazilmadi mi
- loading/empty/error state tutarli mi
- liste ekranlari `AppFlatList` veya `AppListScreen` uzerinden ortak state kontratini kullaniyor mu
- cache-first akis yuzunden ani bos ekran olusuyor mu
- optimistic aksiyon feedbacki kayboldu mu

Bu belge, tasarim tutarliligini veri mimarisiyle birlikte korumak icin referans kabul edilir.
