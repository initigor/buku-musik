# Buku Chart

Catatan notasi tulis tangan, bank lagu berfolder, dan setlist untuk drummer.
Tanpa server: semua catatan tersimpan di perangkat (IndexedDB).

## Isi folder
- `index.html`, `styles.css`, `app.js`  aplikasi
- `sw.js`  service worker untuk mode offline
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`  pemasangan ke Home Screen
- `CLAUDE.md`  catatan project untuk Claude Code

## Melanjutkan di Claude Code
Buka folder ini di Claude Code. Berkas `CLAUDE.md` berisi struktur dan aturan project.
Contoh permintaan pertama:

> Baca CLAUDE.md. Taruh project ini di hosting statis HTTPS (aku pilih GitHub Pages),
> lalu beri alamatnya dan langkah memasangnya di iPad.

## Cara memakai di iPad
1. Taruh seluruh isi folder di hosting statis HTTPS (GitHub Pages, Netlify, Vercel, atau sejenisnya).
   Service worker tidak jalan jika dibuka langsung dari berkas lokal.
2. Buka alamatnya di Safari iPad saat online, tunggu sampai halaman tampil penuh.
3. Bagikan, lalu Add to Home Screen.
4. Buka dari ikon di Home Screen. Setelah itu aplikasi bisa dibuka tanpa internet.
5. Uji sekali: nyalakan mode pesawat, tutup app, buka lagi. Lakukan sebelum hari tampil.

## Memindahkan data dari versi artifact
Buka menu **Cadangan** di versi lama, tekan "Salin cadangan", lalu buka Cadangan di versi ini,
tempel ke kotak, dan tekan "Impor dari kotak". Penyimpanan Safari dan Home Screen terpisah,
jadi lakukan impor di app yang kamu pakai untuk tampil.

## Memperbarui aplikasi
Setelah mengubah `index.html`, `styles.css`, atau `app.js`, naikkan nilai `V` di `sw.js`
(misalnya `buku-chart-v2`) agar perangkat mengambil versi baru.
