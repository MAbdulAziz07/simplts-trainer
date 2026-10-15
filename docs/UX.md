# Kajian UX — Prototipe Tampilan SimPLTS

Tanggal: 2026-10-10
Bahan: 4 tangkapan layar di `docs/ux/` (01 layar utama, 02 komponen dipilih, 03 kabel ditarik, 04 panel kendali simulasi), ukuran 1366x768.
Acuan: `docs/PRD.md` (layar 1366x768, target sentuh minimal 44 px, status tidak hanya warna, US3, US25, US27, US29).
Catatan: semua ukuran piksel pada kolom "Yang terlihat" adalah perkiraan dari gambar, bukan hasil ukur di kode.

## 0. Ringkasan penilaian

| Sisi | Nilai | Yang terlihat |
|---|---|---|
| Kejelasan tanpa membaca teks | Kurang | Terminal tanpa label (hanya +/−); SCC hanya punya 2 terminal, padahal butuh 6 (PV, BAT, LOAD); tidak ada angka V/A di meja kecuali LCD SCC; tab mode dan status hanya teks |
| Ukuran target klik/sentuh | Kurang | Terminal ±16 px berjarak ±32 px; tombol kecepatan ±28 px; ibu jari slider ±16 px; baris kategori ±24 px; ikon simpan/buka/reset ±20 px; tempat sampah ±18 px. Hanya tombol putar (±46 px) dan kartu baki yang memenuhi 44 px |
| Hierarki visual | Sedang | Meja kerja hanya ±450 dari 768 px tinggi layar (±59%); judul, breadcrumb, dan legenda memakan ±140 px; teks hias 9–10 px ("MEJA KERJA / 01", "PV TRAINER 01", "VIRTUAL LAB / SMK") bersaing dengan isi |
| Konsistensi warna DC/AC | Kurang | Kabel + dan − sama-sama jingga (gambar 03), polaritas tidak terbaca; jingga "DC" juga dipakai slider waktu dan iradiasi; hijau toska "AC" juga dipakai merek, tombol putar, tab aktif, dan titik status "siap" |
| Beban kognitif | Sedang | Ada mode pilih/kabel yang tidak perlu (petunjuk di bawah sudah bilang "klik terminal"); inspektur berupa tabel teks dan terpotong di bawah; lencana "Aktif", "DEMO", "Data tiruan", "Kondisi contoh" tidak membantu tugas; kartu baterai menimpa kartu panel |

Yang sudah baik dan dipertahankan: tata tiga kolom (baki – meja – inspektur) dengan bilah simulasi di bawah, gambar komponen yang mirip benda asli, tombol putar besar, toast singkat "Kabel terhubung", dan latar meja bertitik.

## 1. Perbaikan (urut dari paling berdampak)

Setiap butir adalah satu kalimat perintah yang bisa ditempel langsung ke Google AI Studio.

1. Perbesar setiap terminal menjadi lingkaran tampak 24 px dengan area klik 44 px dan jarak antarpusat minimal 48 px, beri label tebal 12 px di sampingnya (PV+, PV−, BAT+, BAT−, LOAD+, LOAD−, L, N, PE), letakkan di tepi kartu tanpa menutupi nama komponen, dan tampilkan SCC dengan enam terminal.
2. Warnai kabel menurut fungsi penghantar, bukan satu warna jingga: DC+ merah, DC− hitam, fasa AC cokelat, netral biru, dan PE hijau bergaris kuning, dengan tebal 4 px dan terminal berwarna sama dengan kabelnya.
3. Hapus tombol mode pilih/kabel di pojok meja kerja, lalu buat kabel langsung bisa ditarik dari terminal atau dengan klik terminal asal kemudian terminal tujuan, sambil semua terminal yang boleh dituju berdenyut dan terminal lain meredup.
4. Perluas meja kerja dengan menghapus breadcrumb, judul "Rangkaian PLTS mandiri", lencana "Data tiruan", dan semua teks hias kecil, mengecilkan bilah atas menjadi 56 px dan bilah simulasi menjadi 72 px, serta memindahkan legenda dan status menjadi cip mengambang di dalam meja.
5. Saat simulasi berjalan, tampilkan angka tegangan dan arus dalam cip bergaya LCD 14 px di setiap komponen, titik-titik bergerak di sepanjang kabel searah arus, dan ikon status di pojok kartu (centang, segitiga peringatan, tuas MCB turun, asap) sebagai pengganti titik hijau kecil.
6. Jangan pakai warna kabel untuk hal lain: jadikan hijau toska hanya warna merek dan tombol utama, ubah slider waktu, iradiasi, dan awan menjadi abu-abu netral, dan ganti legenda bawah dengan contoh garis kabel lima warna berikut bentuk terminalnya.
7. Ubah baki menjadi ubin gambar dua kolom berukuran 92x92 px berisi gambar besar dan nama maksimal tiga kata, tanpa pegangan titik enam, tanpa angka jumlah, dan tanpa lencana DC, dengan judul kategori setinggi 44 px beserta ikonnya serta kategori kosong disembunyikan.
8. Ringkas inspektur selebar 280 px menjadi gambar komponen, nama, dan paling banyak empat rating utama berupa ikon dengan angka 20 px, tombol "?" setinggi 44 px, serta tombol hapus 44 px yang terpisah di pojok bawah dan bisa dibatalkan, tanpa ada bagian yang terpotong di layar 1366x768.
9. Pada bilah simulasi buat tombol kecepatan setinggi 44 px, ibu jari slider 28 px, jam bertulis 12:00 dengan ikon matahari yang bergeser sesuai waktu, dan saat berjalan beri bilah garis hijau toska bergerak di tepi atas, lalu hapus tulisan "data tiruan" dan "Kondisi contoh".
10. Beri setiap tab mode ikon di atas label dengan tinggi 44 px, jadikan tombol simpan, buka, dan reset berukuran 44 px dengan label 12 px di bawahnya dan tombol reset dipisah serta meminta konfirmasi, tetapkan ukuran huruf terkecil 12 px, dan tempelkan komponen ke kisi 24 px agar kartu tidak saling menimpa.

## 2. Keputusan tata letak final (dipakai di Tahap 5)

Acuan desain: jendela 1366x768. Area tampil browser di laptop 1366x768 umumnya lebih pendek (±650 px) karena bilah browser [PERLU VERIFIKASI pada laptop peserta]; karena itu tinggi bilah di bawah ini dibuat sehemat mungkin dan tidak boleh bertambah.

### 2.1 Ukuran area

| Area | Ukuran | Aturan |
|---|---|---|
| Bilah atas | tinggi 56 px, lebar penuh | Logo + nama, pilihan paket, tingkat Pemula/Mahir, simpan / buka / preset, lalu reset percobaan yang dipisah garis dan meminta konfirmasi. Empat tab mode (ikon + label) ditambahkan saat mode selain Rakit Bebas dibuat (revisi 2026-10-12) |
| Baki komponen | lebar 216 px; rel ikon 64 px saat dilipat | Ubin 92x92 px, dua kolom, sela 8 px, tepi 12 px; judul kategori 44 px; gulir vertikal |
| Meja kerja | sisa ruang: 1150x640 px tanpa inspektur, 870x640 px dengan inspektur | Kisi 24 px, komponen menempel ke kisi; zoom 15–200% (terkecil 15% agar rangkaian besar bisa dilihat utuh), awal 100%, tombol "paskan"; legenda warna kabel, alat ukur, temuan, dan status berupa cip atau panel mengambang di dalam meja |
| Inspektur | lebar 280 px, tidak terbuka otomatis: muncul saat tombol "Parameter" (ikon penggeser) di bilah atas dinyalakan dan tepat satu komponen terpilih | Isi tidak boleh terpotong pada tinggi 640 px; di bawah lebar 1024 px menjadi lembar bawah setinggi 40% layar |
| Bilah simulasi | tinggi 72 px, lebar penuh | Putar/jeda 48 px, kecepatan (1×/60×/600×/3600×), jam, iradiasi, awan, suhu lingkungan, dan tombol grafik 24 jam; selalu terlihat |
| Toast | di tengah bawah meja, 16 px di atas bilah simulasi | Hilang sendiri setelah 3 detik; tidak menutupi terminal yang sedang dipakai |

### 2.2 Komponen di meja

Revisi 2026-10-12: komponen tampil sebagai gambarnya sendiri, tanpa kartu. Kartu berukuran tetap (144x144, 192x168, 288x192 px) dibatalkan karena mengecilkan gambar, padahal terminal ditandai langsung di atas gambar.

| Jenis | Sisi terpanjang gambar | Contoh |
|---|---|---|
| Kecil | 144 px (MCB AC 168 px) | MCB, fuse, SPD, beban |
| Sedang | 216 px | Panel surya, baterai, kWh meter |
| Besar | 288 px (SCC 264 px) | Inverter, busbar, combiner, panel beban |

- Rasio gambar dipertahankan, supaya posisi terminal (% terhadap gambar) tetap pas.
- Di luar gambar: nama (12 px, maksimal 3 kata) di atas, deret indikator di atas nama, tanda status di pojok kanan atas (§2.4), tuas MCB dan tombol reset di kanan.
- Komponen terpilih: garis tepi 3 px hijau toska. Komponen yang gambarnya belum ada tampil sebagai kotak berikon.

### 2.3 Terminal dan kabel

| Hal | Keputusan |
|---|---|
| Terminal tampak | 14–24 px menurut jarak ke terminal terdekat pada gambar (revisi 2026-10-12: 24 px tetap membuat titik terminal yang rapat saling menimpa) |
| Area klik/sentuh terminal | 44 px, tetap 44 px di layar pada semua tingkat zoom; untuk terminal yang rapat dipotong di garis tengah ke tetangganya supaya tidak bertumpuk (revisi 2026-10-15: area sentuh juga tidak masuk ke inti badan komponen, kotak 24 px di layar di tengah komponen dan paling besar separuh lebar/tingginya, supaya komponen kecil tetap bisa dipilih pada zoom kecil; ke arah luar dan ke samping tetap 22 px. Saat "Tunjuk penyebab" terbuka, area sentuh terminal dimatikan kecuali probe sedang dipasang) |
| Jarak antarpusat terminal | mengikuti letak terminal pada gambar (revisi 2026-10-12: minimal 48 px tidak tercapai pada gambar kecil) |
| Bentuk terminal | DC bulat; AC persegi sudut tumpul; PE persegi dengan simbol pembumian |
| Label terminal | 12 px tebal, selalu tampak, di luar lingkaran. Label yang sama persis dengan tanda di dalam titik (+, −, L, N) baru muncul saat hover, komponen terpilih, atau kabel ditarik |
| Tebal kabel | 3 px (≤ 2,5 mm²), 4 px (4–6 mm²), 6 px (≥ 10 mm²); area klik kabel 16 px |
| Kabel terpilih | lingkar cahaya 3 px hijau toska |
| Terminal tujuan sah saat menarik kabel | berdenyut; terminal lain meredup 40% |
| Terminal penuh | ikon gembok selama kabel ditarik + alasan satu kalimat di toast (US3) |

### 2.4 Warna

Keputusan pokok: warna kabel mengikuti fungsi penghantar seperti di lapangan (prinsip "senyata mungkin"), bukan satu warna per sistem. Pembeda DC/AC adalah bentuk terminal dan label, sehingga tetap terbaca oleh pengguna buta warna (US29).

| Peran | Warna | Heks |
|---|---|---|
| DC positif | merah | #DC2626 |
| DC negatif | hitam | #1F2937 |
| AC fasa (L) | cokelat | #92400E |
| AC netral (N) | biru | #2563EB |
| Pembumian (PE) | hijau bergaris kuning | #16A34A + #FACC15 |
| Merek, tombol utama, pilihan aktif | hijau toska | #0F766E |
| Latar aplikasi / latar meja / kartu | abu sangat muda / abu muda bertitik / putih | #F8FAFA / #EEF2F1 / #FFFFFF |
| Teks utama / teks sekunder | — | #111827 / #4B5563 |
| Kontrol netral (slider, garis) | abu | #6B7280 |

Warna kabel AC dan DC di atas perlu dicocokkan dengan PUIL/SNI yang dipakai di pelatihan [PERLU VERIFIKASI] (PUIL 2011 memakai hitam untuk fasa L1; standar IEC yang lebih baru memakai cokelat).

Status selalu berupa ikon + teks singkat + warna, tidak pernah warna saja:

| Status | Ikon | Warna |
|---|---|---|
| Normal / bekerja | centang | #0F766E |
| Peringatan (mendekati batas) | segitiga | #D97706 |
| Trip / proteksi bekerja | tuas turun | #6B7280 |
| Bahaya (korsleting, polaritas terbalik) | petir dalam segitiga, berdenyut | #B91C1C |
| Rusak | asap, gambar komponen menghitam | #111827 |

Karena merah juga dipakai untuk DC+, status bahaya wajib memakai ikon dan denyut, tidak boleh hanya garis merah.

### 2.5 Huruf dan target sentuh

- Huruf terkecil 12 px; teks biasa 14 px; angka alat ukur 20 px ke atas, tabular, bergaya LCD.
- Semua kontrol yang bisa diklik minimal 44x44 px dengan sela minimal 8 px; ibu jari slider 28 px dengan area sentuh 44 px.
- Tidak ada fungsi yang hanya lewat hover atau klik kanan (US25).
- Paragraf hanya muncul lewat tombol "?" (US27).

## 3. Hal yang belum bisa dinilai dari gambar

Tangkapan layar belum memuat: alat ukur (multimeter, tang ampere), MCB/saklar dengan keadaan buka-tutup, tampilan trip/asap/rusak, mode Praktik Terpandu dan Cari Gangguan, rangkaian AC, dan tampilan tablet. Bagian ini perlu prototipe dan kajian tersendiri sebelum Tahap 5 untuk fitur terkait.

## 4. Status penerapan (2026-10-12)

Keputusan §2 yang sudah diterapkan apa adanya tidak diulang di sini. Tabel ini hanya mencatat tambahan dan selisih antara keputusan §2 dan kode, supaya dokumen ini tidak menyesatkan. Riwayat rincinya ada di `docs/LOG_SESI.md`.

### 4.1 Tambahan yang belum ada di §2

| Hal | Penerapan |
|---|---|
| Indikator simulasi di komponen | Deret di atas nama komponen: LED bertanda (✓ normal, ! peringatan, × gangguan; berkedip saat mengisi) pada SCC dan inverter, cip LCD 14 px pada SCC (V dan A baterai serta PV), bar SoC dengan angka persen pada baterai, cip setelan daya pada beban |
| Tanda kondisi | Pojok kanan atas komponen: ikon + teks ≤ 6 huruf (TRIP, PUTUS, BMS, LVD, HVD, LEBIH, GALAT, DROP, RUSAK, N/A) dengan warna §2.4; komponen rusak berasap, gambarnya menghitam dan retak |
| Reset per komponen | Tombol kunci pas 44 px di kanan atas komponen (ganti fuse/komponen, reset BMS/beban lebih); MCB trip dipulihkan lewat tuasnya yang bertanda TRIP; kabel rusak punya tombol ganti di tengahnya |
| Arus kabel | Titik putih bergerak searah arus, kecepatan sebanding besar arus; berhenti saat simulasi dijeda; pendar jingga saat kabel terlalu panas |
| Alat ukur | Tiga tombol bergambar di kanan atas meja; panel alat di kanan bawah meja, tidak ikut zoom, angka LCD 30 px; probe dan jepitan diseret ke terminal/kabel atau diketuk lalu sasarannya diketuk |
| Temuan pemeriksaan | Segitiga 44 px di kiri bawah meja dengan jumlah temuan; daftar baru muncul saat diklik, penjelasan lewat tombol "?" per baris |
| Grafik 24 jam | Panel mengambang di atas bilah simulasi, dibuka dari tombol di bilah itu; daya (W) dan SoC (%) pada dua bidang bertumpuk |
| Inspektur | Gambar, nama, paling banyak empat rating utama (tanda besaran + angka 20 px), penjelasan per kategori lewat "?", slider daya untuk beban, tombol hapus 44 px; untuk MCB dan Panel Listrik deret tombol 44 px "Jenis" dan "Arus pengenal"; tombol "Atur parameter" (ikon penggeser, 44 px) mengganti kotak rating dengan isian per parameter: angka 20 px + satuan, "Default: …" di bawahnya, tombol kembalikan per parameter, dan "Kembalikan semua"; disimpan saat Enter atau pindah isian, Escape membatalkan, nilai tidak sah ditolak dengan pesan singkat. Rating yang diubah berlatar warna merek |
| Tanda parameter diubah | Ikon penggeser kecil warna merek di depan nama komponen di meja |
| Keluarga varian di baki | Satu ubin "MCB" (kelompok Proteksi) dan satu ubin "Panel Listrik" (busbar + Panel Beban, kelompok Distribusi); ubin menaruh varian pertama di katalog, nama di meja ikut varian terpilih |
| Warna terminal data | Ungu `#7C3AED` (belum ditetapkan di §2.4) [PERLU VERIFIKASI] |

### 4.2 Selisih terhadap §2

Per 2026-10-12 kode sudah disesuaikan dengan §2: inspektur hanya saat satu komponen terpilih (lembar bawah di bawah 1024 px), baki bisa dilipat menjadi rel ikon 64 px, reset percobaan di bilah atas, label terminal selalu tampak, area sentuh terminal 44 px di layar, gembok pada terminal penuh, centang pada komponen yang bekerja, dan legenda warna kabel. Tiga keputusan direvisi di tempatnya (§2.1 tab mode, §2.2 komponen tanpa kartu, §2.3 ukuran titik dan jarak terminal). Yang masih berbeda:

| Keputusan §2 | Di kode sekarang |
|---|---|
| §2.1 Empat tab mode di bilah atas | Belum ada; ditambahkan saat mode selain Rakit Bebas dibuat |
| §2.3 Area sentuh 44 px untuk tiap terminal | Terminal yang jaraknya di bawah 44 px berbagi ruang: tiap terminal mendapat area sampai garis tengah ke tetangganya (pada gambar terkecil sekitar 20 px lebar di zoom 100%); ke arah dalam area berhenti di inti badan komponen |
| §2.4 Centang untuk status normal | Hanya komponen yang sedang dialiri arus; SCC dan inverter memakai LED bertanda centang; komponen normal tanpa arus tidak diberi tanda |

### 4.3 Bagian §3 yang kini ada tampilannya

Alat ukur, MCB dengan tuas buka-tutup, tampilan trip/asap/rusak, dan rangkaian AC sudah diterapkan (§4.1) tetapi belum dikaji lewat uji pakai dengan peserta. Mode Praktik Terpandu, Cari Gangguan, dan tampilan tablet belum ada.
