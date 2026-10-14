# LKPD SimPLTS

Tujuh Lembar Kerja Peserta Didik untuk praktik PLTS off-grid paket Minimum (12 V) di SimPLTS. Setiap LKPD tersedia sebagai `.docx` (siap cetak dan bisa disunting) dan `.md` (sumber teks). Langkah kerja dilengkapi tangkapan layar SimPLTS (1366×768) dengan penanda angka merah.

| No | Judul | Waktu | Berkas rangkaian |
|---|---|---|---|
| 1 | [Mengenal Komponen, Terminal, dan Rating PLTS Off-Grid](lkpd1-mengenal-komponen.md) | 2 × 45 menit | Preset Minimum |
| 2 | [Karakteristik Modul Surya: Pengaruh Iradiasi dan Suhu](lkpd2-karakteristik-modul.md) | 2 × 45 menit | `lkpd2-modul-surya` |
| 3 | [Rangkaian Seri dan Paralel Modul Surya](lkpd3-seri-paralel.md) | 2 × 45 menit | `lkpd3-seri-paralel` |
| 4 | [Merangkai PLTS Off-Grid 12 V dengan Beban DC](lkpd4-merangkai-offgrid-dc.md) | 3 × 45 menit | Preset Minimum |
| 5 | [Inverter, Beban AC, dan Neraca Energi Harian](lkpd5-inverter-soc.md) | 3 × 45 menit | `lkpd5-sistem-dc` (atau hasil LKPD 4) |
| 6 | [Penampang dan Panjang Kabel terhadap Jatuh Tegangan](lkpd6-kabel-jatuh-tegangan.md) | 2 × 45 menit | `lkpd6-jatuh-tegangan` |
| 7 | [Proteksi dan Pencarian Gangguan PLTS Off-Grid](lkpd7-proteksi-gangguan.md) | 3 × 45 menit | `lkpd7-proteksi`, `lkpd7-sistem-normal`, `lkpd7-gangguan-A/B/C` |

## Isi folder

- `lkpd*.docx`, `lkpd*.md`: lembar kerja peserta.
- `kunci-instruktur.docx`, `kunci-instruktur.md`: kunci jawaban dan angka hasil simulasi. Hanya untuk instruktur.
- `berkas/*.simplts.json`: rangkaian yang dibagikan kepada peserta lalu dibuka dengan tombol **Buka** di SimPLTS. Berkas `lkpd7-gangguan-*` berisi gangguan tersembunyi; jangan bagikan isi kunci bersamanya.
- `gambar/*.jpg`: tangkapan layar yang dipakai di LKPD.

## Catatan untuk instruktur

- Urutan yang disarankan 1 → 7. LKPD 4 menghasilkan berkas yang dapat dipakai di LKPD 5.
- Angka di kunci adalah hasil simulasi per 14 Oktober 2026. Bila katalog, model fisika, atau tampilan SimPLTS berubah, periksa ulang angka dan tangkapan layar.
- Gambar dibuat dengan skrip Playwright sementara terhadap server pengembangan. Skrip itu tidak disimpan di repo.
- Pemetaan ke CP/ATP dan SKKNI belum dibuat. [PERLU VERIFIKASI]
