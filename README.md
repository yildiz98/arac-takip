# Hiçkorkmaz Garage V7 Final Kurumsal

GitHub Pages için hazır final pakettir.

## İçerik

- Mavi/beyaz kurumsal tasarım
- Hiçkorkmaz Garage logosu
- PWA / ana ekrana ekleme desteği
- Mobil uyumlu menü
- Firebase e-posta/şifre giriş sistemi
- Admin / Personel yetki ayrımı
- Temiz başlangıç verisi: 0 müşteri, 0 araç, 0 servis, 0 tahsilat
- Belirgin mavi hızlı işlem butonları
- Müşteri/firma kaydı
- Araç kaydı
- Plakalı ve plakasız araç desteği
- Servis kaydı
- Geldiği KM
- Bir sonraki bakım KM
- Yağ, filtre, balata vb. çoklu işlem seçimi
- İşçilik + parça + otomatik toplam
- Tek servis WP / PDF / Yazdır
- Admin için tüm geçmiş WP / PDF / Yazdır
- Müşteri/firma toplam borcu
- Plaka bazlı borç
- İşlemi yapan personel kaydı

## Giriş Yetkileri

Firebase Authentication > Users kısmında oluşturduğun hesaplara göre çalışır.

Admin:
- admin@aractakip.com

Personel:
- personel1@aractakip.com

Bu e-postalar `firebase-config.js` içinde düzenlenebilir.

## Yetkiler

Admin:
- Tüm menüler
- Tahsilat
- Borç takibi
- Raporlar
- Ayarlar
- WP / PDF / Yazdır
- Yedekleme
- Tüm verileri sıfırlama

Personel:
- Müşteri/firma ekler
- Araç ekler
- Servis kaydı ekler

Personel kullanamaz:
- WP / PDF / Yazdır
- Tahsilat
- Borç takibi
- Raporlar
- Ayarlar
- Veri silme / sıfırlama

## GitHub Kurulum

1. ZIP dosyasını indir.
2. ZIP'i aç.
3. İçindeki dosyaların tamamını GitHub Pages yayın branch'ine yükle.
4. Sende önceki ayarda branch `v6-tasarim` görünüyordu.
5. Commit changes de.
6. 1-2 dakika bekle.
7. Siteyi Ctrl + F5 ile yenile.

## Firebase Kontrol

Firebase Console'da:
- Authentication > Sign-in method > Email/Password aktif olmalı.
- Authentication > Settings > Authorized domains içinde `yildiz98.github.io` olmalı.
- Authentication > Users kısmında admin/personel kullanıcıları oluşturulmuş olmalı.


## Tahsilat Elle Giriş Güncellemesi

Bu sürümde tahsilat ekleme artık açılır araç seçimi ile yapılmaz.

Tahsilat alanları:
- Şahıs / Firma Adı
- Plaka
- Ödeme Tarihi
- Tutar
- Notlar

Çalışma mantığı:
- Şahıs/firma sistemde varsa ona işlenir.
- Şahıs/firma sistemde yoksa otomatik yeni müşteri/firma kartı oluşturulur.
- Plaka kayıtlıysa ödeme plaka borcundan da düşer.
- Plaka kayıtlı değilse ödeme müşteri/firma genel tahsilatı olarak kaydedilir.
- Tahsilatı yapan kullanıcı kaydı tutulur.


## Tahsilat Araç + Cari / Sadece Cari Mantığı

Bu sürümde tahsilat mantığı şu şekilde güncellendi:

1. Plaka yazılır ve plaka sistemde kayıtlıysa:
   - Ödeme araç borcundan düşer.
   - Aynı ödeme müşteri/firma cari toplamından da düşer.
   - Tahsilat türü: Araç + Cari Hesap

2. Plaka boş bırakılırsa:
   - Ödeme sadece şahıs/firma cari hesabından düşer.
   - Araç borçları değişmez.
   - Tahsilat türü: Sadece Cari Hesap

3. Plaka yazılır ama sistemde kayıtlı değilse:
   - Şahıs/Firma adı zorunludur.
   - Ödeme sadece cari hesap tahsilatı olarak kaydedilir.


## Dashboard Boş Görünme Hatası Düzeltmesi

Bu sürümde `vehicleTotal is not defined` hatası düzeltildi.
Dashboard, borç takibi, müşteri toplam borcu ve araç borcu hesaplamaları yeniden sağlam şekilde tanımlandı.
