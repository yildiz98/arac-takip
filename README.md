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
