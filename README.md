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
