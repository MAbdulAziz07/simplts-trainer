# Kunci Jawaban dan Catatan Instruktur — LKPD 1–7

Hasil simulasi SimPLTS pada kondisi lembar kerja; derau alat ukur ±0,5%. Jangan dibagikan kepada peserta.

## LKPD 1 — Mengenal Komponen, Terminal, dan Rating PLTS Off-Grid

- Tabel 1: 2 panel 100 Wp, 1 MCB DC 16A (PV), 1 SCC PWM 20A, 1 beban DC 12 V, 1 baterai VRLA AGM 100Ah, 1 fuse baterai 100A, busbar DC+, busbar DC−, busbar PE, 1 MCB DC 63A (inverter), 1 inverter 500W 12V, 1 MCB AC 6A, 1 beban AC 500 W, 1 elektroda pentanahan.
- Tabel 2: SCC: Vsis 12/24 V, Iisi 20 A, Ibeban 10 A, Voc maks 24/48 V. Baterai: Un 12 V, C 100 Ah, Iisi 30 A. Inverter: Pac 500 W, Vdc 12 V, Vac 220 V, LVD 10,5 V. Panel: Pmax 100 W, Voc 22 V, Isc 5,97 A, Vmp 18 V. MCB: In 16 A, Un 440 V, kurva C, Icu 10 kA.
- Tabel 4: merah = DC+, hitam = DC−, cokelat = fasa L, biru = netral N, hijau-kuning = pembumian PE.
- Pertanyaan 1: tegangan modul berubah mengikuti cahaya dan bisa jauh di atas tegangan kerja alat; modul harus disambung ke masukan PV SCC.
- Pertanyaan 2: 10 A; sekitar 120 W pada 12 V (10 A × 12 V).
- Pertanyaan 3: tidak. Voc seri = 2 × 22 V = 44 V > 24 V. SCC akan galat atau rusak (dibuktikan di LKPD 3).
- Pertanyaan 4: inverter memutus keluaran untuk melindungi baterai dan menyala lagi setelah tegangan naik di atas ambang sambung kembali (12,5 V).

## LKPD 2 — Karakteristik Modul Surya: Pengaruh Iradiasi dan Suhu

- Tabel 1 (perkiraan, berubah ±0,1 V karena derau alat): 1000 → 19,7 V; 800 → 20,0 V; 600 → 20,2 V; 400 → 20,3 V; 200 → 20,2 V.
- Tabel 2: 15 °C → 20,5 V; 25 °C → 19,8 V; 35 °C → 19,1 V; 45 °C → 18,4 V (turun ±0,7 V tiap 10 °C).
- Tabel 3: 1000 → 5,9 A, 14,1 V, ±83 W; 800 → 4,7 A, 14,0 V, ±66 W; 600 → 3,6 A, 13,9 V, ±50 W; 400 → 2,4 A, 13,9 V, ±33 W; 200 → 1,2 A, 13,9 V, ±16 W.
- Pertanyaan 1: arus turun hampir setengahnya (sebanding iradiasi).
- Pertanyaan 2: pada iradiasi tinggi suhu sel naik (model NOCT), sehingga Voc turun walaupun cahaya lebih kuat.
- Pertanyaan 3: Voc datasheet diukur pada suhu sel 25 °C; pada suhu udara 25 °C dan 1000 W/m² suhu sel sekitar 56 °C.
- Pertanyaan 4: SCC PWM menyambung panel ke baterai, sehingga tegangan panel ditarik mendekati tegangan baterai; daya yang diambil lebih kecil dari Pmax.
- Pertanyaan 5: arus.

## LKPD 3 — Rangkaian Seri dan Paralel Modul Surya

- Tabel 1: Voc satu panel ±19,8 V; seri ±39,4 V; temuan "Voc array melebihi batas masukan PV" (Bahaya); saat MCB ON, SCC rusak (tanda RUSAK, retak, LCD padam).
- Tabel 2: Voc paralel ±19,8 V; panel 1 ±5,85 A; panel 2 ±5,82 A; total ±11,7 A; LCD SCC PV ±14,2 V 11,7 A.
- Pertanyaan 1: Voc seri ≈ 2 × Voc satu panel. Pertanyaan 2: arus total = jumlah arus tiap panel.
- Pertanyaan 3: Voc seri 39 V melebihi batas 24 V. SCC MPPT dirancang untuk masukan tegangan tinggi dan menurunkannya ke tegangan baterai.
- Pertanyaan 4: Isc paralel 2 × 5,97 = 11,94 A. Faktor keamanan memperhitungkan iradiasi di atas 1000 W/m² dan arus kontinu; SimPLTS memberi temuan arus melebihi rating bila MCB terlalu kecil (pada LKPD 5 dipakai MCB 20 A).
- Pertanyaan 5: 2 modul (2 × 100 W = 200 W ≤ 240 W).

## LKPD 4 — Merangkai PLTS Off-Grid 12 V dengan Beban DC

- Tabel 1: tegangan baterai ±12,6 V; Voc di IN MCB ±19,9 V (< 24 V); temuan 0.
- Tabel 2 (810 W/m², 10:00): 100 W → LCD BAT ±12,5 V, PV ±12,8 V 4,8 A; tegangan beban ±12,5 V; arus ±8,6 A; daya ±107 W. 200 W → SCC menampilkan tanda LEBIH dan memutus beban.
- Pertanyaan 1: SCC mengenali tegangan sistem dari baterai; tanpa baterai, PV dapat membuat SCC salah membaca tegangan sistem.
- Pertanyaan 2: memastikan polaritas benar dan Voc di bawah batas sebelum energi masuk ke SCC.
- Pertanyaan 3: 200 W / 12 V ≈ 16,7 A > 10 A; SCC memutus terminal beban (proteksi beban lebih).
- Pertanyaan 4: matikan beban, OFF-kan MCB PV, lepas kabel PV dari SCC, lalu terakhir lepas baterai.
- Pertanyaan 5: sambung langsung ke busbar baterai melalui MCB/fuse yang sesuai, atau pakai beban AC melalui inverter.

## LKPD 5 — Inverter, Beban AC, dan Neraca Energi Harian

- Tabel 1: 100 W → V AC ±220 V, I AC ±0,46 A, I DC ±9,1 A. 300 W → V AC ±220 V, I AC ±1,37 A, I DC ±28,7 A (tanda minus pada tang ampere menunjukkan arah arus berlawanan dengan arah kabel).
- Tabel 2: SoC 80% pukul 10:00 relatif tetap pada siang hari (PV ≈ beban), turun sejak sore, inverter LVD sekitar pukul 22:20 dengan SoC rendah (±14%); inverter baru menyala lagi menjelang siang hari berikutnya setelah PV mengisi baterai dan tegangannya naik di atas 12,5 V (dapat sempat mati-nyala).
- Pertanyaan 1: P DC ≈ P AC; tegangan DC 12 V jauh lebih kecil daripada 220 V, jadi arusnya lebih besar (≈ 18×), ditambah rugi inverter dan konsumsi tanpa beban.
- Pertanyaan 2: efisiensi lebih baik pada beban lebih besar karena konsumsi tanpa beban (8 W) relatif kecil terhadap daya keluaran.
- Pertanyaan 3: LVD bekerja berdasarkan tegangan terminal, bukan SoC 0%; tujuannya mencegah baterai terkuras dalam.
- Pertanyaan 4: diisi sekitar 07:00–16:00, dikosongkan sore–malam; energi PV dua panel 100 Wp tidak cukup untuk 100 W × 24 jam (±2,4 kWh).
- Pertanyaan 5: contoh: tambah panel dan SCC berkapasitas lebih besar, tambah kapasitas baterai, kurangi daya/jam pemakaian beban.

## LKPD 6 — Penampang dan Panjang Kabel terhadap Jatuh Tegangan

- Tabel 1 (V baterai ±12,6 V): 2,5 mm² → V beban ±10,4 V; 4 → ±11,1 V; 6 → ±11,6 V; 10 → ±11,9 V. Arus ±14,5 A (2,5 mm²) sampai ±16,5 A (10 mm²).
- Tabel 2: 2 m → ±12,1 V; 5 m → ±11,3 V; 10 m → ±10,4 V; 20 m → ±8,9 V.
- Contoh hitung 2,5 mm², 10 m: R = 0,0175 × 20 ÷ 2,5 = 0,14 Ω; I ±14,5 A; ΔV ±2,0 V (ukur ±2,2 V).
- Pertanyaan 1: ΔV sebanding dengan panjang dan berbanding terbalik dengan penampang.
- Pertanyaan 2: tegangan beban turun sehingga daya P = V²/R turun.
- Pertanyaan 3: resistansi kontak sambungan, kenaikan suhu penghantar, dan derau alat ukur.
- Pertanyaan 4: ΔV ≤ 0,36 V → R ≤ 0,024 Ω → A ≥ 0,0175 × 20 ÷ 0,024 ≈ 14,6 mm² → pilih 16 mm².
- Pertanyaan 5: untuk daya sama, arus lebih kecil sehingga ΔV dan rugi daya kabel lebih kecil.

## LKPD 7 — Proteksi dan Pencarian Gangguan PLTS Off-Grid

- Tabel 1: arus ±8,7 A; In 16 A → normal (0,54 × In); In 4 A → 2,2 × In, trip ±5 menit simulasi (pukul ±10:05), arus 0 A; setelah dipulihkan beban menyala lagi.
- Tabel 2: Pemula menolak dengan pesan "Kutub + tidak disambung ke kutub −"; Mahir: sambungan diterima, SCC tidak menyala (LCD padam), temuan "Polaritas terbalik" (peringatan). Akibat ini mengikuti model SCC di katalog [PERLU VERIFIKASI per datasheet].
- Gangguan A: MCB inverter terpasang 16 A (seharusnya 63 A), beban AC 300 W → arus DC ±28 A → MCB trip setelah ±20 menit simulasi; temuan "Arus melebihi rating MCB". Perbaikan: ganti arus pengenal MCB ke 63 A.
- Gangguan B: kabel busbar–BAT SCC 2,5 mm² sepanjang 15 m; tegangan di terminal BAT SCC ±14,2 V, sedangkan di terminal baterai ±12,6 V (selisih ±1,6 V). SCC mengira baterai hampir penuh sehingga pengisian berkurang. Tidak ada temuan pemeriksaan. Perbaikan: perpendek kabel dan perbesar penampang (mis. 1 m, 10 mm²).
- Gangguan C: kabel − panel 2 ke busbar DC− PV tidak terpasang; arus PV ±5 A (normal ±10 A), arus pada kabel + panel 2 = 0 A. Tidak ada temuan pemeriksaan. Perbaikan: pasang kabel − panel 2 ke busbar DC− PV.
- Pertanyaan 1: MCB punya trip termis (bimetal, lambat, untuk beban lebih) dan trip magnetis (cepat, untuk hubung singkat).
- Pertanyaan 2: kabel bisa melewati KHA dan panas tanpa diputus; proteksi harus di atas arus kerja tetapi di bawah KHA kabel.
- Pertanyaan 3: Pemula mencegah kesalahan saat belajar merangkai; Mahir memperlihatkan akibat nyata untuk diagnosis.
- Pertanyaan 4: SCC mengukur tegangan di terminalnya sendiri; jatuh tegangan pada kabel saat mengisi membuat tegangan itu lebih tinggi daripada tegangan baterai sebenarnya.
- Pertanyaan 5: amati gejala → bandingkan dengan acuan normal → ukur bertahap dari sumber ke beban → buktikan penyebab → perbaiki → uji ulang dan catat.
