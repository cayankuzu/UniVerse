# Offline ve işlem ölümü sözleşmesi

## Desteklenen davranış

- Home, Search, Profile ve Notifications okuma akışları projection-first çalışır. Daha önce kalıcılaştırılmış projection verisi ağ yokken gösterilebilir; SQL/RPC kaynağına yeniden bağlanınca kontrollü yenileme yapılır.
- Kayıtlı upload ve mutation kuyrukları owner kapsamıyla güvenli kalıcı depoda tutulur. Oturum sahibi eşleşmeden başka kullanıcının işi işlenmez.
- Geçici ağ ve sunucu hataları deterministik geri çekilme ile yeniden denenir. Kalıcı hatalar owner kapsamlı dead-letter kaydı olarak tutulur.
- İşlem bir kayıt `uploading` veya `running` durumundayken kapanırsa, sekiz saniyeyi aşan terk edilmiş claim bir sonraki okuma/uygulama açılışında `pending` durumuna geri alınır ve tekrar işlenebilir.
- Kuyruk işlemcileri uygulama yeniden öne geldiğinde, oturum geri yüklendiğinde ve yeni kuyruk sinyali oluştuğunda yeniden çalışır.

## Bilinçli sınırlar

- Bu sürüm bütün mutation sınıfları için genel amaçlı, 24 saatlik offline-first outbox garantisi vermez. Yalnızca kayıtlı upload ve mutation queue türleri bu sözleşmededir.
- JavaScript işlemcisi uygulama zorla kapatıldıktan sonra işletim sistemi seviyesinde arka planda çalışmayı garanti etmez. Android WorkManager veya iOS background URLSession tabanlı zorunlu aktarım bu sürümün parçası değildir.
- Uygulama kapanırken aktif aktarım kesilebilir; kalıcı checkpoint/queue kaydı sonraki doğrulanmış oturum açılışında devam etmeyi sağlar. Kullanıcıya gösterilen “uygulamadan çıkmayın” yönlendirmesi bu sınırla uyumludur.
- Hiç önbelleğe alınmamış projection verisi ağ yokken üretilemez. Bu durumda mevcut Türkçe boş/hata durumu gösterilir; legacy Edge GET okumasına dönülmez.

## Doğrulama

- `uploadQueue.test.ts`: FIFO, owner izolasyonu, geçici hata/backoff, dead-letter ve terk edilmiş `uploading` claim kurtarma.
- `mutationActionQueue.test.ts`: FIFO, idempotent dedupe, owner izolasyonu, offline retry, bounded concurrency, dead-letter ve terk edilmiş `running` claim kurtarma.
- Gerçek cihazda zorla kapatma, yeniden açma ve 24 saatlik çevrimdışı senaryoları release rehearsal kanıtına ayrıca eklenmelidir; otomatik birim testleri işletim sistemi yaşam döngüsü kanıtı yerine geçmez.
