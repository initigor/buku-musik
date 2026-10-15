# Buku Chart

Aplikasi web statis (tanpa build, tanpa backend) untuk drummer: catatan notasi tulis tangan
dengan Apple Pencil, bank lagu berfolder, dan setlist dengan mode tampil. Dipakai di iPad
(Safari / Home Screen) dan harus tetap jalan tanpa internet.

## Struktur
- `index.html`  kerangka halaman, sprite ikon SVG, modal
- `styles.css`  semua gaya; token warna terang/gelap ada di `:root`
- `app.js`  semua logika dalam satu berkas (urutan bagian penting: dasar, IndexedDB, modal, kertas dan render, editor, bank lagu, setlist, cadangan, mode tampil, contoh data, boot)
- `sw.js`  service worker (cache dulu, perbarui di latar belakang)
- `vendor/pdf.min.js`, `vendor/pdf.worker.min.js`  pdf.js 3.11.174 (Apache-2.0), dimuat malas hanya saat impor PDF dan di-cache oleh `sw.js`
- `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png`  pemasangan ke Home Screen

## Arsitektur singkat
- Data: `folders`, `songs`, `setlists` di IndexedDB bernama `buku-chart`. Semuanya dimuat ke memori saat start dan ditulis lewat `saveSong` / `saveFolder` / `saveSetlist`. Preferensi tampilan di localStorage (`bc-ui`).
- Lagu: `{id, folderId, title, bpm, meter, paper, size, pages:[{strokes, bg?}]}`. Coretan disimpan sebagai vektor `{w, c, pts:[x, y, tekanan, ...]}` dalam koordinat logis. `size` = `a4p` (1200x1697, default) atau `a4l` (1697x1200); lagu lama (1200x800) dimigrasi ke `a4p` dengan koordinat tetap, dan jarak sistem staff tetap seperti kertas lama sehingga tulisan lama tetap sejajar.
- Kanvas: satu kanvas offscreen menyimpan coretan yang sudah jadi; kanvas tampil menggambar ulang dari situ. Saat menulis hanya segmen baru yang digambar (`strokeInc`), supaya menulis cepat tetap mulus. Lebar kertas = lebar layar di editor, sisanya digulir. Penghapus memotong bagian coretan di bawah lingkaran penghapus (`clipStroke`), ukurannya mengikuti tombol tipis/sedang/tebal. Pena dan penghapus memakai pointer events dengan `touch-action: none`. Jari menggulir kertas; jari baru menulis jika opsi dinyalakan di menu.
- Mode tampil: tombol "berikutnya" maju per halaman lalu per lagu. Ada tombol besar, swipe, dan tombol panah/PageDown (untuk pedal Bluetooth).
- Impor Notes: PDF (lewat pdf.js) atau gambar dirender ke JPEG dan disimpan sebagai `pages[i].bg` (data URL), digambar di bawah coretan dengan tinta gelap tetap. Apple Notes tidak bisa mengekspor coretan yang bisa diedit, jadi latar ini tidak bisa dihapus penghapus; ada opsi "Hapus latar gambar". Latar ikut dalam cadangan JSON sehingga cadangan jadi besar.
- Cadangan: ekspor dan impor JSON lewat menu Cadangan.

## Aturan
- Tetap tanpa framework dan tanpa langkah build; satu halaman statis.
- Jangan menambah sumber luar yang tidak bisa di-cache; mode offline harus tetap jalan. Font Google disimpan oleh `sw.js` saat pertama dibuka, dan ada font sistem sebagai cadangan.
- Setiap mengubah `index.html`, `styles.css`, atau `app.js`, naikkan `V` di `sw.js`.
- Mengubah bentuk data harus lewat migrasi di bagian boot `app.js` supaya catatan lama aman.
- Target sentuh minimal 44px. Uji potret dan lanskap iPad.

## Cara uji
- Lokal: `python3 -m http.server 8000`, lalu buka `http://localhost:8000` (service worker jalan di localhost).
- Sebelum dipakai tampil: di iPad, nyalakan mode pesawat, buka dari ikon Home Screen, pastikan catatan masih ada.

## Tugas pertama
Taruh project di hosting statis HTTPS (tanyakan pemiliknya: GitHub Pages, Netlify, atau Vercel),
lalu beri tahu alamat akhirnya dan langkah memasangnya di iPad.
