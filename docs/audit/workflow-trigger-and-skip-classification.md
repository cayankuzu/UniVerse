# Workflow Tetikleme ve "Skipped" Sınıflandırması

**Tarih:** 2026-09-04 · **Branch:** `chore/aaa-mvp-hardening-docker-cloudflare-ota-push`
**Soru:** `093d47e…` üzerinde `cloudflare-production` ve `eas-update-preview` neden çalışmadı; bu bir kapı arızası mı?

**Cevap:** Hayır. İkisi de `workflow_dispatch`-only'dir; bir PR olayında **hiç tetiklenmezler**. GitHub'ın PR görünümünde "skipped/çalışmadı" gibi okunması, kapının kırmızı olduğu anlamına gelmez. Buna karşılık **gerçek bir kırmızı kapı vardı** ve o düzeltildi: `security-verify / secret-scan`.

---

## 1. Tam tetikleyici matrisi

| Workflow                | Tetikleyiciler                                               | Job'lar                                                                            | Sınıf                                                    |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `security-verify`       | `pull_request`, `push` (main / release), `workflow_dispatch` | `internal-verify`, `secret-scan`, `sast`                                           | **PR-REQUIRED**                                          |
| `docker-validation`     | `pull_request`, `push`, `workflow_dispatch`                  | `docker-validate-immutable`                                                        | **PR-REQUIRED**                                          |
| `cloudflare-preview`    | `pull_request`, `workflow_dispatch`                          | `verify`, `deploy-preview`                                                         | **PR-OTOMATİK** (deploy adımı provider secret'ına bağlı) |
| `release-verify`        | `push`, `workflow_dispatch`                                  | `repository-verification`, `provider-verification`                                 | **PUSH/MANUEL**                                          |
| `cloudflare-production` | **yalnız** `workflow_dispatch`                               | `dispatch_guard`, `verify_candidate`, `production`, `rollback`                     | **MANUEL PROVIDER KAPISI**                               |
| `eas-update-preview`    | **yalnız** `workflow_dispatch`                               | `verify-preview`, `publish-preview`, `verify-device-attestation`, `attest-devices` | **MANUEL PROVIDER KAPISI**                               |
| `eas-update-production` | **yalnız** `workflow_dispatch`                               | `verify-production`, `publish-production`                                          | **MANUEL PROVIDER KAPISI**                               |

## 2. Zorunlu check bağlamları

`utils/ops/validate-github-required-checks.cjs` → `REQUIRED_CHECK_NAMES`:

```
internal-verify
secret-scan
sast
docker-validate-immutable
```

Dördü de `pull_request` ile tetiklenen workflow'lardan gelir. `cloudflare-production` ve `eas-update-*` bu listede **yoktur** ve olmamalıdır: bunlar dağıtım/terfi kapılarıdır, kod incelemesi kapıları değil.

## 3. Sınıflandırma

| Durum                                       | Sınıf                                            | Release anlamı                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloudflare-production` bu SHA'da çalışmadı | `MANUAL_PROVIDER_GATE — NOT TRIGGERED BY DESIGN` | PR için nötr. Production dağıtımı için **hâlâ gerekli**; korumalı ortam onayı ve rollback provası ile ayrıca çalıştırılır.                      |
| `eas-update-preview` bu SHA'da çalışmadı    | `MANUAL_PROVIDER_GATE — NOT TRIGGERED BY DESIGN` | PR için nötr. OTA terfisi için **hâlâ gerekli**; imzalı Android+iOS binary'de runtime/channel parity ve rollback görülmeden production OTA yok. |
| `security-verify / secret-scan` başarısızdı | `REQUIRED GATE — GERÇEK ARIZA`                   | **Düzeltildi.** Aşağıya bakınız.                                                                                                                |

**Kural:** Bu iki manuel kapının çalışmamış olması `PASS` sayılmaz; `N/A` da sayılmaz. Sınıfı `NOT TRIGGERED`'dır ve release kararında ayrı bir satır olarak durur.

## 4. Düzeltilen gerçek arıza — `secret-scan`

**Belirti:** Job, tek bir commit taramadan başarısız oluyordu.

**Kök neden:** `gitleaks/gitleaks-action@v2` çalışma zamanında `GITHUB_TOKEN` ortam değişkenini zorunlu tutar ve yoksa taramadan önce durur. Workflow yalnız `GITLEAKS_CONFIG` geçiyordu.

**Uygulanan minimum çözüm** (`.github/workflows/security-verify.yml`):

1. `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` eklendi; job `permissions: contents: read` ile en dar yetkiye sabitlendi.
2. `GITLEAKS_ENABLE_COMMENTS: false` ve `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false` — böylece job'un `pull-requests: write` gibi bir yetkiye ihtiyacı kalmadı.
3. Action yalnız olayın commit aralığını tarar. Sızıp sonra silinmiş bir secret için asıl önemli olan tam geçmiştir; bu yüzden **sabitlenmiş ve checksum'ı doğrulanan** gitleaks `8.28.0` kurulup aynı job içinde tam geçmiş ve çalışma ağacı taramaları da çalıştırılıyor:
   - `npm run security:secrets:history` → `gitleaks git . --log-opts="--all"`
   - `npm run security:secrets` → `gitleaks dir .`

**Tarama kapsamı veya kural gevşetilmedi.** `.gitleaks.toml` allowlist'i olduğu gibi duruyor.

**Yerel doğrulama (2026-09-04, gitleaks 8.30.1):**

| Tarama                              | Sonuç                                  |
| ----------------------------------- | -------------------------------------- |
| `gitleaks git . --log-opts="--all"` | tüm geçmiş tarandı, **sızıntı yok**    |
| `gitleaks dir .`                    | çalışma ağacı tarandı, **sızıntı yok** |

Commit sayısı ve taranan bayt her koşuda değişir; burada kaydedilen sonuç "sızıntı yok"tur.
Sayısal ayrıntı, aynı SHA'ya bağlı CI koşusunun kendi çıktısından okunur.

Bu yerel sonuç remote CI sonucunun yerine geçmez; PR koşusu aynı SHA'da yeşile döndüğünde run ID'si `docs/release-readiness.md` içine yazılır.

## 5. Kalan manuel işler

Bu kapılar yalnız operatör tarafından, provider yetkisiyle çalıştırılabilir:

- [ ] `eas-update-preview` (`mode: publish`) — aynı candidate SHA'da
- [ ] `eas-update-preview` (`mode: attest-devices`) — gerçek Android + iOS cihaz kanıtıyla
- [ ] `cloudflare-production` (`action: upload` → `rollout-5` → …) — korumalı ortam onayıyla
- [ ] Main/target branch protection ruleset — dört zorunlu check bağlamıyla

Ayrıntı: `docs/MANUAL_STEPS.md`.
