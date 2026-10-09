# Log Sesi

Entri terbaru di atas.

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
