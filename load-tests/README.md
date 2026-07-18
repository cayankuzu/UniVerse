# Load Tests

Bu klasor `k6` tabanli production-oncesi yuk testi senaryolarini icerir.

Temel gerekli env degiskenleri:

- `K6_SUPABASE_URL`
- `K6_SUPABASE_ANON_KEY`

Auth secenekleri:

- Varsayilan: `K6_TEST_EMAIL` + `K6_TEST_PASSWORD`
- Read-only rehearsal: `K6_AUTH_MODE=anon`
- Harici token ile rehearsal: `K6_ACCESS_TOKEN=<jwt>`

`full` rehearsal / `npm run release:verify` icin ek projection hedefleri:

- `K6_PROFILE_USERNAME`
- `K6_EVENT_ID`
- `K6_PHOTO_ID`
- `K6_EVENT_COMMENT_ID`
- `K6_ALBUM_COMMENT_ID`

`K6_ENABLE_MUTATIONS=true` ise ek hedefler:

- `K6_TARGET_PROFILE_ID`
- `K6_TARGET_CLUB_ID`
- `K6_NOTIFICATION_ID`

Opsiyonel env degiskenleri:

- `K6_REHEARSAL_PROFILE=gate|full`
  - `gate` varsayilan profildir; `release:verify` icin daha kisa ve yerel makinada kosulabilir senaryolar kullanir.
  - `full` production-oncesi rehearsal / soak icin agresif VU ve sureleri acar.
- `K6_ENABLE_MUTATIONS=true`
  Not: follow, membership, notification-read, event like ve attendance mutasyonlarini da teste dahil eder.
- `K6_MIXED_HOME_STAGES_JSON=[{"duration":"30s","target":300},{"duration":"45s","target":1000},{"duration":"20s","target":0}]`
  - `mixed-1000` home senaryosunun ramp'ini manuel olarak override eder.

Komutlar:

- `npm run loadtest:smoke`
- `npm run loadtest:sustained`
- `npm run loadtest:1000`
- `npm run loadtest:rehearsal`

Beklenen esikler:

- `http_req_failed < 1%`
- cursor / load-more append projection path'leri hata vermemeli
- projection hot-path `p95 < 400ms`
- genel `http_req_duration p95 < 1000ms`
- edge timeout / DB lock / connection starvation olmamali

Notlar:

- Auth ve projection istekleri ayri tag'lenir; blocking threshold projection RPC gecikmesine gore degerlendirilir.
- `K6_AUTH_MODE=anon`, projection/read-only rehearsal icindir; mutasyon ve upload guvencesi saglamaz.
- `gate` profile `smoke + sustained` kosar; `full` profile buna ek olarak `1000 mix` senaryosunu da kosar.
- `gate` profile esikleri yerel/shared ortam dalgalanmasina toleransli tutulur; siki performans signoff'u `full` profile ve SQL raporlariyla yapilir.
- `gate` profilinde `smoke` fonksiyonel akisi dogrular; blocking latency kapisi `sustained` senaryosundadir.
- `gate` profilindeki `sustained`, kisa mini-soak'tir; production benzeri kapasite testi degildir.
- `full` profile kosulari ayrica raporlanmali; `gate` profile yalnizca yerel release dogrulama kapisidir.
- `full` profile, `K6_PROFILE_USERNAME`, `K6_EVENT_ID` ve `K6_PHOTO_ID` olmadan projection detay yollarini gercekten dogrulamaz; release signoff'ta bu hedefler zorunludur.
- `K6_ENABLE_MUTATIONS=true` ise follow / membership / notification-read / event-like / attendance mutasyonlari icin target ID env'leri zorunludur.

Kapsanan projection/read seti:

- `home_feed_projection`
- `notifications_projection`
- `notification_badge_projection`
- `profile_overview_projection`
- `profile_content_projection`
- `search_results_projection`
- `home_feed_projection` cursor / second-page append yolu
- `profile_content_projection` cursor / second-page append yolu
- `search_results_projection` cursor / second-page append yolu
- `event_detail_projection`
- `album_event_projection`
- `event_comments_projection`
- `event_likers_projection`
- `event_attendees_projection`
- `event_comment_likers_projection`
- `album_comments_projection`
- `album_comment_likers_projection`
- `album_photo_likers_projection`

`K6_ENABLE_MUTATIONS=true` ise eklenen mutasyon seti:

- `toggle_follow_with_patch`
- `toggle_club_membership_with_patch`
- `mark_notification_read_with_patch`
- `toggle_event_like`
- `toggle_event_attendance`
