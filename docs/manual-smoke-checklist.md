# Manual Smoke Checklist

## Device Matrix

- Android phone portrait: cache-first home, search, profile, notifications, pull-to-refresh, back stack
- Android large phone portrait: upload queue resume, notification badge, deep link return
- Android large phone or foldable narrow window: profile album grid density, create form scroll, image viewer bounds

## Cache-First ve Navigation

- app relaunch sonrasi `Home` cache-first acilmali
- app relaunch sonrasi `Profile` cache-first acilmali
- app relaunch sonrasi `Notifications` cache-first acilmali
- alt tab gecislerinde blocking spinner gorunmemeli
- warm relaunch primary screen ilk gorunur icerik `500ms` altinda kalmali
- cached tab switch `150ms` civarinda kalmali
- profile / event / album navigation oncesi prefetch ile detay ekrani bos acilmamali
- ayrintili performans rollout adimlari icin `docs/performance-verification-checklist.md` izlenmeli

## Auth ve Session

- signed-in warm relaunch sonrasi session restore korunmali; login shell'e dusmemeli
- signed-out cold launch `Giris Yap` / auth shell'ini gostermeli
- app startup sonrasi ilk yetkili fetch token restore ile bozulmamali

## Refresh ve Projection

- `pull-to-refresh` mevcut listeyi silmemeli
- refresh sonrasi scroll offset korunmali
- search bos query durumunda ag cagrisi yapmamali
- notifications badge ve liste okunma durumu tutarli kalmali
- load-more yalnizca sonraki sayfayi eklemeli; tum listeyi bastan cekmemeli
- projection hot-path ekranlari legacy GET route kullanmamali
- cache hit / load-more telemetry eventleri dusmeli

## Social ve Visibility

- follow / unfollow aninda UI tepki vermeli
- follow-request accept / reject bildirim satirinda aninda guncellenmeli
- membership request accept / reject tek satir bazli guncellenmeli
- block / unblock sonrasi home-search-profile-notifications icerigi aninda temizlenmeli
- blocked pair birbirinin profilini ve icerigini gormemeli
- private profile / followers_only / members_only gorunurlukleri dogru calismali

## Event ve Album

- create event sonrasi pending kart gorunmeli
- create event failure durumunda rollback dogru olmali
- comment create optimistic gorunmeli ve kalici yorumla dogru yer degistirmeli
- event detail cache'ten acilmali
- like / join / comment aksiyonlari hedefli patch ile guncellenmeli
- album grid cache'ten acilmali
- upload pending tile gorunmeli
- upload retry / fail / replace davranisi dogru olmali
- scanner timeout/5xx durumunda album yayinlanmamali ve retry kullaniciya acik kalmali
- checksum, MIME veya boyut uyusmazliginda medya goruntulenmemeli; obje cleanup retry kuyruğuna girmeli
- basarili coklu medya albumunde session ve tum item'lar tek album islemiyle `finalized` olmali
- album comment add / delete sayaclari tutarli kalmali
- event detail ve album detail intent-prefetch ile hizli acilmali

## Profile

- edit profile optimistic header guncellemesi aninda gorunmeli
- profile update sonrasi optimistic state ve kalici veri tutarli kalmali
- avatar / cover upload confirm ve rollback dogru olmali
- followers / following / members / clubs sayaclari guncel kalmali
- settings ve privacy akislari phone + large-phone/foldable narrow-window portrait'te tasma yapmamali

## Background Mutation

- create event baslatildiktan sonra ekrandan ayrilinca background mutation devam etmeli
- album upload baslatildiktan sonra navigation veya relaunch sonrasi pending state kaybolmamali
- follow / profile update / event create queued islemleri gecici ag kesintisinden sonra retry ile devam etmeli
- temporary network failure sonrasi retry veya rollback ghost state birakmamali

## Observability

- preview build acilisinda `release-health:preview:app-launch` Sentry'e dusmeli
- JS error boundary fallback ekrani acildiginda Sentry event olusmali
- source map / symbol upload sonrasi stack trace minified gorunmemeli
