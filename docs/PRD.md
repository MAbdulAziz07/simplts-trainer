# PRD — Trainer Virtual PLTS (SimPLTS) v1

Angka teknis bertanda [PERLU VERIFIKASI] harus dicek ke datasheet sebelum masuk katalog. Perangkat katalog nyata belum dipilih; semua ambang numerik mengikuti datasheet model yang dipilih kelak.

## 1. Pengguna dan kondisi lab

| Persona | Profil | Kebutuhan utama |
|---|---|---|
| Guru peserta | Guru SMK teknik ketenagalistrikan; paham dasar listrik, belum tentu pernah memegang PLTS | Berlatih merangkai, mengukur, dan mencari gangguan tanpa takut merusak alat; hasil bisa dibawa mengajar |
| Instruktur (widyaiswara) | Mengajar kelas 15-30 guru | Memilih paket dan skenario, membagikan tugas, mengumpulkan hasil, mereset cepat |

Kondisi lab (batasan desain):

| Aspek | Kondisi | Konsekuensi |
|---|---|---|
| Perangkat | Laptop spesifikasi menengah, kadang tablet | Simulasi ringan; sentuh, mouse, dan keyboard didukung |
| Layar | 1366x768 sebagai acuan | Kontrol inti (baki, terminal, alat ukur, reset) selalu terlihat; kanvas boleh pan/zoom dan panel bantuan boleh scroll; target sentuh minimal 44 px |
| Internet | Tidak stabil | PWA offline penuh; tanpa backend dan tanpa API key |
| Bahasa | Indonesia | Teks di `src/i18n/id.ts`; istilah sesuai kelaziman SKKNI/PUIL [PERLU VERIFIKASI pemetaan] |
| Aksesibilitas | Sebagian pengguna buta warna atau sulit menyeret | Status tidak hanya warna (ikon + teks singkat); sambung kabel dengan klik/tap terminal asal lalu tujuan; navigasi keyboard; nama aksesibel |

## 2. Paket trainer (preset)

| Paket | Konfigurasi | Komponen utama | Rilis |
|---|---|---|---|
| Minimum | Off-grid 12 V | 2x panel 100 Wp; MCB DC + fuse; SCC PWM 20 A; baterai VRLA 12 V 100 Ah; inverter pure sine 500 W; beban DC dan AC resistif; busbar/terminal distribusi | R1 |
| Rekomendasi A | Off-grid 24 V | 2x200 Wp; combiner box + SPD; SCC MPPT 40 A; LiFePO4 24 V 100 Ah; inverter 1,5 kW | R2 |
| Rekomendasi B | On-grid | 4x200 Wp seri; inverter grid-tie 1 kW; kWh meter exim; jaringan PLN (grid) | R3 |
| Terbaik | Hibrida 3,2 kWp | 16x200 Wp (2 string x 8 [PERLU VERIFIKASI]); inverter hibrida 5 kW MPPT ganda; LiFePO4 48 V 100 Ah + BMS; kWh meter exim; panel beban; monitoring | R4 |

Rilis: **R1** = rilis awal; R2-R4 dikerjakan bertahap setelah R1 lolos validasi. Preset menyediakan daftar komponen dan skenario awal; peserta tetap merangkai sendiri.

Aturan terminal (berlaku semua paket):
- Katalog menetapkan **kapasitas sambungan per terminal** (jumlah kabel maksimum). Percabangan dilakukan lewat busbar/terminal distribusi (ada di baki Minimum); pengecualian: terminal daya modul PV dan baterai menerima hingga 4 kabel agar seri/paralel bisa langsung dirangkai.
- Penolakan **mekanis** (terminal penuh, kabel ke diri sendiri) beda dengan kesalahan **elektris** (polaritas terbalik, tegangan melebihi rating). Kesalahan elektris diizinkan di Rakit Bebas dan ditangani simulasi (trip, galat, rusak); di Praktik Terpandu bisa dicegah per langkah.
- Panjang kabel menyatakan satu konduktor; resistansi lintasan = pergi + pulang.

Cakupan rangkaian lanjutan (R3-R4) mensyaratkan definisi L/N/PE, titik kWh meter, serta port grid/backup lebih dulu [PERLU VERIFIKASI].

## 3. Empat mode

| Mode | Tujuan | Perilaku | Rilis |
|---|---|---|---|
| Rakit Bebas | Eksplorasi | Semua komponen paket tersedia; tanpa petunjuk; kesalahan berakibat nyata lalu bisa direset | R1 |
| Praktik Terpandu | Belajar langkah demi langkah | Langkah bergambar (ikon, sorotan terminal); langkah salah ditolak/ditandai; tombol "?" untuk penjelasan; memuat pemeriksaan sebelum energisasi (lihat §3.1) | R1 |
| Cari Gangguan | Diagnosis | Skenario dengan gangguan tersembunyi; peserta mengukur dan menunjuk penyebab dengan bukti ukur | R2 |
| Asesmen | Penilaian | Tugas tanpa petunjuk; rubrik proses dan hasil; hasil dapat diekspor | R3 |

### 3.1 Capaian belajar paket Minimum dan prosedur aman

Peserta mampu: (1) mengenali terminal dan polaritas, (2) memeriksa rating komponen, (3) mengisolasi sumber (buka MCB/fuse) sebelum merangkai, (4) merangkai dengan urutan benar, (5) mengukur sebelum energisasi, (6) mengenergisasi bertahap, (7) menanggapi proteksi yang bekerja, (8) mendiagnosis gejala.

- Praktik Terpandu menyertakan **daftar periksa bergambar**: isolasi sumber, cek polaritas, cek rating, ukur Voc, energisasi.
- Rubrik tindakan aman dipakai Terpandu dan Asesmen. Tidak ada simulasi cedera.
- Pemetaan ke SKKNI/PUIL dan prosedur tiap perangkat: [PERLU VERIFIKASI].

### 3.2 Kontrak keadaan: reset, jeda, simpan

| Aksi | Dikembalikan | Dipertahankan |
|---|---|---|
| Reset percobaan | Komponen rusak/trip, SoC, jam simulasi, arus, galat | Susunan komponen, kabel, gangguan skenario |
| Perbaiki/ganti komponen | Hanya komponen yang dipilih (misal fuse diganti) | Semua lainnya |
| Mulai ulang skenario | Seluruh meja kerja, gangguan, jam, skor | Identitas peserta, pengaturan |

- Waktu simulasi terpisah dari waktu asesmen. Jeda menghentikan keduanya; percepatan hanya mengubah waktu simulasi dan tidak boleh melewatkan kejadian trip (langkah waktu dibatasi).
- Waktu tidak berjalan saat aplikasi tertutup; proyek dimuat dalam keadaan **jeda**.
- Berkas simpan memuat nomor versi format; versi lama dimigrasi atau ditolak dengan pesan jelas.

## 4. Fitur v1 (MoSCoW)

| ID | Fitur | Prioritas | Rilis |
|---|---|---|---|
| F1 | Kanvas drag-drop komponen dari baki ke meja kerja, plus pan/zoom | Must | R1 |
| F2 | Kabel terminal-ke-terminal (seret atau klik asal lalu tujuan) dengan polaritas, penampang, panjang, kapasitas terminal | Must | R1 |
| F3 | Mesin simulasi domain (iradiasi, suhu, seri-paralel, kurva I-V, titik kerja) | Must | R1 |
| F4 | Paket Minimum lengkap (PWM, VRLA, inverter 500 W, busbar) | Must | R1 |
| F5 | Alat ukur: multimeter (V DC, A DC seri, selektor/jack, fuse alat), clamp DC, V AC sederhana, indikator lampu | Must | R1 |
| F6 | Proteksi: MCB/fuse trip, proteksi internal perangkat, akibat visual (asap, rusak), reset sesuai §3.2 | Must | R1 |
| F7 | Mode Rakit Bebas dan Praktik Terpandu (dengan daftar periksa aman) | Must | R1 |
| F8 | Kontrol simulasi: jam surya, iradiasi, suhu, beban, jeda/percepat | Must | R1 |
| F9 | Katalog dan skenario JSON tervalidasi zod | Must | R1 |
| F10 | PWA offline, indikator "siap offline", simpan proyek lokal berversi, ekspor/impor cadangan | Must | R1 |
| F11 | Label terminal, rating kritis, ikon+teks status, bantuan kontekstual singkat | Must | R1 |
| F12 | Log lokal aksi dan waktu (dasar, bukan mesin asesmen) | Must | R1 |
| F13 | Distribusi skenario lewat berkas lokal; ekspor hasil dengan identitas lokal, ID/versi skenario, waktu | Should | R2 |
| F14 | Mode Cari Gangguan (min. 6 skenario, wajib bukti ukur) | Should | R2 |
| F15 | Paket Rekomendasi A (MPPT, LiFePO4, SPD diskret) | Should | R2 |
| F16 | Inspector komponen (parameter datasheet lengkap) | Should | R1 |
| F17 | Paket Rekomendasi B (on-grid, anti-islanding, kWh meter exim) | Could | R3 |
| F18 | Mode Asesmen dengan rubrik dan ekspor hasil | Could | R3 |
| F19 | Paket Terbaik (hibrida 48 V, BMS, monitoring) | Could | R4 |
| F20 | Ekspor laporan PDF / cetak; mode gelap | Could | R4 |
| F21 | Backend, akun, sinkronisasi cloud; pemantauan peserta langsung; multi-pengguna real-time | Won't | - |

Syarat rilis R1: semua fitur Must lolos; pengujian paket/mode R2+ bersyarat dan tidak menghambat R1.

## 5. User story dan kriteria penerimaan

**KP** = kriteria penerimaan yang dapat diuji. Kolom **P/R** = prioritas / rilis. Semua nilai uji memakai paket dan kondisi yang dinyatakan; "identik" berarti panel bertipe sama pada iradiasi dan suhu sama.

| ID | P/R | Cerita | Kriteria penerimaan |
|---|---|---|---|
| US1 | M/R1 | Guru: memilih paket trainer | KP: memilih "Minimum" menampilkan semua komponen paket (termasuk busbar) di baki; paket belum dirilis tidak tampil/ditandai "segera" |
| US2 | M/R1 | Guru: menyeret komponen ke meja | KP: komponen jatuh di posisi lepas; posisi tersimpan saat reload; bisa dipindah dan dihapus |
| US3 | M/R1 | Guru: menyambung kabel antar terminal | KP: seret atau klik asal lalu tujuan membuat kabel; Esc membatalkan; terminal menampilkan label dan tanda +/-; sambungan ke terminal penuh (kapasitas katalog) ditolak dengan alasan singkat; polaritas salah **tidak** ditolak di Rakit Bebas |
| US4 | M/R1 | Guru: memilih penampang dan panjang kabel | KP: resistansi = ρ·(2L)/A (pergi-pulang); mengubah 2,5 -> 6 mm² menurunkan jatuh tegangan sesuai rumus dalam toleransi 1%; kabel tak cukup untuk arus menunjukkan indikator panas/rating terlampaui [PERLU VERIFIKASI ampacity] |
| US5 | M/R1 | Guru: melihat pengaruh iradiasi | KP: pada kurva I-V satu panel, Isc proporsional terhadap iradiasi (1000 -> 500 W/m² ≈ setengah, toleransi 2%); hasil sesuai uji unit |
| US6 | M/R1 | Guru: melihat pengaruh suhu | KP: kenaikan suhu sel 25 -> 65 °C menurunkan Voc sesuai koefisien datasheet dalam toleransi 1% |
| US7 | M/R1 | Guru: merangkai seri dan paralel | KP: untuk panel identik, 2 seri: Voc rangkaian terbuka = 2x; 2 paralel: Isc dengan ampere meter seri = 2x; saat terhubung SCC/beban, multimeter menampilkan **titik kerja** pada kurva I-V gabungan, bukan nilai nominal |
| US8 | S/R2 | Guru: membandingkan PWM dan MPPT | KP: pada kondisi iradiasi, suhu, beban sama, energi harian MPPT ≥ PWM bila tegangan panel > tegangan baterai; bila baterai penuh atau arus dibatasi, selisih tidak dipaksakan dan sebabnya tampil |
| US9 | M/R1 | Guru: memantau SoC dan batas baterai | KP: SoC turun sesuai Wh terpakai; inverter memutus oleh **tegangan terminal** melewati ambang LVD dan menyambung kembali di ambang lebih tinggi (histeresis), meski SoC belum 0% (uji beban berat); estimasi SoC, batas pemakaian latihan, dan proteksi perangkat ditampilkan terpisah |
| US10 | M/R1 | Guru: melihat pengisian baterai | KP: SCC beralih bulk -> absorb -> float sesuai tegangan baterai; arus turun saat tegangan absorb tercapai |
| US11 | M/R1 | Guru: mengukur tegangan | KP: probe merah/hitam pada dua terminal menampilkan V; probe terbalik menampilkan tanda minus; selektor V DC yang salah (mis. mode A) lihat US12 |
| US12 | M/R1 | Guru: mengukur arus dengan benar | KP: ampere meter harus dipasang **seri** (jack A, selektor A); memasangnya melintang sumber menghubung-singkatkan sumber, memutus fuse alat, dan menampilkan 0 A + indikator fuse alat putus; clamp DC menampilkan arus satu kabel dengan tanda arah dan fungsi nol; klem dua kabel sepasang ≈ 0 A |
| US13 | M/R1 | Guru: melihat proteksi bekerja | KP: arus melebihi rating MCB/fuse memicu trip/putus sesuai kurva arus-waktu sederhana; arus berhenti; rating tegangan DC perangkat dicek; hubung singkat PV (arus dibatasi Isc) **tidak** memutus MCB berating lebih tinggi dari Isc sedangkan hubung singkat baterai memutusnya [PERLU VERIFIKASI nilai] |
| US14 | M/R1 | Guru: mereset setelah salah | KP: Reset percobaan, Perbaiki komponen, dan Mulai ulang skenario berperilaku sesuai tabel §3.2; reset tidak memuat ulang halaman |
| US15 | M/R1 | Guru: melihat akibat polaritas terbalik | KP: akibat ditentukan per model katalog (rusak, galat, atau fuse putus) dan ditandai sebagai perilaku model; polaritas terbalik tanpa fuse pada perangkat tanpa proteksi merusak komponen; fuse tidak dijamin melindungi elektronik [PERLU VERIFIKASI per datasheet] |
| US16 | M/R1 | Guru: melihat batas Voc | KP: Voc string pada suhu terendah dibandingkan batas input SCC; melampaui batas menampilkan peringatan sebelum energisasi; akibat (galat atau rusak) mengikuti data model, bukan selalu rusak |
| US17 | M/R1 | Guru: mengikuti urutan penyambungan | KP: urutan yang disyaratkan model (mis. baterai dahulu) dicek; urutan salah menghasilkan galat/deteksi atau kerusakan sesuai data model; urutan benar berjalan normal |
| US18 | M/R1 | Guru: melihat inverter dan beban AC | KP: beban AC resistif; arus DC masukan dihitung dari daya AC + efisiensi + konsumsi tanpa beban; melebihi batas kontinu mematikan inverter setelah waktu overload model; beban di bawah rating tetap bisa mati karena LVD (lihat US9); V AC keluaran terbaca dengan meter V AC |
| US19 | M/R1 | Guru: memakai Praktik Terpandu | KP: langkah aktif menyorot terminal tujuan; aksi salah tidak melanjutkan langkah; daftar periksa aman (isolasi, polaritas, rating, ukur Voc) wajib selesai sebelum energisasi; salah drag tidak dihitung kesalahan listrik |
| US20 | S/R2 | Instruktur: menyisipkan gangguan | KP: memilih gangguan dari daftar menerapkannya; gejala terukur berubah (mis. arus 0 A saat fuse putus); gangguan bertahan saat Reset percobaan |
| US21 | S/R2 | Guru: mencari gangguan | KP: penyebab tersembunyi; jawaban lulus hanya bila menyertakan bukti (titik ukur, nilai, alasan terstruktur); jawaban benar tanpa bukti ukur mendapat skor sebagian; umpan balik pasca-percobaan memuat gejala, bukti, perbaikan |
| US22 | C/R3 | Instruktur: menjalankan asesmen | KP: rubrik proses (prosedur aman, urutan) dan hasil; log waktu, kesalahan listrik, bukti; ekspor JSON/CSV memuat identitas peserta lokal, ID/versi skenario, waktu |
| US23 | C/R3 | Guru: memakai on-grid | KP: saat grid padam inverter grid-tie berhenti menginjeksi (anti-islanding) dalam < 2 s [PERLU VERIFIKASI]; kWh meter menghitung ekspor dan impor terpisah |
| US24 | M/R1 | Guru: bekerja tanpa internet | KP: indikator "siap offline" hijau hanya setelah semua aset wajib (katalog, skenario, gambar) tersimpan; dengan jaringan mati, seluruh fitur Must berjalan |
| US25 | M/R1 | Guru: memakai tablet dan keyboard | KP: seret dan klik-asal-tujuan berfungsi dengan sentuhan; tidak ada fungsi butuh klik kanan/hover; seluruh alur sambung kabel bisa dengan keyboard; kontrol bernama aksesibel |
| US26 | M/R1 | Guru: menyimpan dan membuka proyek | KP: proyek tersimpan di perangkat dengan nomor versi; terbuka kembali dalam keadaan jeda dengan susunan sama; ekspor/impor berkas cadangan berfungsi |
| US27 | M/R1 | Guru: memahami komponen sekilas | KP: label terminal, satuan, rating kritis selalu tampak; tombol "?" memberi penjelasan singkat; tanpa menekan "?" tidak ada paragraf; penolakan sambungan memberi alasan satu kalimat |
| US28 | S/R2 | Instruktur: membagikan tugas | KP: skenario dimuat dari berkas lokal; hasil diekspor dan dikumpulkan manual; tidak ada janji pemantauan langsung |
| US29 | M/R1 | Guru: membaca status tanpa warna | KP: setiap status (trip, rusak, aman, galat) punya ikon + teks singkat selain warna; lulus uji simulasi buta warna |
| US30 | M/R1 | Guru: memahami asumsi proteksi | KP: bila koordinasi proteksi tidak dimodelkan, layar menandainya sebagai "asumsi latihan", bukan jaminan perangkat |

## 6. Perilaku "nyata" yang wajib disimulasikan

| Perilaku | Wajib dihitung | Dipakai oleh |
|---|---|---|
| Iradiasi dan suhu | Isc ∝ iradiasi; Voc turun terhadap suhu (koefisien datasheet); suhu sel dari lingkungan + iradiasi (NOCT) | US5, US6 |
| Seri-paralel dan titik kerja | Panel identik: tegangan seri dijumlahkan, arus paralel dijumlahkan; Voc, Isc, dan titik kerja pada kurva I-V gabungan dibedakan; mismatch/peneduhan per panel sederhana dengan batas pendekatannya dinyatakan | US7 |
| PWM vs MPPT | PWM menarik tegangan panel ke tegangan baterai; MPPT di titik daya maksimum + efisiensi; pembatasan arus SCC dan baterai penuh diperhitungkan | US8, US10 |
| Baterai | Tegangan terminal dari SoC + resistansi internal + arus; kapasitas VRLA bergantung laju pelepasan [PERLU VERIFIKASI]; efisiensi coulomb; LVD/HVD berbasis tegangan dengan histeresis; estimasi SoC terpisah dari proteksi | US9, US10 |
| Kabel | Resistansi lintasan pergi-pulang dari tembaga, penampang, panjang; jatuh tegangan V = I·R; rating arus kabel [PERLU VERIFIKASI] | US4 |
| Proteksi dan gangguan | Kurva arus-waktu MCB/fuse; rating tegangan DC; arus PV dibatasi Isc; arus hubung singkat baterai dari resistansi lintasan + internal; proteksi internal perangkat; contoh hubung singkat yang tidak mencapai ambang trip | US13 |
| Polaritas terbalik | Terminal berpolaritas; akibat per model (rusak, galat, fuse putus, tak bekerja); fuse tidak dijamin melindungi | US15 |
| Voc vs batas SCC | Voc string pada suhu terendah vs batas input; akibat per model | US16 |
| Urutan penyambungan | Mesin status per model (mis. baterai dahulu, panel, beban terakhir); galat deteksi dibedakan dari kerusakan | US17 |
| Alat ukur | Multimeter (selektor, jack, seri/paralel, fuse alat), clamp DC (tanda arah, nol), meter V AC; beban AC resistif | US11, US12, US18 |
| Inverter dan beban | Daya masukan DC = keluaran AC/efisiensi + tanpa beban; batas kontinu, lonjakan, waktu overload per model; LVD memutus meski daya di bawah rating | US9, US18 |
| Anti-islanding (R3) | Inverter grid-tie berhenti saat grid hilang; resambung setelah grid stabil + tunda | US23 |
| SPD (R2) | Kejadian lonjakan diskret + indikator status; jalur PE; bentuk gelombang tidak dimodelkan | US15 R2 |

Semua fungsi fisika ada di `src/domain/` (TypeScript murni) dan wajib punya unit test.

## 7. Batasan: tidak disimulasikan di v1

| Tidak disimulasikan | Alasan / catatan |
|---|---|
| Dinamika transien cepat (µs-ms), bentuk gelombang lonjakan, harmonik, flicker | Keadaan tunak per langkah waktu; SPD hanya kejadian diskret |
| Medan listrik/magnet dan EMC | Tidak relevan untuk latihan |
| Beban motor/induktif dengan arus lonjakan awal | Tunda sampai lonjakan dimodelkan; v1 beban resistif |
| Bayangan parsial per sel dan bypass diode detail | v1 hanya mismatch sederhana dan peneduhan per panel |
| Degradasi panel dan penuaan baterai jangka panjang | Parameter tetap kondisi awal |
| Termal detail (pendinginan inverter, derating rumit) | Hanya derating sederhana bila ada di datasheet |
| Koordinasi proteksi penuh antar produsen | Ditampilkan sebagai asumsi latihan |
| Generator diesel, turbin angin, jaringan tiga fase | Di luar lingkup |
| Komunikasi antar-perangkat (RS485/CAN, protokol BMS) | Monitoring sebagai nilai |
| Grid code penuh dan perilaku jaringan PLN nyata | Hanya tegangan/frekuensi nominal dan padam/menyala (R3+) |
| Cedera pengguna | Tidak disimulasikan; prosedur aman dilatih lewat daftar periksa |
| Backend, akun, multi-pengguna, pemantauan peserta langsung | Aplikasi sepenuhnya lokal; hasil dikumpulkan manual |
| Kelayakan ekonomi dan perizinan | Bukan tujuan trainer |

## 8. Indikator keberhasilan

Target diukur pada paket yang benar-benar dirilis (R1 = paket Minimum).

| Indikator | Target | Cara ukur |
|---|---|---|
| Merakit paket Minimum tanpa bantuan | ≥ 80% peserta baru selesai dalam 15 menit | Uji dengan guru yang belum pernah memakai aplikasi; log lokal |
| Kepatuhan prosedur aman | ≥ 80% peserta menyelesaikan daftar periksa sebelum energisasi tanpa diingatkan | Log rubrik tindakan |
| Diagnosis gangguan (R2) | ≥ 70% peserta menemukan penyebab dengan bukti ukur dalam 10 menit | Mode Cari Gangguan |
| Pemahaman prinsip | Rata-rata kenaikan skor pra-pasca ≥ 20 poin | Tes singkat |
| Keterpakaian | Skor kepuasan ≥ 4/5; ≥ 90% pengguna baru menemukan terminal dan alasan penolakan tanpa bantuan | Kuesioner dan observasi |
| Kinerja | Muat awal < 5 s; simulasi ≥ 30 fps pada paket R1 di laptop acuan [PERLU VERIFIKASI spesifikasi acuan] | Playwright dan profiling di perangkat/browser/zoom acuan |
| Keandalan offline | 100% fitur Must berjalan tanpa internet; indikator "siap offline" akurat | Uji alur Playwright jaringan mati |
| Akurasi fisika | Lolos matriks referensi independen (bukan hanya unit test sendiri): panel STC dan non-STC, baterai charge/discharge, titik kerja SCC, neraca energi, jatuh tegangan, kurva trip; toleransi per besaran [PERLU VERIFIKASI] | Vitest + perhitungan referensi terpisah/datasheet |
| Alur lengkap | Rakit-ukur-perbaiki lolos di laptop 1366x768 dan tablet, dengan pan/zoom kanvas | Playwright (perangkat, browser, zoom ditetapkan) |
