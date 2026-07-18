# Release Rehearsal Checklist

## Deploy Sırası

1. DB migration rollout
2. Edge function deploy
3. `preview` EAS build alınması
4. Mobil runtime env rollout
5. Health endpoint kontrolü
6. Sentry release health + source map kontrolü
7. Maestro critical flow + smoke checklist koşulması

## Rehearsal Kabul Kriteri

- Migration hatası olmamalı.
- Health endpoint `legacyEdgeReadsEnabled=false` dönmeli.
- Projection hot-path ekranları açılmalı.
- Signed-in warm relaunch sonrası session restore doğrulanmalı.
- Critical smoke senaryoları temiz geçmeli.
- Queued background mutation akışları navigation ve relaunch sonrası kaybolmamalı.
- Geçici network failure sonrası retry / rollback davranışı kayda alınmalı.
- Telemetry eventleri dashboard'a düşmeli.
- Sentry preview release eventleri görünmeli.
- iOS telefon ve Android telefon smoke raporu aynı release build için kayda alınmalı.
- Android 320/360/390/430 dp, gesture/3-button nav ve %100/%150/%200 font scale görsel/a11y matrisi tamamlanmalı.
- Tablet veya landscape kapsam dışıdır; desteklenecekse mağaza metni ve checklist ayrıca güncellenmelidir.
- `npm run maestro:test:critical` preview build üzerinde geçmeli.
- Production build başlamadan önce `EXPO_IOS_GOOGLE_SERVICES_FILE`, `EXPO_ANDROID_GOOGLE_SERVICES_FILE` ve submit sırasında `EAS_ASC_API_KEY_PATH` güvenli file-secret olarak sağlanmalı. Android buildlerde `eas-build-post-install` otomatik olarak `npm run materialize:native-config` çalıştırır; Gradle yalnızca `android/app/google-services.json`, `android/app/src/debug/google-services.json` veya materyalize edilen `android/app/src/release/google-services.json` dosyalarını kabul eder.

## Rollback Tatbikati

1. Önce env rollback prosedürü doğrulanır.
2. Gerekirse previous edge deployment'a dönüş test edilir.
3. Mobile config rollback doğrulanır.
4. Rollback sonrası telemetry ve health tekrar kontrol edilir.

## Final Signoff

- `npm run check` temiz
- `npm run maestro:test:critical` temiz
- Load-test raporları hazır
- SQL validation raporları hazır
- Auth/session restore ve background mutation smoke notları kayda alınmış
- Runbook güncel
- Cutover checklist tamam
- `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` env parity doğrulandı
- Preview -> production channel mapping ve rollback sahibi onaylandı
