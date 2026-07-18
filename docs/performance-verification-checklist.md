# Performance Verification Checklist

Bu checklist performans refactor rollout'u sirasinda cihaz baglamadan tamamlanacak isleri ve cihaz uzerinde yapilacak son dogrulamalari ayirir.

## Debug APK'dan Once

- `npm run check`
- pagination/cursor migration'larini staging'e uygula
- `supabase/validation/01_hot_path_explain.sql` calistir
- `supabase/validation/06_projection_cursor_paths.sql` calistir
- `npm run loadtest:smoke`
- mumkunse `npm run loadtest:sustained`
- load-test sonucunda:
  - `http_req_failed < 1%`
  - projection hot-path `p95 < 400-500ms`
  - genel `http_req_duration p95 < 1000ms`
  - auth ve projection latency ayni metricte karistirilmamali; projection gate ayri raporlanmali

## Staging / SQL Kabul Kriteri

- `home_feed_projection` ilk sayfa ve cursor'lu ikinci sayfa planlari kabul edilebilir kalmali
- `home_feed_projection` `sort_mode = 'newest'` ve `sort_mode = 'oldest'` icin plan bozulmamali
- `profile_content_projection` `events` ve `album` tab'leri ikinci sayfa append yolunda tam taramaya dusmemeli
- `search_results_projection` `events`, `albums`, `clubs` cursor yolunda kabul edilebilir planda kalmali
- default ilk sayfa boyutlari `20-30` araliginda kalmali; tum liste replace davranisina geri donulmemeli

## Cihaz Uzerinde

- gercek performans olcumu icin `debug` yerine mumkunse `release` veya en az `profile` build kullan
- `Home`, `Profile`, `Notifications`, `Search` icin ilk anlamli render suresini olc
- `pull-to-refresh` baslangici ile yeni datanin uygulanmasi arasindaki sureyi olc
- geri donuslerde ekran cache'ten doluyor mu kontrol et
- load-more ikinci sayfa append ederken liste flash / scroll jump yapiyor mu kontrol et
- uzun listelerde scroll jank veya frame drop gozle gorulur olmamali

## Telemetry / Log Kontrolu

- `*:first-visible` screen event'leri dusmeli
- `*:refresh` event'leri ilgili ekran anahtariyla dusmeli
- `*:load-more` projection event'leri ikinci sayfa append yolunda dusmeli
- cache-hit / cache-path event'leri projection-first davranisi dogrulamali

## Notlar

- Debug APK yalnizca fonksiyonel smoke icin uygundur; performans sayilari icin baz alinmamali
- SQL validation ve k6 sonuclari temiz degilse mobil cihaz smoke'una gecilmemeli
