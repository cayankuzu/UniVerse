import type { LegalDocument } from "./legalDocuments.types";

export const termsDocument: LegalDocument = {
  id: "terms",
  summary:
    "Bu koşullar; UniVerse hizmetinin kapsamını, öğrenci ve kulüp hesaplarının sorumluluklarını, içerik paylaşım kurallarını, yaptırım mekanizmalarını ve hizmete ilişkin temel hukuki çerçeveyi açıklar.",
  title: "Kullanım Koşulları",
  sections: [
    {
      heading: "Hizmetin Tanımı ve Kabul",
      body: [
        "UniVerse; üniversite odaklı topluluklar, kulüpler, etkinlikler, albümler ve sosyal etkileşim süreçleri için sunulan bir mobil uygulamadır. Uygulamaya kayıt olarak, giriş yaparak veya uygulama içindeki işlevleri kullanarak bu kullanım koşullarını kabul etmiş sayılırsın.",
        "Bu koşullar; hesap açma, giriş yapma, profil oluşturma, takip ilişkileri kurma, etkinlik oluşturma veya katılma, albüm paylaşma, yorum yazma, içerik silme, hesap silme ve diğer ürün akışlarının tamamı için geçerlidir.",
      ],
    },
    {
      heading: "Uygunluk ve Hesap Tipleri",
      body: [
        "UniVerse üzerinde öğrenci veya kulüp hesabı açılabilir. Hesap türünün doğru seçilmesi kullanıcının sorumluluğundadır. Yanlış veya aldatıcı hesap tipiyle hareket edilmesi, hesap doğrulama ve erişim kısıtlarına neden olabilir.",
        "Uygulamayı kullanırken paylaştığın bilgilerin doğru, güncel ve gerçeğe uygun olması gerekir. Başkasına ait kimlik, kulüp, e-posta veya temsil yetkisini izinsiz kullanarak hesap oluşturman yasaktır.",
        "Hukuken bağlayıcı bir dijital hizmeti kullanmaya ehil değilsen veya temsil ettiğin kulüp ya da kurum adına gerekli yetkiye sahip değilsen uygulamayı bu amaçla kullanmaman gerekir.",
      ],
    },
    {
      heading: "Hesap Güvenliği ve Oturum Sorumluluğu",
      body: [
        "Şifreni ve hesaba erişim sağlayan diğer bilgileri korumak senin sorumluluğundadır. Hesabını başkalarıyla paylaşmamalı, güvenli olmayan cihazlarda oturum bırakmamalı ve şüpheli kullanımı fark ettiğinde derhal gerekli önlemleri almalısın.",
        "UniVerse, kullanıcı çıkış yapmadığı sürece oturumu teknik olarak belirli sürelerle açık tutabilir. Bu deneyim hız ve süreklilik amacıyla tasarlanır; ancak cihazına erişen üçüncü kişilere karşı gerekli fiziksel ve dijital güvenlik önlemlerini sen almalısın.",
        "Yetkisiz kullanım, ele geçirilmiş hesap, güvenlik istismarı veya sistematik kötüye kullanım tespit edilirse hesap geçici veya kalıcı olarak kısıtlanabilir.",
      ],
    },
    {
      heading: "İçerik Üretimi ve Sorumluluk",
      body: [
        "Etkinlik, albüm, yorum, profil biyografisi, açıklama ve diğer tüm kullanıcı içeriklerinden; bu içeriğin hukuka uygunluğundan ve gerekli haklara sahip olmandan sen sorumlusun.",
        "Paylaştığın bir görsel, metin, afiş, logo veya diğer içerik; üçüncü kişilerin fikrî mülkiyet, kişilik, gizlilik veya diğer haklarını ihlal etmemelidir. Gerekiyorsa ilgili izinleri önceden almış olman beklenir.",
        "UniVerse, ürün deneyimini sunabilmek için kullanıcı içeriğini ilgili ekranlarda gösterme, senkronize etme, önizleme üretme, teknik olarak depolama ve silme sürecine alma hak ve yetkisine sahiptir.",
      ],
    },
    {
      heading: "Topluluk Kuralları ve Yasaklı Davranışlar",
      body: [
        "Taciz, nefret söylemi, tehdit, aşağılama, nefret veya şiddeti teşvik eden içerikler, ayrımcılık, kişiyi hedef gösteren paylaşımlar, istenmeyen içerik, dolandırıcılık, sahte kampanya, zararlı bağlantı yayma ve hukuka aykırı faaliyetler yasaktır.",
        "Başka bir kullanıcının verilerini izinsiz yaymak, özel hayatını ifşa etmek, hesabı taklit etmek, takip veya yorum sistemini manipüle etmek, bot kullanmak, güvenlik açığı aramak ya da sistemleri zorlamak da yasaklı davranış kapsamındadır.",
        "Kulüp hesapları, temsil ettiklerini belirttikleri topluluk adına gerçeği yansıtmayan, aldatıcı veya yetkisiz içerik paylaşmamalı; etkinlik bilgilerini olabildiğince doğru, net ve güncel tutmalıdır.",
      ],
    },
    {
      heading: "Etkinlikler, Albümler ve Sosyal Etkileşimler",
      body: [
        "Etkinlik oluşturan kullanıcı; etkinliğin tarih, saat, konum, açıklama, erişim seviyesi ve benzeri alanlarından sorumludur. Yanıltıcı, mevcut olmayan veya güvenlik riski oluşturan etkinlik paylaşımı uygulama kurallarına aykırıdır.",
        "Albümlere yüklenen görsellerin ilgili etkinlik veya topluluk bağlamıyla uyumlu olması beklenir. Uygunsuz, hak ihlali doğuran veya topluluk güvenliğini zedeleyen medya içerikleri kaldırılabilir.",
        "Yorum, beğeni, katılım, takip ve engelleme gibi sosyal özellikler kötüye kullanılmamalıdır. Sırf rahatsızlık vermek, hedef göstermek veya sistemleri manipüle etmek amacıyla yoğun ve kötü niyetli kullanım yasaktır.",
      ],
    },
    {
      heading: "Moderasyon, Raporlama ve Yaptırım",
      body: [
        "UniVerse; kullanıcı raporları, teknik tespitler, güvenlik sinyalleri veya hukuki gereklilikler doğrultusunda içerikleri inceleyebilir. Bu inceleme sonucunda içerik kaldırma, görünürlük kısıtlama, özellik kapatma, geçici askıya alma veya kalıcı hesap kapatma gibi yaptırımlar uygulanabilir.",
        "Bir içeriğin raporlanması, otomatik olarak haklı bulunduğu anlamına gelmez. Ancak topluluk güvenliği veya yasal risk gerektiriyorsa, inceleme tamamlanmadan önce geçici önlemler alınabilir.",
        "Yaptırım kararları; tekrar eden ihlaller, ağır risk oluşturan davranışlar, sahtecilik, yetkisiz erişim denemeleri veya başkalarının haklarını ciddi şekilde ihlal eden durumlarda daha sert uygulanabilir.",
      ],
    },
    {
      heading: "Fikrî Mülkiyet ve Lisans",
      body: [
        "Uygulamanın arayüzü, yazılımı, tasarımı, marka unsurları, veri modeli, metinleri ve sistematik yapısı UniVerse'e veya ilgili hak sahiplerine aittir. Bu unsurlar izinsiz kopyalanamaz, dağıtılamaz, ticari olarak kullanılamaz veya tersine mühendislik amacıyla işlenemez.",
        "Kullanıcı olarak yüklediğin içeriklerin hak sahipliği sende kalır. Ancak uygulamanın çalışması için, bu içerikleri barındırma, işleme, gösterebilme, farklı ekranlara yansıtabilme ve teknik olarak kopyalayabilme konusunda hizmetle sınırlı, geri alınabilir nitelikte bir kullanım yetkisi sağlamış olursun.",
      ],
    },
    {
      heading: "Hizmetin Sürekliliği ve Teknik Sınırlar",
      body: [
        "UniVerse, hizmeti sürekli, güvenli ve hızlı sunmak için makul çaba gösterir; ancak internet altyapısı, üçüncü taraf servisler, cihaz farklılıkları, bakım çalışmaları, güvenlik olayları veya beklenmeyen sistem arızaları nedeniyle hizmette geçici kesinti veya hatalar oluşabilir.",
        "Özellikler zamanla değişebilir, kaldırılabilir, yeniden adlandırılabilir veya belirli hesap tipleriyle sınırlandırılabilir. Uygulamayı geliştirme, veri yüklerini yeniden tasarlama ve ürün akışlarını optimize etme hakkı saklıdır.",
        "Geçici kesinti, veri senkronizasyon gecikmesi, performans düşüşü veya cihaz uyumsuzluğu gibi teknik durumlar her zaman tamamen önlenemeyebilir.",
      ],
    },
    {
      heading: "Hesap Sonlandırma ve İçerik Silme",
      body: [
        "Hesabını uygulama içindeki ayarlar alanından silebilir veya çıkış yapabilirsin. Hesap silme talebi teknik ve hukuki kontroller tamamlandıktan sonra işleme alınır. İlgili içeriklerin tamamıyla anında silinmesi her zaman teknik olarak mümkün olmayabilir.",
        "UniVerse, kullanım koşullarının ihlali, güvenlik riski, hukuki zorunluluk, sahtecilik, kötüye kullanım veya hizmet bütünlüğünü koruma gereği doğması halinde hesabını önceden bildirim yapmaksızın kısıtlayabilir veya sonlandırabilir.",
      ],
    },
    {
      heading: "Sorumluluğun Sınırlandırılması",
      body: [
        "UniVerse, kullanıcılar tarafından paylaşılan içeriklerin tamamını önceden denetlemekle yükümlülük üstlenmez. Uygulamadaki kullanıcı içeriklerinin doğruluğu, güncelliği ve hukuka uygunluğundan içeriği oluşturan kullanıcı sorumludur.",
        "Kanunen izin verilen azami ölçüde, dolaylı zararlar, itibar kaybı, kazanç kaybı, veri kaybı veya üçüncü taraf eylemlerinden kaynaklanan dolaylı sonuç zararlarından sorumluluk kabul edilmez. Ancak zorunlu tüketici hukuku veya emredici mevzuat kapsamındaki hakların saklıdır.",
      ],
    },
    {
      heading: "Koşulların Güncellenmesi",
      body: [
        "Bu kullanım koşulları, ürün kapsamında değişiklik yapıldıkça veya hukuki gereklilikler gerektirdikçe güncellenebilir. Güncel metin uygulama içinde gösterilen sürümdür.",
        "Yasal ve kurumsal uyum açısından, veri sorumlusunun veya uygulama işleticisinin resmî unvanı, iletişim bilgileri ve gerekiyorsa uygulanacak özel sektörel ek kurallar yayına çıkmadan önce gerçek bilgilerle tamamlanmalıdır.",
      ],
    },
  ],
};
