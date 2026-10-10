# Log Sesi

Entri terbaru di atas.

## 2026-10-11 — Model komponen domain (paket Minimum)
- Sumber: docs/MODEL_FISIKA.md, src/domain/types.ts dan tipe katalog. Rencana 5 poin disetujui sebelum mulai.
- Dibuat di src/domain/components/ (masing-masing dengan *.test.ts): pv.ts, pv-array.ts, battery.ts, sun.ts, cable.ts, protection.ts, load.ts, scc.ts, inverter.ts, grid.ts, meter.ts, numeric.ts; data uji test-fixtures.ts dan test-fixtures-bos.ts. Diubah: src/domain/index.ts (ekspor), docs/LOG_SESI.md.
- Cakupan: PV §1 lengkap (array, bayangan, dioda bypass, titik daya maksimum global); baterai §4.2–4.3 (VRLA dan LiFePO4); matahari §11; kabel §8; MCB dan fuse §9.1–9.2; beban resistif; SCC PWM §2; inverter off-grid §5; jaringan dan kWh meter versi kecil (§6.1, §10.2).
- Keputusan: semua fungsi murni, menerima `electrical`/`protection` katalog; SoC di antarmuka memakai `socPct` (0–100); pv.ts dipecah dengan pv-array.ts (batas 250 baris); data uji disalin dari katalog karena src/domain dilarang meng-import src/data; satu commit per model (10 commit di master, tanpa push).
- Validasi: npm run check lolos (lint, 286 test, build). 202 test baru; nilai acuan dari contoh hitung §1.7, §2.4, §3.4, §4.7, §5.4, §6.3, §8.3, §9, §10.3, §11.3 dengan toleransi 2%, ditambah kasus batas (iradiasi 0, SoC 0%/100%, arus di atas rating, 15 °C dan 65 °C).
- Selisih terhadap dokumen: `I(Vmp)` tidak "persis" `Imp` (§1.4) tetapi lebih besar `Isc·C1` (0.00016 A pada contoh A).
- [PERLU VERIFIKASI] yang ditetapkan di kode karena tidak ada di katalog: faktor `Rchg` per kimia (3× VRLA, 1× LiFePO4); `L` = 25, `d` = 0.15, `Vf` = 0.6 V; titik kurva termal MCB, ambang magnetik, `kdc`, `τcool`, koefisien suhu MCB; ambang deteksi 24 V SCC PWM (16 V); lokasi dan suhu Batam (`BATAM_SITE`, `BATAM_DAY_TEMP`); jendela frekuensi ±1 Hz; ambang warna jatuh tegangan 3%/5%.
- Perlu keputusan: (1) kapasitas baterai di atas titik tabel suhu diekstrapolasi 0.0056/°C sesuai §4.3 (VRLA 65 °C = 119%, LiFePO4 juga naik di atas 25 °C) — kemungkinan perlu dibatasi; (2) beban SCC dan inverter antara 1.00× dan titik kurva pertama memakai waktu titik pertama (SCC: 60 s); (3) konstanta asumsi di atas sebaiknya dipindah ke JSON di src/data.
- Belum dikerjakan: SCC MPPT (§3), inverter grid-tie dan hibrida (§6–7), SPD (§9.3), BMS (§4.5), SoC taksiran (§4.6), galat kWh meter di bawah `Imin`, penyelesaian jaringan dan neraca energi (§12). Uji Playwright tidak dijalankan (tidak ada perubahan tampilan).

## 2026-10-11 — Perbaikan validasi katalog dari review
- Sumber: docs/review/2026-10-11-kerangka-proyek.md (7 temuan, semua benar dan dikerjakan). Rencana 5 poin disetujui sebelum mulai.
- Dibuat: src/data/catalog/rules.test.ts (54 test; 50 gagal pada skema lama, ditulis sebelum perbaikan). Diubah: src/data/catalog/schema.ts, validate.ts, catalog.test.ts, schema/common.ts, sources.ts, inverters.ts, protection.ts, storage.ts, balance.ts; docs/LOG_SESI.md. JSON katalog tidak diubah (51 item tetap lolos).
- Aturan baru: (1) panel `vmpV < vocV`, `impA < iscA`, `pmaxW` dalam ±5% dari `vmpV × impA`; (2) sumbu x kurva naik ketat, kurva proteksi `[rasio, detik]` positif, tabel suhu berfaktor positif (suhu negatif boleh), sumbu SoC baterai naik ketat dari 0 sampai 1; (3) efisiensi inverter dan SCC MPPT `0 < η ≤ 1`; (4) field bernama sama di `protection` dan `electrical` wajib sama, `protection.vocMaxV = electrical.pvVocMaxV`; (5) `mpptMinV < mpptMaxV ≤ batas Voc` (grid-tie: `protection.dcVocMaxV`); (6) `validateCatalog` melaporkan berkas hilang, validasi sebagian hanya lewat opsi `allowPartial`; (7) `installOrder` tepat `battery, pv, load`.
- Keputusan: aturan lintas `electrical`–`protection` ditaruh di schema.ts (tidak jadi berkas schema/rules.ts); `installOrder` tetap bertipe larik agar tipe domain tidak berubah.
- Validasi: npm run check lolos (lint, 84 test, build).
- Perlu keputusan: toleransi Pmax 5% [PERLU VERIFIKASI] (selisih terbesar di katalog 0,4%); docs/KATALOG.md belum memuat aturan baru ini.
- Belum dikerjakan (catatan reviewer di luar tabel): test negatif untuk duplikasi paket/terminal/verify, `coverage=full`, versi skema; uji Playwright tidak dijalankan sesi ini.

## 2026-10-10 — Kerangka proyek
- Sumber: AGENTS.md, docs/KATALOG.md, docs/UX.md, docs/ux/, 12 berkas src/data/catalog/. Rencana 5 poin disetujui sebelum mulai.
- Dibuat: proyek Vite 8 + React 19 + TypeScript 6 strict (package.json, index.html, vite.config.ts, tsconfig*.json, eslint.config.js, .prettierrc.json, .prettierignore, playwright.config.ts); src/domain (types.ts + catalog/ 6 berkas tipe); src/data/catalog (schema.ts, schema/ 6 berkas zod, validate.ts, index.ts, catalog.test.ts); src/features (top-bar, tray, workbench, inspector, sim-controls berisi kerangka; instruments, scenarios kosong); src/store, src/ui (kosong), src/i18n/id.ts; src/App.tsx, main.tsx, index.css; e2e/layout.spec.ts; docs/ARSITEKTUR.md. Diubah: AGENTS.md (bagian "Perintah"), .gitignore (test-results, playwright-report, ~$*), docs/LOG_SESI.md.
- Dependensi pendukung di luar daftar stack (disetujui): @vitejs/plugin-react, @tailwindcss/vite, eslint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, prettier, @playwright/test, @types/react, @types/react-dom, @types/node. Tambahan yang belum disebut di rencana: @eslint/js (paket resmi ESLint untuk aturan bawaan). vite-plugin-pwa belum dipasang.
- Keputusan: skema zod ketat per kategori (field tak dikenal ditolak) dan tipe domain ditulis tangan tanpa zod, kesetaraannya diuji; batas lapisan dijaga `no-restricted-imports` (domain juga dilarang meng-import data dan i18n); Prettier tidak menyentuh *.md, docs/, dan JSON katalog; folder fitur tambahan `top-bar` untuk bilah atas; meja kerja memakai kanvas @xyflow/react kosong (kisi 24 px, zoom 50–200%).
- Validasi: ke-12 berkas katalog lolos skema tanpa perubahan data (51 item; min 25, rek 38, best 28). npm run check lolos (lint, 30 test, build). npm run test:e2e lolos: 5 area pada 1366x768 berukuran 56 / 216 / 870x640 / 280 / 72 px.
- Belum dikerjakan: inspektur masih selalu tampil (nanti hanya saat ada komponen terpilih) dan belum menjadi lembar bawah di lebar < 1024 px; PWA; store masih kosong; alur simulasi di ARSITEKTUR.md §2 masih rancangan.
- Perlu keputusan: kalimat "Belum ada skema zod" di docs/KATALOG.md baris 3 sudah tidak berlaku (belum diubah); apakah `top-bar` dicantumkan di struktur folder AGENTS.md.

## 2026-10-10 — Kajian UX
- Sumber: 4 tangkapan layar prototipe di docs/ux/ (1366x768) dan docs/PRD.md.
- Dibuat: docs/UX.md (ringkasan penilaian, 10 perintah perbaikan untuk Google AI Studio, keputusan tata letak Tahap 5). Diubah: docs/LOG_SESI.md.
- Keputusan utama: bilah atas 56 px, baki 216 px, inspektur 280 px, bilah simulasi 72 px; terminal tampak 24 px / area klik 44 px / jarak 48 px; warna kabel menurut fungsi penghantar (DC+ merah, DC− hitam, L cokelat, N biru, PE hijau-kuning), DC/AC dibedakan lewat bentuk terminal; hijau toska hanya warna merek.
- Temuan utama: terminal ±16 px tanpa label, SCC hanya 2 terminal, kabel + dan − sama-sama jingga, meja kerja hanya ±59% tinggi layar, mode pilih/kabel tidak perlu.
- Perlu keputusan: warna kabel vs PUIL/SNI yang dipakai pelatihan [PERLU VERIFIKASI]; tinggi area tampil browser nyata di laptop peserta. Alat ukur, proteksi, keadaan rusak, dan mode terpandu belum ada di prototipe sehingga belum dikaji.
- npm run check belum dijalankan: belum ada kode/package.json.

## 2026-10-09 — Katalog komponen
- Sumber: docs/MODEL_FISIKA.md, docs/PRD.md, 7 berkas di docs/datasheet/ (dibaca lewat skrip sementara di luar proyek; nilai diambil dari datasheet, bukan disalin dari MODEL_FISIKA).
- Dibuat: docs/KATALOG.md (penjelasan field, satuan, contoh item); src/data/catalog/ berisi 12 berkas JSON, 51 item: pv-modules, charge-controllers, batteries, bms, inverters, protection-mcb, protection-other, cables, meters, distribution, loads, grid. Diubah: docs/LOG_SESI.md.
- Rencana disetujui dengan dua penyesuaian: protection dipecah jadi protection-mcb dan protection-other, BMS dipisah ke bms.json (agar tiap berkas < 250 baris). Field `packages` berupa larik (min/rek/best); posisi terminal x/y = 0 dan gambar .webp belum ada.
- Validasi: skrip sementara memeriksa JSON valid, id unik, nama ≤ 3 kata, enum jenis terminal/paket, jalur `verify` ada, item generik memuat semua field di `verify`, tanda [PERLU VERIFIKASI] di notes. Hasil: 0 error. Skema zod belum ada.
- Temuan: panel 100/200 Wp dan MPPT 40 A tidak ada di datasheet (item generik); tegangan AC dipakai 220 V sedangkan MODEL_FISIKA §5.1 menyebut awal 230 V; MCB Schneider C120N berstatus discontinued; semua inverter, fuse, SPD, combiner, BMS 24 V, busbar, beban, dan jaringan PLN generik [PERLU VERIFIKASI].
- Perlu keputusan: nominal AC 220 V vs 230 V; apakah model datasheet cadangan (SCC PWM RBL lain, kWh meter RS PRO/CHINT, panel besar) perlu masuk katalog.
- npm run check belum dijalankan: belum ada kode/package.json.

## 2026-10-09 — Model fisika
- Sumber: docs/PRD.md dan 7 berkas di docs/datasheet/ (dibaca lewat skrip sementara di luar proyek).
- Dibuat: docs/MODEL_FISIKA.md (PV C1/C2, PWM, MPPT, VRLA/LiFePO4, inverter off-grid/grid-tie/hibrida, kabel, MCB/fuse/SPD, kWh meter, profil matahari Batam, penyelesaian jaringan, matriks uji). Diubah: docs/LOG_SESI.md.
- Validasi: model PV dicocokkan ke baris NOCT datasheet (Pmax −1.5…−2.4%, Voc −0.3…+1.4%, Isc ≤ 0.9%); Peukert dicocokkan ke tabel discharge Aokly (±10% untuk laju ≥ 1 jam).
- Temuan utama (§13): datasheet tidak memuat panel 100 Wp/200 Wp, SCC MPPT 40 A, inverter, SPD, fuse, maupun kurva waktu-arus MCB; KP US8 ("MPPT ≥ PWM") perlu toleransi; BMS Victron eksternal wajib.
- Perlu keputusan: pilihan model katalog pengganti untuk butir 1–3 §13; apakah toleransi uji §1.4 dan matriks §15 dipakai.
- npm run check belum dijalankan: belum ada kode/package.json.

## 2026-10-07 — Perbarui PRD dari review
- Sumber: docs/review/PRD-codex.md (15 temuan, semua diterapkan).
- Diubah: docs/PRD.md, docs/LOG_SESI.md.
- Ringkas: kolom rilis R1-R4 (R1 = Minimum + Rakit Bebas + Terpandu); aturan terminal/busbar; kontrak reset-jeda-simpan; capaian belajar + prosedur aman; LVD berbasis tegangan; alat ukur A seri/fuse alat/clamp DC/V AC; titik kerja seri-paralel; proteksi dan kabel pergi-pulang; beban resistif; aksesibilitas; alur kelas offline; bukti ukur di diagnosis; matriks validasi independen.
- Keputusan baru perlu dikonfirmasi: pembagian rilis R1-R4 dan pemindahan MPPT/on-grid/asesmen/SPD ke rilis berikutnya.
- npm run check belum dijalankan: belum ada kode/package.json.

## 2026-10-07 — PRD
- Dibuat: docs/PRD.md (persona, 3 paket/4 preset, 4 mode, MoSCoW, 27 user story, perilaku fisik, batasan, indikator).
- Diubah: docs/LOG_SESI.md.
- npm run check belum dijalankan: belum ada kode/package.json.
- Angka bertanda [PERLU VERIFIKASI] perlu dicek ke datasheet (jumlah string hibrida, anti-islanding < 2 s, fps).

## 2026-10-07 — Siapkan aturan agen
- Dibuat: AGENTS.md, CLAUDE.md (`@AGENTS.md`), docs/LOG_SESI.md, .gitignore, .gitkeep di docs/review/ dan assets-src/.
