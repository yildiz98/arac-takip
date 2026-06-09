# Hiçkorkmaz Garaj V7 - Global Arama Güncellemesi

## Bu pakette eklenenler

- Arama artık sadece Cari Hesap bölümünde değil, her ekranda çalışır.
- Dashboard, Araçlar, Araç Geçmişi, Servis Kayıtları, Tahsilatlar, Borç Takibi ve Raporlar ekranlarında aynı global arama kutusu aktiftir.
- İsim / soyisim / firma adı aranınca müşteri veya firma kartı açılır.
- Müşteri / firma kartında kayıtlı tüm plakalar listelenir.
- Plaka aranınca direkt araç geçmişi açılır.
- Araç detayında “Bu müşterinin tüm araçlarını göster” butonu eklendi.
- Servis filtresinde de isim / firma / plaka / işlem arama desteklenir.
- Mevcut kayıtları silmeden güncelleme mantığı korunur.

## GitHub Pages'e yükleme

1. ZIP dosyasını indir.
2. ZIP içindeki dosyaları çıkar.
3. GitHub reposunda Pages hangi branch'ten yayın yapıyorsa o branch'i aç.
   - Sende ekranda `v6-tasarim` görünüyordu.
4. Şu dosyaları yükle:
   - index.html
   - style.css
   - app.js
   - manifest.json
   - README.md
5. Commit changes de.
6. 1-2 dakika bekle.
7. Siteyi Ctrl + F5 ile yenile.

## Veri notu

Kayıtlar tarayıcı localStorage içinde tutulur.
Bu dosyaları GitHub'a yüklemek mevcut cihazdaki kayıtları silmez.
Yine de Ayarlar bölümünden yedek alman önerilir.


## V7 Servis Kaydı Seçimli İşlem Güncellemesi

Bu sürümde Servis Kaydı ekranına seçilebilir bakım/işlem kalemleri eklendi:

- Motor Yağı
- Yağ Filtresi
- Hava Filtresi
- Polen Filtresi
- Yakıt / Mazot Filtresi
- Ön Balata
- Arka Balata
- Fren Diski
- Fren Hidroliği
- Antifriz
- Akü
- Buji
- Triger Seti
- Debriyaj
- Şanzıman Yağı
- Rot Balans
- Lastik
- Klima Gazı
- Genel Kontrol
- Elektrik Arıza
- Kaporta / Boya
- Diğer

Seçilen kalemler servis geçmişinde görünür ve servis filtresinde aranabilir.


## V7 Servis Kaydında Elle Plaka Yazma Güncellemesi

Bu sürümde Servis Kaydı eklerken plaka artık açılır listeden seçilmez.

Yeni mantık:
- Servis kaydında plaka elle yazılır.
- Yazılan plaka mevcut araçlarda kayıtlıysa sistem otomatik olarak o müşteri/firma altına işler.
- Plaka kayıtlı değilse sistem uyarı verir.
- Plaka kayıtlı değilse önce Araçlar bölümünden müşteri/firma adına araç eklenmelidir.
- Servis geçmişinde yine müşteri/firma, plaka ve seçilen işlem kalemleri görünür.


## V7 Final Professional Güncellemesi

Son eklenen özellikler:

- Servis kaydında plaka elle yazılır.
- Plaka kayıtlıysa servis otomatik müşteri/firma altına kaydedilir.
- Geldiği KM alanı eklendi.
- Bir Sonraki Bakım KM alanı eklendi.
- İşçilik Tutarı eklendi.
- Parça Tutarı eklendi.
- Toplam tutar işçilik + parça olarak otomatik hesaplanır.
- Araç kartında Son KM görünür.
- Araç kartında Bir Sonraki Bakım KM görünür.
- Araç kartında Kalan KM görünür.
- Dashboard'da Yaklaşan Bakım / KM Kontrol listesi vardır.
- Girilen KM önceki servis KM'sinden düşükse uyarı verir.
- Servis geçmişinde KM, seçilen işlemler, işçilik, parça ve toplam tutar görünür.

Servis işlem seçenekleri:
Motor Yağı, Yağ Filtresi, Hava Filtresi, Polen Filtresi, Yakıt / Mazot Filtresi, Ön Balata, Arka Balata, Fren Diski, Fren Hidroliği, Antifriz, Akü, Buji, Triger Seti, Debriyaj, Şanzıman Yağı, Rot Balans, Lastik, Klima Gazı, Genel Kontrol, Elektrik Arıza, Kaporta / Boya, Diğer.


## V7 Final Araç Ekleme Güncellemesi

Araç ekleme kısmında artık müşteri/firma açılır listeden seçilmez.

Yeni mantık:
- Müşteri / Firma Adı elle yazılır.
- Telefon isteğe bağlı yazılır.
- Müşteri/firma sistemde varsa araç ona bağlanır.
- Müşteri/firma sistemde yoksa otomatik yeni müşteri/firma kartı oluşturulur.
- Plaka isteğe bağlıdır.
- Plakası olmayan araçlar için “Plakasız Araç Tanımı” alanı eklendi.
- Örnek: Forklift, Römork, Atölye Aracı, Test Aracı.
- Plaka boş bırakılırsa sistem otomatik PLakasız kayıt numarası üretir.
- Servis kaydında plaka/tanım yazılarak da kayıtlı araca ulaşılabilir.


## V7 Esnek Servis Kaydı Güncellemesi

Servis kaydında artık tek alan çalışır:

- Plaka
- Plakasız araç tanımı
- Müşteri/firma adı
- Şahıs adı

Yeni mantık:
- Yazılan değer plakaysa direkt o araç bulunur.
- Yazılan değer plakasız araç tanımıysa direkt o araç bulunur.
- Yazılan değer müşteri/firma adıysa o müşterinin araçları kontrol edilir.
- Müşteri/firma adına bağlı tek araç varsa otomatik o araca kaydeder.
- Birden fazla araç varsa servis formunda seçim alanı açılır ve doğru araç seçilir.


## V7 Servis Geçmişi Yazdır / PDF / WhatsApp Güncellemesi

Eklenen özellikler:
- Araç detayında servis geçmişi için Yazdır butonu.
- Araç detayında PDF butonu.
- Araç detayında WhatsApp paylaş butonu.
- Araç listesinde hızlı Yazdır ve WP butonları.
- Servis geçmişi çıktısında yapılan işlemler, geldiği KM, sonraki bakım KM, işçilik, parça, toplam ve notlar görünür.

PDF Notu:
Tarayıcı yazdır penceresi açılır. Hedef olarak “PDF olarak kaydet” seçilerek PDF alınır.


## V7 Tek Servis Kaydı Yazdır / PDF / WhatsApp Güncellemesi

Önceki sürümde WhatsApp ve çıktı araç geçmişindeki bütün servisleri gönderiyordu.
Bu sürümde servis geçmişi tablosundaki her satır için ayrı butonlar eklendi:

- Yazdır: sadece tıklanan servis kaydını yazdırır.
- PDF: sadece tıklanan servis kaydını PDF olarak kaydetmek için yazdır ekranı açar.
- WP: sadece tıklanan servis kaydını WhatsApp mesajı olarak hazırlar.

Araç detayındaki üst butonlar ise özellikle “Tüm Geçmiş” olarak adlandırıldı.


## V7 Admin / Personel Girişi Güncellemesi

Eklenen özellikler:
- Giriş ekranı.
- Admin girişi.
- Personel girişi.
- Çıkış butonu.
- Aktif kullanıcı bilgisi.
- Personel için Raporlar ve Ayarlar menüsü gizlenir.
- Admin Ayarlar bölümünden Admin ve Personel şifrelerini değiştirebilir.

Varsayılan giriş:
- Admin şifre: 1234
- Personel şifre: 0000

Not:
Şifreler tarayıcı localStorage içinde saklanır. Bu yapı temel kullanıcı ayrımı içindir.


## V7 Mobil / Telefon Uyum Güncellemesi

Eklenenler:
- Telefonda açılır/kapanır sol menü.
- Mobil menü butonu.
- Dokunmatik kullanıma uygun büyük butonlar.
- Telefon ekranına göre düzenlenen dashboard kartları.
- Responsive servis tabloları.
- Mobil uyumlu giriş ekranı.
- PWA/ana ekrana ekleme için manifest iyileştirmesi.
- iPhone için Apple web app meta etiketleri.

Telefonda kullanım:
- Siteyi telefonda aç.
- Menü için üstteki “☰ Menü” butonuna bas.
- iPhone için Safari > Paylaş > Ana Ekrana Ekle.
- Android için Chrome > Üç nokta > Ana ekrana ekle.


## V7 Google Hesabı ile Admin / Personel Girişi

Bu sürümde eski şifreli giriş yerine Google hesabı ile giriş eklendi.

### Yetki Mantığı

Admin:
- Tüm menülere erişir.
- WhatsApp / PDF / Yazdır kullanır.
- Borç, tahsilat, raporlar ve ayarlar erişimi vardır.
- Yedekleme ve veri işlemleri yapar.

Personel:
- Müşteri / firma kaydı yapar.
- Araç kaydı yapar.
- Servis kaydı yapar.
- WhatsApp / PDF / Yazdır kullanamaz.
- Borç / tahsilat / raporlar / ayarlar ekranlarını göremez.

### Firebase Ayarı

`firebase-config.js` dosyasını aç ve Firebase Web App config bilgilerini gir.

Ayrıca yetki e-postalarını düzenle:

```js
export const ADMIN_EMAILS = [
  "admin@gmail.com"
];

export const PERSONEL_EMAILS = [
  "personel@gmail.com"
];
```

### Firebase Console Gerekenler

1. Firebase projesi oluştur.
2. Authentication > Sign-in method > Google aktif et.
3. Authentication > Settings > Authorized domains içine GitHub Pages domainini ekle:
   - yildiz98.github.io
4. Project settings > General > Web app config bilgilerini firebase-config.js içine yapıştır.


## V7 Firebase E-posta/Şifre Admin-Personel Girişi

Bu sürüm Google popup yerine Firebase Authentication > Users kısmında oluşturduğun e-posta/şifre kullanıcıları ile çalışır.

Tanımlı yetkiler:
- Admin: admin@aractakip.com
- Personel: personel1@aractakip.com

Admin:
- Tüm menüler ve tüm işlemler açık.
- WP/PDF/Yazdır açık.
- Borç/tahsilat/rapor/ayarlar açık.

Personel:
- Müşteri/Firma kaydı yapabilir.
- Araç kaydı yapabilir.
- Servis kaydı yapabilir.
- WP/PDF/Yazdır kapalı.
- Borç, tahsilat, raporlar ve ayarlar kapalı.

Yeni personel eklemek için:
1. Firebase > Authentication > Users > Add user.
2. E-posta/şifre oluştur.
3. firebase-config.js içindeki PERSONEL_EMAILS listesine e-postayı ekle.


## V7 Mavi/Beyaz Logo Tasarım Güncellemesi

Bu sürümde sistem Hiçkorkmaz Garage kurumsal renklerine göre güncellendi.

Eklenenler:
- Mavi/beyaz tema.
- Gönderilen Hiçkorkmaz Garage logosu.
- Sol menüde logo kullanımı.
- Giriş ekranında logo kullanımı.
- Üst başlıkta logo kullanımı.
- PWA ikonları: 192x192 ve 512x512.
- Mobil görünümde mavi/beyaz uyum.
