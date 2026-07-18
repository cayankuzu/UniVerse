# UniVerse Mobile Traffic Architecture

Bu belge, istemci ve backend tarafinda gereksiz trafik olusmamasini saglayan kanonik kurallari ozetler.

## 1. Istemci trafik kurallari

Ana ilke:

- tekrar acilan ekran tam payload istemez
- delta sync ve cache hit ilk tercih olur

Destekleyici kurallar:

- search requestleri `350ms` debounce kullanir
- pagination cursor tabanlidir
- ayni query key tekrarinda TanStack Query coalescing davranisi korunur

## 2. Projection read modeli

Okuma agirligi olan yuzeyler projection/RPC uzerinden calisir:

- home
- search
- notifications
- profile
- relationship listeleri
- detail yuzeyleri

Mobile primary read olarak legacy edge veya compat read acilmaz.

## 3. Delta ve pagination

Standart parametre modeli:

- `cursor`
- `limit_count`
- `since`
- `delta_token`

Tum buyuk listeler icin hedef:

- tam liste yerine farklari almak
- cursor ile kontrollu sayfalama

## 4. Mutasyon trafigi

Mutasyon sonrasi beklenen desen:

- optimistic patch
- gerekiyorsa tekil stale mark
- sessiz delta sync

Yasak desen:

- tek aksiyon sonrasi tum feed veya tum profile refetch

## 5. Idempotency

Desteklenebilen mutasyon yollarinda `clientMutationId` kullanimi tercih edilir.
Amac:

- ayni istegin yeniden gonderilmesi duplicate etki uretmesin

Bu fazda desteklenen yollar:

- follow toggle
- follow request accept/reject
- block/unblock
- notification read-all/read-one
- event like
- event attendance

## 6. Queue ve agir isler

Mevcut upload ve event create queue korunur.
Bu fazda genel offline mutation outbox eklenmez.

## 7. Olculmesi gereken trafik metrikleri

- request sayisi
- `delta_payload_size`
- broad refetch sayisi
- error rate
- hot path response suresi

## 8. Operasyonel kabul kriteri

Sistem buyudukce de su kural korunmali:

- istemci once cache kullanir
- backend sadece gerekli farklari yollar
- mutasyonlar gereksiz read tsunamisi baslatmaz

Bu trafik modeli, zero-wait hissini network ve veritabani maliyeti patlatmadan korumak icin kullanilir.
