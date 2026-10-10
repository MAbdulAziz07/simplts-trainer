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
| Bilah atas | tinggi 56 px, lebar penuh | Logo + nama, pilihan paket, 4 tab mode (ikon + label), simpan / buka / reset |
| Baki komponen | lebar 216 px; rel ikon 64 px saat dilipat | Ubin 92x92 px, dua kolom, sela 8 px, tepi 12 px; judul kategori 44 px; gulir vertikal |
| Meja kerja | sisa ruang: 1150x640 px tanpa inspektur, 870x640 px dengan inspektur | Kisi 24 px, komponen menempel ke kisi; zoom 50–200%, awal 100%, tombol "paskan"; legenda dan status berupa cip mengambang di dalam meja |
| Inspektur | lebar 280 px, hanya muncul saat ada komponen terpilih | Isi tidak boleh terpotong pada tinggi 640 px; di bawah lebar 1024 px menjadi lembar bawah setinggi 40% layar |
| Bilah simulasi | tinggi 72 px, lebar penuh | Putar/jeda 48 px, kecepatan, waktu, iradiasi, awan; selalu terlihat |
| Toast | di tengah bawah meja, 16 px di atas bilah simulasi | Hilang sendiri setelah 3 detik; tidak menutupi terminal yang sedang dipakai |

### 2.2 Kartu komponen di meja

| Jenis | Ukuran | Contoh |
|---|---|---|
| Kecil | 144x144 px | MCB, fuse, SPD, beban lampu |
| Sedang | 192x168 px | Panel surya, baterai, kWh meter |
| Besar | 288x192 px | SCC, inverter, busbar/terminal distribusi |

- Isi kartu: gambar, nama (14 px, maksimal 3 kata), cip angka LCD, ikon status di pojok kanan atas. Kode seperti "PV · 01" tidak ditampilkan di kartu; cukup di inspektur.
- Kartu terpilih: garis tepi 3 px hijau toska. Kartu tidak boleh saling menimpa.

### 2.3 Terminal dan kabel

| Hal | Keputusan |
|---|---|
| Terminal tampak | 24 px |
| Area klik/sentuh terminal | 44 px, tetap 44 px di layar pada semua tingkat zoom |
| Jarak antarpusat terminal | minimal 48 px (dua kisi) |
| Bentuk terminal | DC bulat; AC persegi sudut tumpul; PE persegi dengan simbol pembumian |
| Label terminal | 12 px tebal, selalu tampak, di luar lingkaran |
| Tebal kabel | 3 px (≤ 2,5 mm²), 4 px (4–6 mm²), 6 px (≥ 10 mm²); area klik kabel 16 px |
| Kabel terpilih | lingkar cahaya 3 px hijau toska |
| Terminal tujuan sah saat menarik kabel | berdenyut; terminal lain meredup 40% |
| Terminal penuh | ikon gembok + alasan satu kalimat (US3) |

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
