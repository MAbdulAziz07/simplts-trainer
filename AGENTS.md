# AGENTS.md — Trainer Virtual PLTS (SimPLTS)
 
Anda membantu membangun aplikasi "Trainer Virtual PLTS" (nama kerja: SimPLTS).
Pengguna: guru SMK teknik ketenagalistrikan peserta pelatihan, dan widyaiswara sebagai instruktur.
Tujuan: menggantikan trainer fisik PLTS off-grid, on-grid, dan hibrida untuk praktik merangkai, mengukur, dan mencari gangguan, karena pengadaan alat fisik terbatas.
 
## Prinsip produk
1. Senyata mungkin: komponen memakai parameter datasheet, terminal berpolaritas, kabel berpenampang dan berpanjang, serta perilaku fisik (kurva I-V, SoC baterai, jatuh tegangan, proteksi trip, komponen rusak bila salah rangkai).
2. Sedikit tulisan: ikon, warna, lampu indikator, dan angka alat ukur lebih utama daripada paragraf. Penjelasan hanya muncul saat diminta (tooltip / tombol "?").
3. Drag and drop: komponen diseret dari baki ke meja kerja; kabel ditarik dari terminal ke terminal.
4. Aman untuk salah: kesalahan rangkaian menimbulkan akibat yang terlihat (MCB trip, asap, komponen rusak), lalu bisa direset.
5. Mudah dipelihara: logika fisika terpisah dari tampilan; komponen dan skenario didefinisikan dalam file JSON.
 
## Stack teknis (jangan diganti tanpa persetujuan)
- React 19 + TypeScript (strict) + Vite
- Tailwind CSS 4, ikon lucide-react, animasi motion
- @xyflow/react untuk kanvas komponen-dan-kabel
- Zustand untuk state, zod untuk validasi data JSON
- Vitest untuk unit test, Playwright untuk uji alur
- Tanpa backend dan tanpa API key; aplikasi berjalan offline di browser (PWA).
 
## Struktur folder
src/domain/    logika fisika murni TypeScript, TANPA import React/store/ui
src/data/      katalog komponen, skenario, profil beban dan matahari (JSON)
src/store/     state Zustand
src/features/  fitur UI: workbench, tray, inspector, instruments, scenarios, sim-controls
src/ui/        komponen UI kecil yang dipakai ulang
src/i18n/      teks tampilan bahasa Indonesia
src/assets/    gambar komponen siap pakai (.webp)
assets-src/    gambar mentah dari Nano Banana
docs/          dokumentasi proyek; docs/review/ laporan reviewer
 
## Aturan kode
- Nama file, variabel, dan fungsi dalam bahasa Inggris; teks yang tampil ke pengguna dalam bahasa Indonesia di src/i18n/id.ts.
- Satuan ditulis di nama: voltageV, currentA, powerW, energyWh, socPct, irradianceWm2, tempC.
- Satu file sebaiknya di bawah 250 baris; pecah bila lebih.
- Setiap fungsi di src/domain wajib punya unit test.
- Bila ada angka atau asumsi teknis yang tidak pasti, tandai [PERLU VERIFIKASI].
 
## Perintah
- npm run dev — server pengembangan Vite
- npm run build — periksa tipe (tsc -b) lalu build produksi ke dist/
- npm run preview — sajikan hasil build
- npm run test — unit test Vitest sekali jalan; npm run test:watch untuk mode pantau
- npm run test:e2e — uji alur Playwright (sekali di awal: npx playwright install chromium)
- npm run lint — ESLint (termasuk batas import antarlapisan) + pemeriksaan format Prettier
- npm run format — rapikan format dengan Prettier
- npm run check — lint + test + build
 
## Aturan kerja agen
- Kerjakan hanya tugas yang diminta pada sesi ini.
- Untuk tugas yang mengubah lebih dari 3 file, jelaskan rencana (maks 5 poin) dan tunggu persetujuan.
- Jangan menghapus file atau folder, mengubah AGENTS.md, atau menambah dependensi tanpa persetujuan.
- Jangan push dan jangan merge branch. Commit hanya bila diminta.
- Setelah selesai: jalankan npm run check (lint + test + build), sebutkan file yang dibuat/diubah, dan tambahkan ringkasan sesi di bagian atas docs/LOG_SESI.md.
 
## Mode reviewer (bila prompt diawali "Mode reviewer")
- Baca kode dan dokumen; boleh menjalankan test dan skrip sementara di luar folder proyek.
- Hanya menulis SATU file laporan di docs/review/; jangan mengubah file lain.
- Laporan berupa tabel bernomor: temuan | lokasi | dampak | usulan | prioritas (tinggi/sedang/rendah).
