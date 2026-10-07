# PRD — Trainer Virtual PLTS (SimPLTS) v1

Angka teknis bertanda [PERLU VERIFIKASI] harus dicek ke datasheet sebelum masuk katalog.

## 1. Pengguna dan kondisi lab

| Persona | Profil | Kebutuhan utama |
|---|---|---|
| Guru peserta | Guru SMK teknik ketenagalistrikan; paham dasar listrik, belum tentu pernah memegang PLTS | Berlatih merangkai, mengukur, dan mencari gangguan tanpa takut merusak alat; hasil bisa dibawa mengajar |
| Instruktur (widyaiswara) | Mengajar kelas 15-30 guru | Memilih paket dan skenario, menyisipkan gangguan, melihat hasil asesmen peserta, mereset cepat |

Kondisi lab (batasan desain):

| Aspek | Kondisi | Konsekuensi |
|---|---|---|
| Perangkat | Laptop spesifikasi menengah, kadang tablet | Simulasi ringan; sentuh dan mouse sama-sama didukung |
| Layar | 1366x768 sebagai acuan | Semua alur harus muat tanpa scroll halaman; target sentuh minimal 44 px |
| Internet | Tidak stabil | PWA offline penuh; tanpa backend dan tanpa API key |
| Bahasa | Indonesia | Teks di `src/i18n/id.ts`; istilah sesuai kelaziman SKKNI/PUIL |

## 2. Paket trainer (preset)

| Paket | Konfigurasi | Komponen utama |
|---|---|---|
| Minimum | Off-grid 12 V | 2x panel 100 Wp; MCB DC + fuse; SCC PWM 20 A; baterai VRLA 12 V 100 Ah; inverter pure sine 500 W; beban DC dan AC |
| Rekomendasi A | Off-grid 24 V | 2x200 Wp; combiner box + SPD; SCC MPPT 40 A; LiFePO4 24 V 100 Ah; inverter 1,5 kW |
| Rekomendasi B | On-grid | 4x200 Wp seri; inverter grid-tie 1 kW; kWh meter exim; jaringan PLN (grid) |
| Terbaik | Hibrida 3,2 kWp | 16x200 Wp (2 string x 8 [PERLU VERIFIKASI]); inverter hibrida 5 kW MPPT ganda; LiFePO4 48 V 100 Ah + BMS; kWh meter exim; panel beban; monitoring |

Preset hanya menyediakan daftar komponen di baki dan skenario awal; peserta tetap merangkai sendiri. Setiap komponen memakai parameter datasheet dari `src/data/`.

## 3. Empat mode

| Mode | Tujuan | Perilaku |
|---|---|---|
| Rakit Bebas | Eksplorasi | Semua komponen paket tersedia; tanpa petunjuk; kesalahan berakibat nyata lalu bisa direset |
| Praktik Terpandu | Belajar langkah demi langkah | Langkah bergambar (ikon, sorotan terminal); langkah salah ditolak/ditandai; tombol "?" untuk penjelasan |
| Cari Gangguan | Diagnosis | Skenario dengan gangguan tersembunyi (fuse putus, kabel longgar, polaritas terbalik, panel teduh); peserta mengukur dan menunjuk penyebab |
| Asesmen | Penilaian | Tugas tanpa petunjuk, ada batas waktu opsional; skor dan log aksi; hasil dapat diekspor |

## 4. Fitur v1 (MoSCoW)

| ID | Fitur | Prioritas |
|---|---|---|
| F1 | Kanvas drag-drop komponen dari baki ke meja kerja | Must |
| F2 | Kabel terminal-ke-terminal dengan polaritas, penampang, dan panjang | Must |
| F3 | Mesin simulasi domain (iradiasi, suhu, seri-paralel, kurva I-V) | Must |
| F4 | Paket Minimum lengkap (PWM, VRLA, inverter 500 W) | Must |
| F5 | Alat ukur: multimeter (V/A DC), clamp meter, indikator lampu | Must |
| F6 | Proteksi: MCB/fuse trip, akibat visual (asap, komponen rusak), reset | Must |
| F7 | Mode Rakit Bebas dan Praktik Terpandu | Must |
| F8 | Kontrol simulasi: jam surya, iradiasi, suhu, beban, jeda/percepat | Must |
| F9 | Katalog dan skenario berformat JSON tervalidasi zod | Must |
| F10 | PWA offline, simpan proyek lokal | Must |
| F11 | Mode Cari Gangguan (min. 6 skenario) | Should |
| F12 | Paket Rekomendasi A (MPPT, LiFePO4, SPD) | Should |
| F13 | Paket Rekomendasi B (on-grid, anti-islanding, kWh meter exim) | Should |
| F14 | Mode Asesmen dengan skor dan ekspor hasil | Should |
| F15 | Inspector komponen (parameter datasheet) dan tooltip "?" | Should |
| F16 | Paket Terbaik (hibrida 48 V, BMS, monitoring) | Could |
| F17 | Ekspor laporan PDF / cetak | Could |
| F18 | Mode gelap, layout tablet yang dioptimalkan | Could |
| F19 | Backend, akun, sinkronisasi cloud | Won't (v1) |
| F20 | Multi-pengguna real-time | Won't (v1) |

## 5. User story dan kriteria penerimaan

Format: **US** — sebagai peran, saya ingin ..., agar ... ; **KP** = kriteria penerimaan yang dapat diuji.

| ID | Cerita | Kriteria penerimaan |
|---|---|---|
| US1 | Guru: memilih paket trainer | KP: memilih "Minimum" menampilkan 8 jenis komponen paket di baki; memilih paket lain mengganti isi baki |
| US2 | Guru: menyeret komponen ke meja | KP: komponen jatuh di posisi lepas; posisi tersimpan saat reload; bisa dihapus dan dipindah |
| US3 | Guru: menarik kabel antar terminal | KP: kabel hanya tersambung ke terminal valid; terminal menampilkan tanda +/-; sambungan ke terminal terisi ditolak dengan umpan balik visual |
| US4 | Guru: memilih penampang dan panjang kabel | KP: mengubah penampang 2,5 -> 6 mm² mengurangi jatuh tegangan sesuai rumus R = ρL/A dalam toleransi 1% |
| US5 | Guru: melihat daya panel berubah dengan iradiasi | KP: iradiasi 1000 -> 500 W/m² menurunkan arus panel sekitar setengah; hasil sesuai uji unit domain |
| US6 | Guru: melihat efek suhu | KP: suhu sel naik 25 -> 65 °C menurunkan Voc sesuai koefisien suhu datasheet dalam toleransi 1% |
| US7 | Guru: merangkai panel seri dan paralel | KP: 2 panel seri menggandakan tegangan; 2 paralel menggandakan arus; multimeter menunjukkan nilai tersebut |
| US8 | Guru: membandingkan PWM dan MPPT | KP: pada kondisi sama, SCC MPPT menghasilkan energi harian lebih besar dari PWM pada konfigurasi tegangan panel > tegangan baterai; grafik atau angka kWh ditampilkan |
| US9 | Guru: memantau SoC baterai | KP: baterai dengan beban menurun SoC sesuai Wh/kapasitas; indikator mencapai 0% memutus inverter (LVD) |
| US10 | Guru: melihat pengisian baterai | KP: SCC beralih tahap bulk -> absorb -> float; arus turun saat tegangan mencapai batas |
| US11 | Guru: membaca tegangan dengan multimeter | KP: probe merah/hitam ditempatkan pada dua terminal; nilai tampil; probe terbalik menampilkan tanda minus |
| US12 | Guru: mengukur arus dengan clamp meter | KP: klem pada satu kabel menampilkan arus kabel itu; klem pada dua kabel sepasang menampilkan ~0 A |
| US13 | Guru: melihat proteksi bekerja | KP: arus melebihi rating MCB/fuse membuat trip/putus dalam waktu sesuai kurva sederhana; arus mengalir berhenti |
| US14 | Guru: mereset setelah salah | KP: tombol "Reset" mengembalikan komponen rusak/trip ke kondisi awal tanpa memuat ulang halaman |
| US15 | Guru: melihat akibat polaritas terbalik | KP: baterai terhubung terbalik ke SCC tanpa proteksi merusak SCC (indikator asap) dan ditandai rusak; dengan fuse, fuse putus |
| US16 | Guru: melihat akibat Voc melebihi batas SCC | KP: panel seri yang Voc dingin-nya melebihi batas SCC merusak SCC; peringatan terlihat sebelum tersambung bila urutan benar |
| US17 | Guru: melihat urutan penyambungan | KP: menyambung panel sebelum baterai pada SCC yang mensyaratkan baterai dahulu menimbulkan galat/kerusakan; urutan benar berjalan normal |
| US18 | Guru: melihat inverter bekerja | KP: beban AC melebihi 500 W (Minimum) membuat inverter overload dan mati; beban di bawah batas menyala |
| US19 | Guru: memakai Praktik Terpandu | KP: langkah aktif menyorot terminal tujuan; aksi salah tidak lanjut ke langkah berikut; penyelesaian semua langkah menampilkan tanda selesai |
| US20 | Instruktur: menyisipkan gangguan | KP: memilih gangguan dari daftar menerapkannya ke rangkaian; gejala terukur berubah (misal arus 0 A pada fuse putus) |
| US21 | Guru: mencari gangguan sendiri | KP: skenario Cari Gangguan menyembunyikan penyebab; memilih penyebab benar menandai lulus; salah mengurangi skor |
| US22 | Instruktur: menjalankan asesmen | KP: asesmen mencatat waktu, jumlah kesalahan, dan hasil; ekspor JSON/CSV berisi data tersebut |
| US23 | Guru: memakai on-grid | KP: saat grid padam, inverter grid-tie berhenti menginjeksi (anti-islanding) dalam waktu simulasi < 2 s [PERLU VERIFIKASI]; kWh meter menghitung ekspor dan impor terpisah |
| US24 | Guru: bekerja tanpa internet | KP: setelah kunjungan pertama, aplikasi dimuat dan berjalan penuh dengan jaringan dimatikan |
| US25 | Guru: memakai tablet | KP: seret komponen dan tarik kabel berfungsi dengan sentuhan; tidak ada fungsi yang butuh klik kanan atau hover |
| US26 | Guru: menyimpan dan membuka proyek | KP: proyek tersimpan di perangkat dan terbuka kembali dengan susunan dan keadaan sama |
| US27 | Guru: memahami komponen sekilas | KP: tombol "?" menampilkan penjelasan singkat; tanpa menekan "?" layar tidak berisi paragraf penjelasan |

## 6. Perilaku "nyata" yang wajib disimulasikan

| Perilaku | Wajib dihitung | Dipakai oleh |
|---|---|---|
| Iradiasi dan suhu | Arus ∝ iradiasi; Voc turun terhadap suhu (koefisien datasheet); suhu sel dari suhu lingkungan + iradiasi (NOCT) | US5, US6 |
| Seri-paralel | Tegangan dijumlahkan seri, arus dijumlahkan paralel; ketidakcocokan (mismatch) sederhana | US7 |
| PWM vs MPPT | PWM menarik tegangan panel ke tegangan baterai; MPPT bekerja di titik daya maksimum dengan efisiensi konversi | US8 |
| SoC baterai | Integrasi arus/energi, efisiensi coulomb, batas LVD/HVD; kurva tegangan terhadap SoC per kimia (VRLA/LiFePO4) | US9, US10 |
| Jatuh tegangan kabel | V = I·R dengan R dari bahan tembaga, penampang, panjang | US4 |
| Trip proteksi | Kurva sederhana arus-waktu untuk MCB dan fuse; SPD sebagai penyalur lonjakan | US13 |
| Polaritas terbalik | Terminal berpolaritas; akibat per komponen (rusak, fuse putus, tidak bekerja) | US15 |
| Voc melebihi batas SCC | Voc string pada suhu terendah dibandingkan batas input SCC/inverter | US16 |
| Urutan penyambungan | Mesin status komponen: baterai dahulu, panel kemudian, beban terakhir (sesuai petunjuk perangkat) | US17 |
| Anti-islanding | Inverter grid-tie berhenti saat grid hilang; resambung setelah grid stabil dan tunda waktu | US23 |

Semua fungsi fisika ada di `src/domain/` (TypeScript murni) dan wajib punya unit test.

## 7. Batasan: tidak disimulasikan di v1

| Tidak disimulasikan | Alasan / catatan |
|---|---|
| Dinamika transien cepat (µs-ms), harmonik, flicker | Di luar kebutuhan latihan; simulasi memakai keadaan tunak (steady-state) per langkah waktu |
| Medan listrik/magnet dan EMC | Tidak relevan untuk tujuan latihan |
| Bayangan parsial per sel dan bypass diode detail | v1 hanya mismatch sederhana dan satu peneduhan per panel |
| Degradasi panel dan penuaan baterai jangka panjang | Parameter tetap pada kondisi awal |
| Termal detail (pendinginan inverter, derating suhu rumit) | Hanya derating sederhana bila ada di datasheet |
| Generator diesel, turbin angin, jaringan tiga fase | Di luar lingkup paket |
| Komunikasi antar-perangkat (RS485/CAN, protokol BMS) | Monitoring ditampilkan sebagai nilai, bukan protokol |
| Kode jaringan penuh (grid code) dan perilaku jaringan PLN nyata | Hanya tegangan/frekuensi nominal dan padam/menyala |
| Backend, akun, multi-pengguna, sinkronisasi cloud | Aplikasi sepenuhnya lokal |
| Perhitungan kelayakan ekonomi dan perizinan | Bukan tujuan trainer |

## 8. Indikator keberhasilan

| Indikator | Target | Cara ukur |
|---|---|---|
| Merakit paket Minimum tanpa bantuan | ≥ 80% peserta selesai dalam 15 menit | Uji dengan kelompok guru; waktu dari log |
| Diagnosis gangguan | ≥ 70% peserta menemukan penyebab pada skenario dasar dalam 10 menit | Mode Cari Gangguan; log asesmen |
| Pemahaman prinsip | Rata-rata kenaikan skor pra-pasca ≥ 20 poin | Tes singkat sebelum dan sesudah pelatihan |
| Kemudahan | Skor kepuasan ≥ 4 dari 5; tidak ada fungsi yang butuh penjelasan teks panjang | Kuesioner peserta |
| Kinerja | Muat awal < 5 s di laptop menengah; simulasi tetap ≥ 30 fps pada paket Terbaik [PERLU VERIFIKASI] | Uji Playwright dan profiling |
| Keandalan offline | 100% fitur Must berjalan tanpa internet | Uji alur Playwright dengan jaringan dimatikan |
| Akurasi fisika | Semua fungsi domain lolos unit test; selisih terhadap datasheet ≤ 5% pada kondisi uji standar (STC) | Vitest |
