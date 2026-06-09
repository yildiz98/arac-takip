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
