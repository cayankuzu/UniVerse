import type { LegalDocument } from "./legalDocuments.types";

export const privacyDocument: LegalDocument = {
  id: "privacy",
  summary:
    "Bu politika; profil görünürlüğü, içeriklerin kimlere açık olduğu, uygulamada hangi izinlerin neden istendiği, güvenlik kayıtlarının nasıl kullanıldığı ve verilerin ne zaman silindiği gibi başlıkları açıklar.",
  title: "Gizlilik Politikası",
  sections: [
    {
      heading: "Politikanın Amacı",
      body: [
        "Bu gizlilik politikası, UniVerse mobil uygulamasını kullanırken hangi bilgilerin toplandığını, bu bilgilerin ne şekilde korunduğunu ve hangi görünürlük kurallarıyla kullanıldığını anlaşılır bir dille açıklamak için hazırlanmıştır.",
        "Politika; yalnızca kayıt aşamasını değil, giriş, oturumun korunması, profil güncelleme, etkinlik ve albüm paylaşımı, yorum, beğeni, takip, engelleme, raporlama, arama ve bildirim akışlarını da kapsar.",
      ],
    },
    {
      heading: "Hesap ve Profil Bilgileri",
      body: [
        "UniVerse üzerinde öğrenci veya kulüp hesabı oluşturabilirsin. Hesap tipine göre senden istenen bilgiler ve profilde görünen alanlar değişebilir. Kullanıcı adı, ad veya kulüp adı, üniversite, görsel alanlar, biyografi ve ilgi kategorileri buna örnektir.",
        "Profilinde paylaştığın bilgilerin bir kısmı diğer kullanıcılar tarafından görülebilir. E-posta gibi daha hassas alanlar ise profil ayarları ve gizlilik tercihleri doğrultusunda sınırlandırılabilir. Kulüp ve öğrenci hesapları için farklı varsayılan gizlilik davranışları uygulanabilir.",
        "Oturumunu kapatmadığın sürece uygulama, cihazdaki güvenli depolama ve teknik oturum mekanizmaları yardımıyla hesabını tekrar giriş yaptırmadan açık tutabilir. Bu tercih, kullanıcı deneyimini hızlandırmak ve süreklilik sağlamak içindir.",
      ],
    },
    {
      heading: "Takip, Gizli Hesap ve İlişki Verileri",
      body: [
        "UniVerse, takip ilişkileri üzerinden içerik ve profil görünürlüğünü yönetebilir. Bir hesabı takip ettiğinde, takip durumu ana akışta, bildirimlerde, profil ekranlarında ve görünürlük kararlarında kullanılabilir.",
        "Gizli hesap yapısının aktif olduğu durumlarda, ilgili kullanıcının etkinlik, albüm veya ilişki listeleri sadece onaylı takip ilişkisi bulunduğunda görünür hale gelebilir. Engelleme durumunda ise profil ve etkileşim akışlarının tamamı veya bir bölümü kısıtlanabilir.",
        "Takip, takip isteği, onay, engelleme ve engel kaldırma gibi işlemler; hem ürün deneyimini çalıştırmak hem de kullanıcı güvenliğini sağlamak amacıyla kaydedilir ve ilgili ekranlara yansıtılır.",
      ],
    },
    {
      heading: "Etkinlik, Albüm ve Topluluk İçerikleri",
      body: [
        "Kulüp veya uygun yetkiye sahip hesaplar etkinlik oluşturabilir; başlık, açıklama, tarih, saat, lokasyon, kategori, kapasite, erişim seviyesi, görsel ve benzeri alanları paylaşabilir. Bu veriler etkinlik kartlarında, detay sayfalarında, arama sonuçlarında ve profil ekranlarında kullanılır.",
        "Albüm ve medya paylaşımlarında; yüklenen fotoğraf, bağlı olduğu etkinlik, açıklama niteliğindeki yorumlar, beğeniler ve etkileşim sayıları işlenir. Fotoğraf yükleme özelliği kullanıldığında cihazının medya erişim izni devreye girebilir.",
        "Yorum, beğeni ve katılım gibi sosyal işlemler içerik deneyiminin doğal parçası olarak kaydedilir. Bu bilgiler ilgili içerik bağlamında diğer kullanıcılara görünebilir ve içeriğin sosyal durumunu göstermek amacıyla kullanılabilir.",
      ],
    },
    {
      heading: "Arama, Keşif ve Bildirimler",
      body: [
        "Arama ve keşif deneyimi; kullandığın filtreler, sorgular, ilişki durumu ve içerik görünürlüğü kuralları temel alınarak şekillenir. Bu kapsamda arama terimleri, seçilen filtreler ve ilgili sonuç kapsam bilgileri sınırlı teknik amaçlarla işlenebilir.",
        "Bildirimler; yeni takipler, takip istekleri, etkileşimler, etkinlik akışları veya sistem duyuruları için kullanılabilir. Bildirim izni verirsen cihazına anlık bildirimler gönderilebilir; izin vermezsen bu kanal devre dışı kalır ancak uygulama içi bildirim deneyimi kısmen devam edebilir.",
        "Gerçek zamanlı güncellemeler ve önbellek yenilemeleri, içeriklerin daha hızlı ve tutarlı gösterilmesi için kullanılır. Bu süreçte teknik ekran anahtarları, senkronizasyon olayları ve istek başarı durumu gibi performans verileri ölçülebilir.",
      ],
    },
    {
      heading: "Cihaz İzinleri ve Neden İstendikleri",
      body: [
        "Konum izni, yakınındaki veya lokasyon temelli etkinlikleri daha anlamlı gösterebilmek için istenebilir. Konum verisinin kullanım seviyesi, izin tercihin ve ilgili özelliğin gerekliliğiyle sınırlıdır.",
        "Bildirim izni, etkinlik hatırlatmaları, sosyal etkileşim uyarıları veya sistem bilgilendirmeleri gönderebilmek için kullanılır. Bu izin tamamen cihaz ve kullanıcı tercihine bağlıdır.",
        "Fotoğraf ve medya erişimi, albüm veya etkinlik bağlantılı görsel yüklemelerinde gereklidir. İzin vermemen durumunda yükleme ve seçim süreci kısıtlanır, ancak uygulamanın tüm çekirdek bölümleri zorunlu olarak devre dışı kalmaz.",
      ],
    },
    {
      heading: "Güvenlik, Hata Kayıtları ve Kötüye Kullanımla Mücadele",
      body: [
        "Uygulama; yetkisiz erişim, bozuk oturum, geçersiz token, sunucu hatası, performans sorunu ve kötüye kullanım girişimlerini tespit edebilmek için belirli teknik kayıtlar üretebilir. Bu kayıtlarda hassas değerler olabildiğince maskelenir veya sınırlı tutulur.",
        "Hata ve performans verileri; çökme nedenlerini incelemek, silme veya paylaşım gibi kritik aksiyonlardaki sorunları bulmak, açılış sürelerini iyileştirmek ve güvenlik risklerini azaltmak için kullanılır.",
        "Şikâyet, raporlama ve moderasyon akışları topluluk güvenliğini korumak için gereklidir. Bir içeriği veya kullanıcıyı raporladığında ilgili kayıtlar inceleme, yaptırım veya savunma süreci için değerlendirilebilir.",
      ],
    },
    {
      heading: "Üçüncü Taraf Hizmetler ve Aktarım",
      body: [
        "UniVerse; kimlik doğrulama, veritabanı, depolama, medya, gerçek zamanlı veri akışı, hata takibi ve performans izleme gibi alanlarda üçüncü taraf teknik servislerden yararlanabilir. Bu servisler sadece hizmeti sunmak, güvenliği sağlamak ve ürünü ayakta tutmak amacıyla kullanılır.",
        "Bu servis sağlayıcılar veriyi kendi adlarına serbestçe kullanmak için değil, sunulan teknik hizmeti yerine getirmek için erişebilir. Erişim kapsamı sözleşmesel ve teknik tedbirlerle sınırlandırılmaya çalışılır.",
        "Yasal zorunluluk veya resmî makam talepleri hâlinde, gerektiği ölçüde bilgi paylaşımı yapılabilir. Bunun dışında veri paylaşımı, uygulama deneyiminin sağlanması ve güvenlik gereksinimleriyle sınırlı tutulur.",
      ],
    },
    {
      heading: "Saklama, Hesap Silme ve İçerik Kaldırma",
      body: [
        "Hesabını veya içeriğini sildiğinde ilgili kayıtlar uygulama arayüzünden kaldırılabilir; ancak teknik olarak kesin silme, arka plan temizlik süreçleri, yedekleme döngüleri ve hukuki zorunluluklar nedeniyle belirli bir süre alabilir.",
        "Geçici kuyruklar, cihaz önbellekleri, performans logları ve hataya ilişkin teknik kayıtlar kalıcı yayın içeriği değildir. Bu veriler sürekli olarak değil, işlevsel ve güvenlik odaklı sınırlı sürelerle tutulur.",
        "Hesap silme sonrasında da yasal zorunluluk, ispat, güvenlik incelemesi veya dolandırıcılıkla mücadele gibi sebeplerle bazı kayıtlar gerekli olduğu ölçüde saklanabilir.",
      ],
    },
    {
      heading: "Politika Değişiklikleri",
      body: [
        "UniVerse ürün akışlarını, teknik altyapısını veya hukuki uyum gerekliliklerini güncellediğinde bu gizlilik politikası da güncellenebilir. Esaslı değişiklikler uygulama içi bilgilendirme, yeni sürüm notu veya benzeri bir duyuru ile kullanıcıya sunulabilir.",
        "Politikanın güncel sürümü uygulama içinde gösterilen metindir. Uygulamayı kullanmaya devam etmen, yasal zorunlulukların izin verdiği ölçüde güncel metni inceleme sorumluluğunu da beraberinde getirir.",
      ],
    },
  ],
};
