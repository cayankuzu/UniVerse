import type { LegalDocument } from "./legalDocuments.types";

export const kvkkDocument: LegalDocument = {
  id: "kvkk",
  summary:
    "Bu metin; UniVerse içinde hangi verilerin hangi hukuki sebeplerle toplandığını, nasıl kullanıldığını, kimlerle paylaşılabildiğini ve KVKK kapsamındaki haklarını açıklar.",
  title: "KVKK Aydınlatma Metni",
  sections: [
    {
      heading: "Veri Sorumlusu ve Metnin Kapsamı",
      body: [
        "Bu aydınlatma metni, UniVerse mobil uygulaması üzerinden sunulan üyelik, profil, takip, etkinlik, albüm, yorum, bildirim, arama, raporlama ve güvenlik süreçlerinde işlenen kişisel verilere ilişkin olarak hazırlanmıştır.",
        "Metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında ilgili kişinin aydınlatılması amacıyla düzenlenir. Veri sorumlusu; UniVerse uygulamasını geliştiren, işleten ve kullanıcılara sunan gerçek veya tüzel kişi yapıdır. Yayımlanan resmî iletişim ve başvuru kanalları, veri sorumlusuna yöneltilecek talepler için esas alınır.",
        "Bu metin, uygulamadaki fiilî ürün akışlarını esas alır. Bu nedenle öğrenci ve kulüp hesabı oluşturma, oturum yönetimi, gizli hesap tercihi, takip ilişkileri, etkinlik paylaşımı, albüm yükleme, yorum ve beğeni işlemleri, engelleme, şikâyet ve bildirim mekanizmaları ayrıca dikkate alınmıştır.",
      ],
    },
    {
      heading: "İşlenen Kişisel Veri Kategorileri",
      body: [
        "Kimlik ve iletişim verileri: ad, kulüp adı, kullanıcı adı, e-posta adresi, üniversite, bölüm, sınıf veya yıl bilgisi, profil ve kapak görseli gibi hesap oluşturma ve profil düzenleme sırasında paylaşılan temel bilgiler.",
        "Hesap ve oturum verileri: kullanıcı kimliği, oturum kayıtları, yenilenen token bilgileri, oturumun cihazda sürdürülmesini sağlayan teknik kimlikler, hesap tipi, gizlilik tercihleri ve e-posta gizleme gibi profil ve hesap yapılandırmaları.",
        "İçerik ve etkileşim verileri: oluşturduğun veya katıldığın etkinlikler, albüm fotoğrafları, yorumlar, beğeniler, takip istekleri, takip ilişkileri, engelleme işlemleri, şikâyet kayıtları, etkinlik katılım bilgileri ve bunlara ilişkin zaman damgaları.",
        "Kullanım ve güvenlik verileri: hata kayıtları, performans ve işlem telemetrisi, istek yanıt durumları, istemci taraflı koruma ve kötüye kullanım önleme amaçlı loglar, açılış ve senkronizasyon ölçümleri ile güvenlik denetimine konu teknik kayıtlar.",
        "Cihaz ve izin verileri: bildirim izni durumu, konum izni durumu, medya veya fotoğraf erişim izni, yükleme sırasında kullanılan dosya ve medya teknik bilgileri ile uygulamanın cihaz tarafında oluşturduğu sınırlı teknik kayıtlar.",
      ],
    },
    {
      heading: "Verilerin Toplanma Yöntemi",
      body: [
        "Kişisel veriler doğrudan senden elde edilir. Kayıt formlarına girdiğin bilgiler, profil güncellemeleri, uygulama içindeki buton ve form etkileşimleri, yorum ve içerik paylaşımları, takip veya engelleme işlemleri ve izin ekranlarında verdiğin tercihler buna dahildir.",
        "Veriler ayrıca uygulama kullanımı sırasında teknik yollarla toplanabilir. Oturum doğrulama, güvenli giriş, görsel yükleme, bildirim kaydı, uygulama içi senkronizasyon, hata takibi ve güvenlik kayıtları bu kapsamdadır.",
        "Bazı veriler kullanıcı deneyimini sürdürmek amacıyla cihazda sınırlı süre ve sınırlı kapsamla saklanabilir. Örneğin oturumun kullanıcı çıkış yapmadığı sürece korunması, sorgu önbelleklerinin hız amacıyla tutulması ve geçici yerel içerik gölgelerinin yönetilmesi bu kapsama girebilir.",
      ],
    },
    {
      heading: "Kişisel Verilerin İşlenme Amaçları",
      body: [
        "Üyelik ve hesap yönetimi: hesap açma, hesap tipini belirleme, kullanıcıyı kimlik doğrulama sürecine alma, oturumu sürdürme, şifre yenileme, e-posta doğrulama ve kullanıcıya ait profil kaydını oluşturma.",
        "Topluluk ve sosyal etkileşim: profil görüntüleme, takip ve takip isteği yönetimi, gizli hesap akışları, engelleme işlemleri, bildirimlerin gösterimi, ilişki durumunun belirlenmesi ve diğer kullanıcılarla etkileşim kurulması.",
        "İçerik operasyonları: etkinlik oluşturma, güncelleme ve silme; albüm görseli yükleme ve silme; yorum, beğeni ve katılım işlemlerini yürütme; ilgili içeriği ana akış, profil, arama ve bildirim ekranlarında gösterebilme.",
        "Güvenlik ve kötüye kullanımla mücadele: sahte hesap oluşumunu azaltma, yetkisiz erişim girişimlerini tespit etme, şikâyet ve raporlar üzerinden moderasyon süreçlerini yürütme, teknik sorunları izleme ve hizmet bütünlüğünü koruma.",
        "Ürün sürekliliği ve iyileştirme: uygulama performansını anlamak, hata nedenlerini incelemek, açılış ve senkronizasyon gecikmelerini ölçmek, arayüz ve veri akışlarını geliştirmek, böylece daha tutarlı bir uygulama deneyimi sunmak.",
      ],
    },
    {
      heading: "Hukuki Sebepler",
      body: [
        "Kişisel veriler; bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması, veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi, bir hakkın tesisi, kullanılması veya korunması ve veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması hukuki sebeplerine dayanılarak işlenebilir.",
        "Bildirim, konum ve medya veya fotoğraf erişimi gibi cihaz izinleri ise ilgili özelliğin çalışması için kullanıcının cihaz seviyesindeki tercihine bağlıdır. Bu izinler verilmeden de uygulamanın bazı çekirdek alanları kullanılabilir; ancak ilgili özellikler kısıtlı veya devre dışı kalabilir.",
        "Ayrıca açık rıza gerektiren bir veri işleme durumu doğarsa, bu durum ilgili kullanıcı deneyimi içinde ayrıca sunulur ve teknik akış buna göre yapılandırılır.",
      ],
    },
    {
      heading: "Verilerin Kimlere ve Hangi Amaçlarla Aktarılabileceği",
      body: [
        "Kişisel veriler, uygulamanın teknik olarak çalışması için zorunlu olan altyapı ve hizmet sağlayıcılarla paylaşılabilir. Buna kimlik doğrulama, veritabanı, dosya depolama, gerçek zamanlı veri akışı, uygulama hatası ve performans izleme gibi hizmetler dahildir.",
        "Etkinlik, albüm, profil ve yorum gibi kullanıcı tarafından paylaşılan içerikler; seçilen görünürlük kuralları, takip ilişkileri ve ilgili ekran akışlarına bağlı olarak diğer kullanıcılar tarafından görülebilir. Kulüp ve öğrenci hesaplarına ilişkin farklı görünürlük davranışları uygulama mantığı dahilinde işlenir.",
        "Kamu kurum ve kuruluşları, mahkemeler, idari makamlar veya yetkili mercilerden usulüne uygun bir talep gelmesi hâlinde; yasal yükümlülük, denetim, uyuşmazlık veya hakkın korunması amacıyla gerekli veriler ilgili mercilerle paylaşılabilir.",
        "Yurt dışına aktarım gerektiren bir teknik hizmet kullanılıyorsa, bu aktarım Kanun ve ikincil düzenlemelerde öngörülen güvenceler, sözleşmesel düzenlemeler ve teknik-idari tedbirler dikkate alınarak yürütülür.",
      ],
    },
    {
      heading: "Saklama Süreleri ve İmha",
      body: [
        "Kişisel veriler; işleme amacı ortadan kalkana, ilgili mevzuatta öngörülen saklama süresi dolana veya kullanıcı hesabı, içeriği ya da ilgili kayıt için tutulması gereken meşru menfaat ihtiyacı sona erene kadar saklanabilir.",
        "Hesap silme, içerik silme veya uygulama içi görünürlük değişiklikleri sonrasında; ilgili veriler canlı görünümden kaldırılabilir, arka plan temizlik süreçlerine alınabilir veya teknik yedekleme ve periyot döngüleri tamamlandıktan sonra tamamen silinebilir ya da anonim hâle getirilebilir.",
        "Geçici cihaz önbellekleri, kuyruk kayıtları ve performans logları sürekli kalıcı depolama amacı taşımaz; ancak sistem güvenliği ve hata incelemesi gibi sınırlı teknik gereklilikler kapsamında belli sürelerle saklanabilir.",
      ],
    },
    {
      heading: "İlgili Kişi Olarak Hakların",
      body: [
        "KVKK'nin 11. maddesi kapsamında; kişisel verinin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme haklarına sahipsin.",
        "Ayrıca yurt içinde veya yurt dışında verilerin aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme, şartları oluşursa silinmesini veya yok edilmesini talep etme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme hakkın bulunur.",
        "Bunun yanında, işlenen verilerin münhasıran otomatik sistemler aracılığıyla analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz edebilir ve Kanuna aykırı veri işlenmesi nedeniyle zarara uğraman hâlinde zararın giderilmesini talep edebilirsin.",
        "Başvurularını, veri sorumlusunun ilan ettiği resmî başvuru usullerine uygun olarak iletebilirsin. Başvuru sırasında kimlik doğrulaması veya talebin ilgili hesaba ait olduğunun teyidi gerekebilir.",
      ],
    },
    {
      heading: "Güvenlik ve Kullanıcıya İlişkin Önemli Not",
      body: [
        "UniVerse; token, e-posta ve hassas teknik değerleri loglarda maskeleme, oturum yenileme, erişim sınırları, yetkilendirme kontrolleri ve veri görünürlüğünü ilişki bazlı kısıtlama gibi teknik ve idari önlemler uygular.",
        "Buna rağmen internet ortamında yapılan hiçbir aktarım veya depolama yöntemi mutlak güvenlik garantisi vermez. Bu nedenle şifreni güçlü seçmen, hesabını paylaşmaman ve şüpheli bir durumu gecikmeden bildirmen beklenir.",
        "Bu metin uygulama içi aydınlatma amacıyla hazırlanmıştır. Veri sorumlusunun unvanı, resmî iletişim adresi ve başvuru kanalı gibi kuruma özel bilgiler yayına çıkmadan önce gerçek bilgilerle tamamlanmalıdır.",
      ],
    },
  ],
};
