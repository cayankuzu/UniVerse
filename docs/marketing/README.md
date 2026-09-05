# UniVerse — Pazarlama Paketi

Bu klasör uygulamaya **hiçbir özellik eklemez**. Var olan 24 ekranın anlattığı değeri, kanıta bağlı ve abartısız biçimde dışarı anlatmak için vardır.

## Okuma sırası

| #   | Dosya                                                          | Ne için                                                                                                  |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | [`claims-register.md`](claims-register.md)                     | **Önce bu.** Yayınlanabilir her cümlenin kaynağı. Buradaki kaydı olmayan iddia hiçbir yerde kullanılmaz. |
| 2   | [`positioning-and-messaging.md`](positioning-and-messaging.md) | Tek değer önerisi, üç destek, güven mesajı, segmentler ve JTBD                                           |
| 3   | [`store-listing-tr.md`](store-listing-tr.md)                   | App Store ve Play metinleri, anahtar kelimeler, gizlilik beyanları                                       |
| 4   | [`screenshot-storyboard.md`](screenshot-storyboard.md)         | Store görselleri ve video önizleme — piksel ölçüleri dâhil                                               |
| 5   | [`ad-creative-briefs.md`](ad-creative-briefs.md)               | Üç doğrulanabilir reklam açısı, hook ve varyantlar                                                       |
| 6   | [`go-to-market-plan.md`](go-to-market-plan.md)                 | Kanallar, faz kapıları, kampanya adlandırma                                                              |
| 7   | [`measurement-plan.md`](measurement-plan.md)                   | Funnel olayları, kalite kilidi, ölçümün bilinen sınırları                                                |
| 8   | [`pitch-deck-outline-tr.md`](pitch-deck-outline-tr.md)         | Sunum iskeleti ve tasarım sözleşmesi                                                                     |

## Değişmez kurallar

1. **Kayıtsız iddia yayınlanmaz.** Yeni bir cümle önce `claims-register.md` içine kanıtıyla girer.
2. **Sahte hiçbir şey yok.** Sahte kullanıcı, sahte sayı, sahte yorum, sahte ekran, sahte iş birliği.
3. **Ekran gerçek.** Store ve reklam görselleri yalnız candidate build'den alınır.
4. **Dil Türkçe.** Yeni dil eklenmez.
5. **Dark pattern yok.** Sahte aciliyet, confirmshaming, zorunlu davet, FOMO, otomatik izin baskısı.
6. **Pazarlama ürünü değiştirmez.** Bir kampanya fikri UI değişikliği gerektiriyorsa, kampanya fikri düşer.
7. **Kalite kilidi.** Kurulum artışı crash-free oranını, hata oranını veya D7 dönüşü bozuyorsa kampanya durur.

## Bağlı candidate

`config/app-release.json` → version `1.0.134` · Android versionCode `134` · iOS buildNumber `134`
Yüzey kaynağı: `quality/feature-surface.snapshot.json`

Candidate değiştiğinde `claims-register.md` baştan okunur; kanıt dosyası kaybolmuş her satır `TASLAK`'a düşer.
