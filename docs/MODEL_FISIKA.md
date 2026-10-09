# Model Fisika — Trainer Virtual PLTS (SimPLTS) v1

Status: draf untuk review. Sumber: `docs/PRD.md` dan tujuh berkas di `docs/datasheet/`. Belum ada kode; dokumen ini menjadi acuan isi `src/domain/` dan uji unitnya.

## 0. Cara membaca

**Kode asal angka** (kolom "Sumber" di semua tabel parameter):

| Kode | Arti |
|---|---|
| D | Diambil dari datasheet di `docs/datasheet/` (singkatan berkas di bawah) |
| U | Rumus/praktik umum (IEC, buku teks); tidak ada di datasheet. [PERLU VERIFIKASI] |
| A | Asumsi trainer (kalibrasi agar perilaku masuk akal). [PERLU VERIFIKASI] |

| Singkatan | Berkas (sheet) |
|---|---|
| DS-PV | `Datasheet_Panel_Surya_Update.xlsx` ("Datasheet PV", "Contoh REC") |
| DS-PWM | `Datasheet_SCC_PWM.xlsx` ("Datasheet RBL" = acuan utama; "Referensi BL915" hanya pembanding, jangan dipakai sebagai nilai RBL) |
| DS-MPPT | `Datasheet_SCC_MPPT_ID.xlsx` ("Spesifikasi", "Pengisian") |
| DS-BAT | `Datasheet_Battery.xlsx` (satu sheet per model) |
| DS-KBL | `Datasheet_Kabel_Tembaga.xlsx` ("Datasheet", "Perhitungan") |
| DS-MCB | `Datasheet_MCB_AC_DC.xlsx` ("MCB AC", "MCB DC") |
| DS-KWH | `Datasheet_kWh_Meter_EXIM.xlsx` |

**Tidak ada datasheet** untuk: inverter (off-grid, grid-tie, hibrida), fuse, SPD, busbar, beban, profil matahari. Bagian itu hanya berisi rentang umum (U/A) dan wajib diverifikasi sebelum masuk katalog.

**Konvensi.** Titik desimal dipakai di dokumen ini agar sama dengan JSON/kode. Satuan: V, A, W, Wh, Ah, Ω, °C, W/m², m, mm². Suhu sel `Tc`, suhu lingkungan `Ta`. Arus baterai `I > 0` = mengisi, `I < 0` = melepas. Nama di kode mengikuti AGENTS.md (`voltageV`, `currentA`, `irradianceWm2`, ...). Penulisan `abs(x)` berarti nilai mutlak.

**Urutan hitung tiap langkah waktu** (rinci di §12): profil matahari → suhu sel → kurva I-V panel → titik kerja jaringan DC → pembaruan keadaan (SoC, tahap pengisian, dosis termal proteksi, LVD/BMS, kWh meter) → cek kejadian trip.

**Peta ke PRD:**

| Cerita (PRD §5) | Bagian |
|---|---|
| US5, US6, US7, US16 | §1, §3 |
| US8, US10, US17 | §2, §3, §4 |
| US9, US18 | §4, §5 |
| US4 | §8 |
| US13, US15 | §9 |
| US23 | §6, §10 |

---

## 1. Modul PV

### 1.1 Parameter masukan (per model katalog)

| Simbol | Arti | Satuan | Rentang di katalog | Sumber |
|---|---|---|---|---|
| `Pmax` | Daya maksimum STC | Wp | 185–560 (REC 385–410). **Tidak ada 100 Wp dan 200 Wp** (lihat §13) | DS-PV baris 13 |
| `Vmp`, `Imp` | Titik daya maksimum STC | V, A | Vmp 15.1–42.25; Imp 7.96–13.26 (REC 41.2–42.7 V; 9.35–9.61 A) | DS-PV baris 14–15 |
| `Voc`, `Isc` | Rangkaian terbuka, hubung singkat STC | V, A | Voc 17.7–50.1; Isc 8.44–14.1 (REC 48.5–49 V; 10.18–10.35 A) | DS-PV baris 16–17 |
| `α` | Koefisien suhu Isc | 1/°C | +0.00034 … +0.00056 (REC +0.0004) | DS-PV baris 27 |
| `β` | Koefisien suhu Voc | 1/°C | −0.0024 (REC) … −0.0035 | DS-PV baris 26 |
| `γ` | Koefisien suhu Pmax | 1/°C | −0.0026 (REC) … −0.0048 | DS-PV baris 25 |
| `NOCT` | Suhu sel nominal (800 W/m², 20 °C, angin 1 m/s) | °C | 45–47 (REC NMOT 44) | DS-PV baris 23 |
| `Vsys_max` | Tegangan sistem maksimum | V DC | 1000 atau 1500 | DS-PV baris 30 |
| `Ifuse_max` | Rating fuse seri maksimum | A | 15, 20, 25 | DS-PV baris 32 |
| `Irev_max` | Arus balik maksimum | A | 16 (SW 240), 25 (REC); lainnya tidak tercantum | DS-PV baris 33 |
| `Tmin_op`, `Tmax_op` | Suhu operasi modul | °C | −40 … 85 (SW 240: 90) | DS-PV baris 28–29 |
| `Nbp` | Jumlah dioda bypass | buah | 3 (bila tercantum) | DS-PV baris 49 |
| `L` | Faktor log tegangan terhadap iradiasi (`≈ ln(Iph/I0)`) | – | 25 (rentang 20–30) | A; dikalibrasi §1.4 |
| `fmount` | Kenaikan suhu sel karena pemasangan | K | 0 (rak terbuka) … 15 (atap rapat) | A |
| `ε` | Mismatch daya antar-panel | – | 0 … +0.03 | D: toleransi daya 0–3%, 0/+5 W (DS-PV baris 21) |

Untuk model tanpa baris kinerja NOCT (mis. 240W-60P, JS185CB-48P, JS310CB-80P) tidak ada pembanding; pakai rumus di bawah.

### 1.2 Suhu sel

```
Tc = Ta + (NOCT - 20)/800 * G + fmount          (G dalam W/m²)
```
Rentang wajar Batam: `Ta` 22–36 °C, `Tc` 25–75 °C.

### 1.3 Koreksi iradiasi dan suhu

```
r  = G/1000          dT = Tc - 25          Vt' = (Voc_stc/L) * (Tc+273.15)/298.15

Isc(G,Tc) = Isc_stc * r * (1 + α*dT)
Imp(G,Tc) = Imp_stc * r * (1 + α*dT)
Voc(G,Tc) = Voc_stc * (1 + β*dT)       + Vt' * ln(r)
Vmp(G,Tc) = Vmp_stc * (1 + (γ-α)*dT)   + Vt' * ln(r)
```
- `Isc` dan `Imp` berbanding lurus iradiasi (US5).
- Suku `Vt'*ln(r)` menurunkan tegangan pada iradiasi rendah. Konstanta `L` menggantikan jumlah sel seri (jumlah sel di datasheet tidak sama dengan sel seri untuk modul half-cell).
- Koefisien `Vmp` = `γ − α` dipakai agar `Pmax(T)` mengikuti `γ` di datasheet, bukan `β`.
- Berlaku untuk G ≥ sekitar 50 W/m². Untuk G = 0 semua keluaran = 0.

### 1.4 Kurva I-V (model eksplisit C1/C2)

```
C2 = (Vmp/Voc - 1) / ln(1 - Imp/Isc)
C1 = (1 - Imp/Isc) * exp(-Vmp / (C2*Voc))

I(V) = Isc * [ 1 - C1*(exp(V/(C2*Voc)) - 1) ]        batas 0 <= I <= Isc
V(I) = C2*Voc * ln( 1 + (1 - I/Isc)/C1 )             (kebalikan; dipakai untuk string seri)
```
Nilai di atas memakai `Isc, Imp, Voc, Vmp` hasil §1.3 (kondisi G, Tc saat itu). Sifat: `I(0) = Isc`; `I(Vmp) = Imp` persis; `I(Voc)` ≈ 0 (≤ 0.001 A pada STC). Titik daya maksimum kurva ≤ 0.5% di atas `Pmax` datasheet (kurva tidak dipaksa maksimum tepat di `(Vmp, Imp)`).

Nilai wajar: `C2` 0.046–0.094; `C1` 1e-10 – 1e-5 (sangat kecil, jangan dibulatkan). Sumber: U (model koefisien dua parameter dari Isc, Voc, Imp, Vmp), parameter dari DS-PV.

**Validasi terhadap baris kinerja NOCT datasheet** (G = 800, Tc = NOCT, `L` = 25; perhitungan terpisah, bukan unit test aplikasi):

| Modul | Pmax model / datasheet (W) | Selisih | Voc model / datasheet (V) | Isc model / datasheet (A) |
|---|---|---|---|---|
| PV-MJT245GB | 174.0 / 177.0 | −1.7% | 33.98 / 33.80 | 7.04 / 7.04 |
| LR5-72HPH-540M | 397.5 / 403.6 | −1.5% | 46.41 / 46.54 | 11.19 / 11.20 |
| AE MD-120 440W | 323.1 / 331.0 | −2.4% | 38.68 / 38.80 | 10.87 / 10.78 |
| SW 240 poly | 170.5 / 174.2 | −2.1% | 34.19 / 33.70 | 6.80 / 6.80 |

Kesimpulan: galat Pmax −1.5…−2.4% (selalu sedikit rendah), Voc −0.3…+1.4%, Isc ≤ 0.9%. Pada G = 1000 dan Tc = 65 °C, Pmax model 200.5 W vs 196.8 W dari `γ` (+1.9%). Usul toleransi uji: Isc ±2%, Voc ±2%, Pmax ±3% [PERLU VERIFIKASI terhadap §8 PRD]. Toleransi NOCT datasheet sendiri ±2 °C setara ±0.9% daya.

### 1.5 Seri, paralel, dan titik kerja

- Modul identik: seri `Ns` → `Voc = Ns·Voc`, `Vmp = Ns·Vmp`, arus sama; paralel `Np` → `Isc = Np·Isc`, `Imp = Np·Imp`, tegangan sama.
- Umum (array `Np` string × `Ns` modul): untuk tegangan terminal `V`, tiap string dicari arus `Is` yang memenuhi `sum_i Vi(Is) = V` (pencarian bagi-dua; fungsi menurun monoton), lalu `I_array(V) = sum_s Is(V)`. Untuk modul identik: `I_array(V) = Np · I_mod(V/Ns)`.
- Alat ukur membaca **titik kerja** pada kurva gabungan, bukan nilai nominal (US7). Terminal terbuka → `V = Voc_array`; ampere meter seri tanpa beban → `I = Isc_array`.
- Titik daya maksimum array: pindai `V` dari 0 sampai `Voc_array` (≥ 400 titik), ambil maksimum global, haluskan di sekitarnya.
- **Arus balik** pada paralel: bila satu string rusak/terhubung singkat, arus balik = `(Np − 1)·Isc` pada string itu. Bila nilai ini melebihi `Ifuse_max` atau `Irev_max`, wajib fuse string. Contoh: 3 string 240W-60P → `(3−1)·8.56 = 17.1 A > 15 A` (DS-PV). `Np ≤ 2` tidak butuh fuse string.
- **Batas tegangan sistem**: `Ns · Voc(Tmin) ≤ Vsys_max` dan ≤ batas Voc SCC/inverter (§2, §3, §6).

### 1.6 Bayangan sederhana (per panel)

```
Geff = G * ( 1 - fsh*(1 - d) )        fsh: bagian luas yang teduh (0..1); d: fraksi difus
```
| Simbol | Arti | Rentang | Sumber |
|---|---|---|---|
| `fsh` | Luas panel yang teduh | 0–1 | A |
| `d` | Iradiasi sisa pada bagian teduh | 0.05–0.25 (awal 0.15) | A |
| `Vf` | Tegangan maju dioda bypass | 0.4–0.8 V (awal 0.6) | U |

Dioda bypass dimodelkan **per modul penuh**: bila arus string `> Isc` modul itu, tegangan modul = `−Vf` (hasil konservatif; modul nyata punya 3 dioda per sub-string, DS-PV baris 49). Panel teduh di paralel hanya menyumbang arus lebih kecil. Akibat: kurva P-V string bisa punya lebih dari satu puncak lokal, sehingga pencarian titik daya maksimum harus global.

Batas pendekatan (PRD §7): tidak ada bayangan per sel/sub-string, tidak ada arus balik titik panas.

### 1.7 Contoh hitung

**A. Satu panel 240W-60P, G = 800 W/m², Ta = 30 °C.** `Tc = 30 + (45−20)/800·800 = 55 °C`; `dT = 30`.
- `Isc = 8.56·0.8·(1 + 0.0005·30) = 6.951 A`; `Imp = 8.01·0.8·1.015 = 6.504 A`.
- `Vt' = 37.2/25 · (328.15/298.15) = 1.638 V`; `ln 0.8 = −0.2231` → suku koreksi −0.3655 V.
- `Voc = 37.2·(1 − 0.0027·30) − 0.3655 = 33.82 V`; `Vmp = 30·(1 + (−0.0045−0.0005)·30) − 0.3655 = 25.13 V`.
- `C2 = 0.09357`, `C1 = 2.28e-5`. Titik daya maksimum kurva: **166.0 W** pada 26.72 V, 6.21 A; `I(30 V) = 4.87 A`.
- Pemeriksaan: `240·0.8·(1 − 0.0045·30) = 166.1 W` ✔ (US5: `Isc(500)/Isc(1000) = 0.500`; US6: `Voc(65 °C)/Voc(25 °C) = 0.892 = 1 − 0.0027·40`).

**B. Bayangan.** String 2 seri JS310CB-80P (STC), satu modul 50% teduh → `Geff = 575 W/m²`, `Isc_teduh = 7.42 A`. Dua puncak lokal: **377.3 W** pada 52.2 V (7.22 A) dan 303.9 W pada 24.9 V (12.23 A); tanpa bayangan 622.5 W.

---

## 2. SCC PWM

### 2.1 Parameter (seri RBL)

| Simbol | Arti | Satuan | Nilai/rentang | Sumber |
|---|---|---|---|---|
| `Ichg_max` | Arus pengisian | A | 10, 20, 30, 40, 50, 60 | DS-PWM baris 6 |
| `Iload_max` | Arus beban | A | 10, 10, 10, 20, 30, 30 (sesuai urutan di atas) | DS-PWM baris 7 |
| `Ppv_max` | Daya PV maks, sistem 12 V / 24 V | W | RBL-20A: 240 / 480; RBL-10A: 120 / 240; RBL-60A: 780 / 1560 | DS-PWM baris 8–9 |
| `Voc_max` | Voc PV maksimum | V | 24 (sistem 12 V); 48 (sistem 24 V) | DS-PWM baris 14–15 |
| `Vabs` | Equalization/absorption: sealed / gel / flooded | V (basis 12 V) | 14.4 / 14.2 / 14.6 | DS-PWM baris 17–19 |
| `Vfloat` | Float | V (basis 12 V) | 13.7 (dapat diatur) | DS-PWM baris 20 |
| `Vrecharge` | Pengisian kembali | V (basis 12 V) | 13.0 | DS-PWM baris 23 |
| `Vlvd`, `Vlvr` | Pemutusan / penyambungan kembali beban | V (basis 12 V) | 10.7 / 12.6 (dapat diatur) | DS-PWM baris 21–22 |
| `Iself` | Konsumsi internal | mA | < 10 | DS-PWM baris 26 |
| `Vsw` | Jatuh tegangan sakelar/dioda | V | 0.2–0.5 (awal 0.3) | A |
| `tabs` | Lama absorption | menit | 60–180 (awal 120) | A |
| Skala sistem 24 V | Semua ambang tegangan × 2 | – | nilai 24 V "tidak dirinci" di datasheet | A |

Proteksi yang disebut datasheet: hubung singkat, sirkuit terbuka, polaritas terbalik, beban lebih, arus balik. Urutan pemasangan: baterai → PV → beban; deteksi 12/24 V otomatis (DS-PWM baris 32–33, 13).

### 2.2 Model

```
Vpv      = Vbat_terminal + Vsw                      (PV "ditarik" ke tegangan baterai)
Ichg     = min( I_array(Vpv), Ichg_max, Iaccept )   Iaccept: penerimaan baterai (§4.3)
Pharvest = Vbat * Ichg                              (daya yang benar-benar masuk)
Pmismatch = P_mpp_array - (Vpv * Ichg)              (ditampilkan untuk perbandingan PWM vs MPPT)
```
- Bulk: sakelar menyala penuh; `Ichg = min(I_array(Vpv), Ichg_max)`. Bila arus array melebihi `Ichg_max`, kelebihan daya tidak dipanen.
- Absorption: `Vbat` ditahan di `Vabs`; arus mengikuti penerimaan baterai (turun, US10).
- Float: `Vbat` ditahan di `Vfloat`.
- Transisi: bulk → absorption saat `Vbat ≥ Vabs`; absorption → float setelah `tabs`; float → bulk saat `Vbat < Vrecharge`.
- Konsumsi sendiri `Iself·Vbat` ≈ 0.13 W (diabaikan boleh).
- Kompensasi suhu hanya bila model SCC punya sensor (datasheet RBL tidak mencantumkan) → default tanpa kompensasi.

### 2.3 Batas dan akibat (data model, bukan selalu rusak)

| Kondisi | Akibat | Sumber |
|---|---|---|
| `Voc_array(Tmin) ≤ Voc_max` | Normal | D |
| `Voc_max < Voc ≤ 1.2·Voc_max` | Galat "tegangan PV tinggi", tidak mengisi | A |
| `Voc > 1.2·Voc_max` | Rusak (asap) | A |
| PV atau baterai terbalik | Tidak rusak, indikator galat, tanpa arus (proteksi polaritas) | D (proteksi ada), A (mekanisme) |
| `Iload > Iload_max` | Beban diputus: 1.25× → 60 s, 1.5× → 5 s | A |
| `Vbat ≤ Vlvd` | Beban diputus; tersambung lagi di `Vlvr` | D |
| PV dipasang sebelum baterai | Deteksi tegangan salah (Voc PV dibaca sebagai 24 V bila > 16 V) → `Vabs` terlalu tinggi | A (US17) |

### 2.4 Contoh hitung

Dua panel JS185CB-48P paralel (370 Wp; Voc 17.7 V ≤ 24 V) pada RBL-20A, G = 800, Ta = 30 → `Tc = 55 °C`. Per panel: `Isc = 10.64 A`, `Vmp = 13.07 V`, daya maks 130.7 W (13.24 V; 9.87 A). Baterai 12 V mengisi pada `Vbat = 12.6 V` → `Vpv = 12.9 V` → `I_array = 2·10.09 = 20.17 A` → `Ichg = min(20.17, 20) = 20.00 A` → `Pharvest = 252 W` vs daya maks array 261.3 W (96%). Pada `Vbat = 14.4 V` (absorption): `I_array = 14.89 A`, 214.4 W (82%). Satu panel pada STC dengan baterai 12.7 V (PV ditarik ke 13.0 V): 165.3 W vs 185.7 W (89%) — panel dingin (Vmp 15.1 V) menjauhi tegangan baterai.

Salah rangkai yang harus terlihat: panel 240W-60P (Voc 37.2 V) pada RBL 12 V melampaui 24 V → galat/rusak (§2.3).

---

## 3. SCC MPPT

### 3.1 Parameter (DS-MPPT, sheet "Spesifikasi" dan "Pengisian")

| Model | Vbat | Jendela MPPT (V) | Voc maks (V) | Ppv maks (W) | Iin maks (A) | Ichg maks (A) | Deteksi otomatis | BTS |
|---|---|---|---|---|---|---|---|---|
| 300W/12V | 12 | 15–37 | 50 | 300 | 18 | 25 | Tidak | Tidak |
| 600W/12V | 12 | 15–33 | 50 | 300 | 18 | 25 | Ya | Tidak |
| 600W/24V | 24 | 30–66 | 75 | 600 | 18 | 25 | Ya | Tidak |
| 850W/36V | 36 | 45–88 | 98 | 850 | 17 | 20 | Tidak | Tidak |
| 3KW/12V | 12 | 60–115 | 145 | 800 | 50 | 60 | Ya | Ya |
| 3KW/24V | 24 | 60–115 | 145 | 1600 | 50 | 60 | Ya | Ya |
| 3KW/48V | 48 | 60–115 | 145 | 3200 | 50 | 60 | Ya | Ya |

Umum (D): efisiensi maksimum 0.98; konsumsi standby 2 W (300/600 W); alarm baterai rendah 10.5 V (12 V) / 21 V (24 V); PV mulai bekerja bila lebih tinggi dari baterai ≥ 5 V; tiga tahap (bulk, absorption, float); baterai harus terhubung agar pengisi bekerja; proteksi polaritas terbalik PV/baterai, pengisian berlebih, beban berlebih; suhu operasi −20…55 °C (3KW: 0…55). **Tidak ada model 40 A** (lihat §13).

| Simbol | Arti | Nilai/rentang | Sumber |
|---|---|---|---|
| `Vbulk` | Tegangan bulk/absorption, semua jenis baterai | 14.3 V (12 V); 28.6 V (24 V) | D (sheet "Pengisian") |
| `Vfloat` | Vented / Sealed / Gel / NiCd | 13.2 / 13.4 / 13.7 / 14.0 V (24 V: ×2) | D |
| `ΔVstart` | Selisih PV−baterai untuk mulai | 5 V | D (300/600 W); 3KW: A |
| `ηmax` | Efisiensi puncak | 0.98 | D |
| `ηtrk` | Efisiensi pelacakan | 0.99 (0.97–0.995) | U |
| `Pfix` | Rugi tetap | 2 W | D (standby) |
| `tabs` | Lama absorption | 60–180 menit (awal 120) | A (tidak ada di datasheet) |
| Skala 36/48 V | Tegangan 36/48 V tidak dirinci | × 3 / × 4 dari basis 12 V | A |

### 3.2 Model

```
Mulai bila: baterai terhubung  dan  Voc_array >= Vbat + dVstart  dan  Voc_array >= Vmppt_min

Pmpp  = max_{V in [Vmppt_min, min(Vmppt_max, Voc)]}  V*I_array(V)   dengan  I_array(V) <= Iin_max
Pin   = ηtrk * min(Pmpp, Ppv_max)           (di atas Ppv_max titik kerja digeser, bukan dirusak [PERLU VERIFIKASI])
Pout  = ηmax * Pin - Pfix
Iout  = Pout / Vbat      -> bila Iout > Ichg_max:  Iout = Ichg_max,  Pin = (Ichg_max*Vbat + Pfix)/ηmax
```
- Hanya titik kerja di dalam jendela MPPT yang dicari; puncak di luar jendela diabaikan (contoh bayangan §1.7 B: puncak 24.9 V di bawah jendela 30 V pada 600W/24V).
- Tahap pengisian sama dengan §4.3 (bulk → absorption → float) dengan `Vbulk`/`Vfloat` di tabel.
- Pembatasan oleh arus keluaran atau baterai penuh dinyatakan di layar sebagai sebab selisih terhadap PWM (US8).

### 3.3 Batas Voc pada suhu terendah (US16)

```
Voc_cold = Ns * Voc_stc * (1 + β*(Tmin - 25))        Tmin awal = 20 °C (Batam, bisa diatur 15–25)
```
Akibat (data model): `Voc_cold ≤ batas` → normal; `batas < Voc_cold ≤ 1.1·batas` → galat tegangan lebih, tidak mengisi; `> 1.1·batas` → rusak [A]. Peringatan ditampilkan **sebelum** energisasi.

### 3.4 Contoh hitung

- **Normal.** 2 seri JS310CB-80P pada 600W/24V (620 Wp), G = 800, Ta = 30 (`Tc` 55 °C): per modul 219.5 W (22.37 V; 9.81 A) → string `Pin = 438.9 W` pada 44.7 V (dalam jendela 30–66 V), `Iin = 9.81 A ≤ 18 A`. `Pout = 0.98·438.9 − 2 = 428.1 W`; pada `Vbat = 26.0 V` → `Iout = 16.5 A ≤ 25 A`. `Voc_cold` (15 °C) = 60.8 V < 75 V ✔. Pada STC `Pmpp` = 622 W > 600 W → dibatasi `Ppv_max`.
- **Salah rangkai (US16).** 2 seri 240W-60P pada 600W/24V: `Voc_cold` (20 °C) = `2·37.2·(1 + 0.0027·5) = 75.4 V` > 75 V → peringatan sebelum energisasi.

---

## 4. Baterai

### 4.1 Parameter

**VRLA** (Aokly 6-FM-7/12/20, FirstPower LFP-seri 6–12 V, Tianneng TNE gel):

| Simbol | Arti | Satuan | Rentang | Sumber |
|---|---|---|---|---|
| `Vnom` | Tegangan nominal | V | 6, 8, 12 | DS-BAT |
| `Cn` | Kapasitas nominal | Ah | 7–300 (Aokly: C20, 1.75 V/sel, 25 °C; TNE: C20, 1.80 V/sel) | DS-BAT |
| `Rfull` | Resistansi internal penuh | mΩ | 100 Ah 12 V: 4.0–4.5; 35–150 Ah: 3.2–9; 7–20 Ah: 13–25 (≈ 0.18–0.45 Ω·Ah / `Cn`) | DS-BAT (LFP12100 = 4.5; 6-FM-20 = 13) |
| `Vfloat` | Float | V/sel | 2.25–2.30 (12 V: 13.5–13.8) | DS-BAT (Aokly) |
| `Vcycle` | Cycle/equalization | V/sel | 2.40–2.45 (12 V: 14.4–14.7) | DS-BAT (Aokly) |
| `kT` | Koefisien suhu tegangan: float / equalization / cycle | mV/°C/sel | −3 / −4 / −5 (diasumsikan per sel) | DS-BAT (Aokly); "per sel" A |
| `Ichg_max` | Arus pengisian maksimum | A | 0.3·`Cn` (3.6 A pada 12 Ah; 6 A pada 20 Ah; 2.1 A pada 7 Ah) | DS-BAT (Aokly) |
| `fT` | Kapasitas 40 / 25 / 0 °C | % | 105 / 100 / 86 | DS-BAT (Aokly) |
| Suhu | Isi 0–40 °C; lepas −20…55 °C | °C | | DS-BAT (Aokly) |
| Self-discharge | Pelepasan sendiri | %/bulan | ≤ 3 | DS-BAT |
| Umur | Float 10–12 tahun; siklus gel 400–600 pada 100% DoD | | | DS-BAT (Aokly, FirstPower, TNE) |
| `k` | Eksponen Peukert | – | 1.2 (1.1–1.3); 1.4 untuk laju < 1 jam | A; kalibrasi dari tabel discharge Aokly |

Baterai 100 Ah 12 V pada paket Minimum: FirstPower LFP12100 (hanya `Rfull` = 4.5 mΩ yang tercantum; tidak ada kurva isi/lepas) atau Tianneng TNE12-100 (C20 100 Ah; C5 85 Ah; C2/C3 80 Ah). Parameter pengisian VRLA diambil dari Aokly (V/sel) dan dianggap berlaku umum [PERLU VERIFIKASI].

**LiFePO4** (Victron LFP-Smart 12.8/25.6 V, Tiger MBL48-100CP 51.2 V, BatterySpace 12.8 V 32 Ah):

| Simbol | Arti | Satuan | Rentang | Sumber |
|---|---|---|---|---|
| `Vnom` | Tegangan nominal | V | 12.8 (4S), 25.6 (8S), 51.2 (16S) | DS-BAT |
| `Cn` | Kapasitas | Ah | 32–330 (24 V: 100, 200; 48 V: 100) | DS-BAT |
| `Rint` | Resistansi internal | mΩ | 0.8–2 (Victron); ≤ 10 (MBL48); ≤ 40 (32 Ah) | DS-BAT |
| `Vcv` | Tegangan charge (CC/CV) | V | 12.8 V: 14.0–14.4 (anjuran 14.2); 25.6 V: 28–28.8 (anjuran 28.4); 51.2 V: 58.4 ±0.2; 32 Ah: 14.6 ±0.2 | DS-BAT |
| `Vfloat` | Float | V | 13.5 (12.8 V); 27 (25.6 V) | DS-BAT (Victron) |
| `Itail` | Akhir CV | – | 0.02 C | DS-BAT (MBL48, BatterySpace) |
| `Ichg` | Arus charge standar / maksimum | A | 0.3–0.5 C / 1–2 C (Victron 25.6-100: anjuran 50, maks 200; MBL48: 50 / 100) | DS-BAT |
| `Idis` | Arus discharge kontinu / pulsa | A | Victron 25.6-100: 100 (anjuran) / 200; MBL48: 50 / 100, pulsa 300 A < 3 s | DS-BAT |
| `Vcut` | Cut-off discharge | V/sel | 2.8 (Victron), 2.5 (MBL48), 2.0 (32 Ah) | DS-BAT |
| Suhu | Charge 0–45 (MBL48, 32 Ah) atau 5–50 °C (Victron); discharge −20…50/60 °C | °C | | DS-BAT |
| `fT` | Kapasitas 0 °C / −20 °C | % | 80 / 50 (Victron) | DS-BAT |
| Efisiensi | Charge 100% (0.5C); discharge 96–99% (1C); round trip 92% (Victron) | – | | DS-BAT |
| Siklus | > 2000 @ 100% DoD (32 Ah); 2500 @ 80% (Victron); > 3500 @ 70% (MBL48) | | | DS-BAT |
| BMS | Victron: **BMS eksternal wajib**; MBL48: BMS internal (keterangan "4S/4P" ambigu pada sumber) | | | DS-BAT |

### 4.2 Tegangan terminal

OCV terhadap SoC (keadaan istirahat; **tidak ada di datasheet**, [PERLU VERIFIKASI] dengan data produsen):

| SoC | 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| VRLA 12 V (V) | 11.60 | 11.80 | 11.95 | 12.05 | 12.20 | 12.30 | 12.40 | 12.50 | 12.65 | 12.75 | 12.85 |

LiFePO4 per sel (kalikan jumlah sel seri): SoC 0 → 2.80; 0.05 → 3.00; 0.10 → 3.20; 0.20 → 3.25; 0.30 → 3.27; 0.50 → 3.29; 0.70 → 3.31; 0.90 → 3.34; 0.95 → 3.38; 1.00 → 3.40 V [A]. Kurva datar → tegangan tidak bisa dipakai menaksir SoC LiFePO4.

```
Melepas (VRLA):  V = OCV(SoC) - abs(I)*(R(SoC)+Rkabel) - Kk*exp(-SoC/s0)
                 R(SoC) = Rfull*(1 + 1.5*(1-SoC))       Kk = 2.0 V (12 V; skala N/6), s0 = 0.05
Melepas (LFP):   V = OCV(SoC) - abs(I)*Rint
Mengisi:         V = OCV(SoC) + ΔVover(SoC) + I*Rchg     Rchg = 3*R(SoC) (VRLA), Rint (LFP)
Beban daya konstan P (inverter):  R*I^2 - OCV*I + P = 0  ->  I = (OCV - sqrt(OCV^2 - 4*R*P)) / (2*R)
                 diskriminan < 0  -> daya tidak tersedia (tegangan runtuh, inverter mati)
```
- Suku `Kk·exp(−SoC/s0)` membuat tegangan runtuh di ujung pengosongan, sehingga LVD terlampaui **sebelum SoC 0%**, makin awal pada beban berat (US9).
- `ΔVover` (VRLA 12 V) [A, kalibrasi]: 0.30 V sampai SoC 0.5; 0.60 V pada 0.75; 1.30 V pada 0.90; 1.60 V pada 1.00. Dengan nilai ini tahap bulk berakhir (tegangan mencapai `Vabs`) di SoC 0.88–0.92 pada 0.2–0.3 C. LFP: 0.05 V sampai SoC 0.90; 0.12 pada 0.95; 0.20 pada 0.98; 0.25 pada 1.00 (per sel) → 3.65 V/sel baru tercapai mendekati SoC 1.0, sehingga tahap CV singkat.
- Koreksi suhu tegangan isi VRLA: `ΔV = kT · Nsel · (Tbat − 25)`. Contoh pada 35 °C, 12 V: float 13.7 → 13.52 V; cycle 14.4 → 14.10 V. SCC tanpa sensor suhu (PWM RBL, MPPT non-3KW) tidak mengoreksi → beri peringatan bila `Tbat` jauh dari 25 °C.

### 4.3 Keadaan: SoC, kapasitas, penerimaan

```
Ceff(T) = Cn * fT(T)                      (interpolasi linier pada titik di tabel; di luar rentang, ekstrapolasi 0.0056/°C)
Melepas:  Ieff = abs(I)*(abs(I)/Iref)^(k-1)   Iref = Cn/20 (VRLA);  k = 1.0 untuk LFP
          SoC <- SoC - Ieff*dt/(3600*Ceff)
Mengisi:  SoC <- SoC + ηc(SoC)*I*dt/(3600*Ceff)          (maks 1.0)
          ηc VRLA = 0.95 sampai SoC 0.8, turun linier ke 0.70 pada SoC 1.0;  ηc LFP = 0.96 (0.95–1.00)
Penerimaan: Iaccept = a*Cn*(1-SoC)       a = 1.0 /jam (VRLA, 0.5–2);  a = 5 /jam (LFP, 3–8)
Swa-lepas: SoC <- SoC - 0.001*dt/86400   (VRLA ≈ 0.1%/hari, ≤ 3%/bulan; LFP sama)
```
- `ηc` LFP 0.96 menghasilkan round-trip sekitar 0.92–0.96, sesuai "efisiensi round trip 92%" Victron. Nilai 1.00 pada datasheet MBL48 diperlakukan sebagai batas atas.
- VRLA: tahap absorption berakhir saat `Iaccept < 0.02·Cn` (SoC ≥ 0.98) atau `tabs`; dari SoC 0.90 ke 0.98 butuh sekitar 2 jam (`ηc` rata-rata ≈ 0.8).
- **Validasi Peukert** terhadap tabel discharge Aokly 6-FM-20 (cut-off 10.5 V; `k` = 1.2): kapasitas model/datasheet pada laju 20 jam 20.0/20.0 Ah; 10 jam 17.7/18.6 (−5%); 5 jam 15.7/17.0 (−8%); 2 jam 13.6/13.8 (−2%); 1 jam 12.3/11.5 (+7%); 30 menit 11.2/9.2 (+21%). Pakai toleransi ±10% hanya untuk laju ≥ 1 jam; di atas 1 C model terlalu optimis. Kecocokan lain: 47.9 A pada 100 Ah → model 1.33 jam (SoC 100 → 0), skala tabel Aokly 1.28 jam.

### 4.4 Profil pengisian

- **VRLA:** bulk (arus dibatasi SCC/PV/`Ichg_max`) → absorption pada `Vabs` → float pada `Vfloat`; kembali ke bulk bila `Vbat < Vrecharge`.
- **LFP:** CC sampai `Vcv`, lalu CV sampai `Itail`. Tidak ada float aktif di banyak model; nilai float pada tabel dipakai bila SCC memilikinya.
- Baterai dipasang paralel: bila tegangan tidak sama, arus penyama = `ΔV / (R1 + R2 + Rkabel)` (gangguan skenario).

### 4.5 Batas BMS (LiFePO4)

| Perlindungan | Ambang | Aksi | Sumber |
|---|---|---|---|
| Tegangan lebih | `Vcv` + 0.2 V (mis. 58.6 V pada 51.2 V) | Putus charge | D (MBL48: 58.4 ±0.2) |
| Tegangan kurang | `Vcut` per sel × N | Putus discharge; pulih saat charger tersambung/reset | D |
| Arus lebih discharge | `> Idis_max` lebih dari 10 s (pulsa ≤ `Ipulse` < 3 s) | Putus; indikator | D (nilai arus), A (waktu) |
| Hubung singkat | `> 3·Idis_max` | Putus dalam 1 ms, kunci sampai beban dilepas | A |
| Suhu | Charge di luar 0–45 °C (5–50 °C Victron) | Blok charge | D |

Konsekuensi untuk US13: pada baterai dengan BMS, hubung singkat memutus lewat BMS terlebih dulu, tidak lewat MCB. Pada VRLA tanpa BMS, hubung singkat baterai hanya terhenti oleh MCB/fuse.

### 4.6 SoC yang ditampilkan (PRD US9)

Tiga angka terpisah: (1) **SoC sebenarnya** (keadaan model); (2) **SoC taksiran** (penghitung coulomb dengan galat awal ±5% dan koreksi ke 100% di akhir absorption/CV); (3) **batas pemakaian latihan**: VRLA DoD 50%, LFP DoD 80% [A; Victron 2500 siklus pada 80% DoD, TNE 400–600 siklus pada 100% DoD]. Proteksi perangkat (LVD, BMS) adalah kejadian ke-4 dan tidak bergantung pada ketiganya.

### 4.7 Contoh hitung

**VRLA 100 Ah (R penuh 4.5 mΩ), beban inverter 500 W, SoC 0.50, kabel 1 m / 25 mm².**
- `OCV = 12.30 V`; `R(0.5) = 4.5·(1 + 0.75) = 7.9 mΩ`; kabel pergi-pulang `0.0175·2·1/25 = 1.4 mΩ` → `R = 9.3 mΩ`.
- Daya DC masukan inverter 568.2 W (§5.3). `I = (12.30 − √(12.30² − 4·0.0093·568.2)) / (2·0.0093) = 47.9 A`; `V = 12.30 − 47.9·0.0093 = 11.86 V`.
- Peukert: `Iref = 5 A`, `Ieff = 47.9·(47.9/5)^0.2 = 75.3 A` → penurunan SoC 12.5% per 10 menit (SoC 0.50 → sekitar 0.375).
- LVD 10.5 V pada beban ini tercapai di **SoC sekitar 0.06** (beban 100 W: 0.03; 1000 W: 0.11) — bukan 0 (US9).

**LiFePO4 25.6 V 100 Ah (Victron), isi CC 50 A dari SoC 0.20:** `dSoC/dt = 0.96·50/100 = 0.48 /jam` → mencapai SoC 0.95 dalam 1.56 jam, lalu CV pada 28.4 V sampai arus < 2 A.

---

## 5. Inverter off-grid

Tidak ada datasheet. Semua parameter U/A; ganti dengan datasheet model terpilih sebelum masuk katalog.

### 5.1 Parameter

| Simbol | Arti | Satuan | Rentang wajar | Sumber |
|---|---|---|---|---|
| `Pr` | Daya kontinu | W | 500 (12 V), 1500 (24 V) pada paket | PRD §2 |
| `P0` | Konsumsi tanpa beban | W | 1–3% `Pr` (500 W: 5–15; 1.5 kW: 15–30; 5 kW: 40–80) | A |
| `η50`, `η100` | Efisiensi pada 50% / 100% beban | – | 0.88–0.94 / 0.85–0.92 | A |
| `Psurge` | Lonjakan (≤ 5 s) | × `Pr` | 2–3 | U |
| `Vlvd` | Putus tegangan rendah | V (12 V) | 10.0–10.8 (awal 10.5) | A; analog DS-PWM: pemutusan beban 10.7 V |
| `Vlvr` | Sambung kembali | V (12 V) | 12.0–13.0 (awal 12.5), histeresis ≥ 1.5 V | A; DS-PWM: 12.6 V |
| `Valarm` | Alarm tegangan rendah | V (12 V) | 10.8–11.5 (awal 11.0) | A; DS-MPPT: alarm 10.5 V |
| `Vhvd` | Putus tegangan tinggi | V (12 V) | 15.0–16.0 | A |
| `tlvd` | Tunda LVD (abaikan sag singkat) | s | 5–30 (awal 10) | A |
| `Vac` | Tegangan keluaran | V | 220–240 (awal 230 ±3%); PLN nominal 220 V | U [PERLU VERIFIKASI] |
| Skala | 24 V ×2; 48 V ×4 untuk semua ambang tegangan DC | – | | A |

### 5.2 Efisiensi terhadap beban

```
Pin = Pout + P0 + k1*Pout + k2*Pout^2          (Pout > 0)        Pin = P0 saat idle
η   = Pout / Pin
Penyelesaian k1, k2 dari η50, η100:
   a = Pr/η100 - Pr - P0         b = (Pr/2)/η50 - Pr/2 - P0
   k2 = (a - 2b) / (Pr^2/2)       k1 = (b - k2*Pr^2/4) / (Pr/2)
```
| Model | `P0` | `η50` | `η100` | `k1` | `k2` (1/W) | η pada 5% / 10% / 25% / 100% beban |
|---|---|---|---|---|---|---|
| 500 W | 8 | 0.90 | 0.88 | 0.0379 | 1.650e-4 | 0.73 / 0.83 / 0.89 / 0.88 |
| 1.5 kW | 20 | 0.92 | 0.90 | 0.0228 | 5.00e-5 | 0.77 / 0.86 / 0.91 / 0.90 |
| 5 kW | 50 | 0.93 | 0.91 | 0.0216 | 1.345e-5 | 0.82 / 0.89 / 0.93 / 0.91 |

Arus DC: `IDC = Pin / VDC`, `VDC` dari baterai dan kabel (§4.2, daya konstan).

### 5.3 Perilaku dan proteksi

- **Beban lebih** (waktu sampai mati, interpolasi log-log, [A]): `P/Pr` 1.00–1.10: 600 s; 1.25: 60 s; 1.50: 10 s; 2.0: 1 s; ≥ `Psurge`: 0.1 s. Di bawah 1.00 kontinu. Mati terkunci; hidup lagi lewat reset (PRD §3.2).
- **LVD berbasis tegangan terminal** dengan histeresis (US9): `V < Vlvd` terus-menerus selama `tlvd` → mati; hidup lagi saat `V ≥ Vlvr`. Beban di bawah rating tetap bisa mati karena LVD.
- **HVD**, polaritas terbalik: tanpa fuse/dioda internal, inverter rusak [A]; fuse tidak dijamin melindungi elektronik (US15).
- Beban AC resistif: `P = Vac²/R`; `Vac` diukur dengan meter V AC (0 saat mati).
- Inverter harus ke busbar/baterai, **bukan** ke terminal beban SCC (`Iload_max` 10 A pada RBL-20A, §2).

### 5.4 Contoh hitung

Inverter 500 W dengan beban 500 W (paket Minimum): `Pin = 500 + 8 + 0.0379·500 + 1.65e-4·500² = 568.2 W` → `η = 0.880`. Pada beban 100 W: `Pin = 113.4 W`, `η = 0.882`; pada 25 W: `η = 0.734` (tanpa beban: 8 W). `I` dan `V` pada baterai: lihat §4.7.

---

## 6. Inverter grid-tie

Tidak ada datasheet (R3). Parameter U/A.

### 6.1 Parameter

| Simbol | Arti | Satuan | Rentang wajar | Sumber |
|---|---|---|---|---|
| `Pac_r` | Daya AC terukur | W | 1000 pada paket Rek. B | PRD §2 |
| `Vdc_start` | Tegangan mulai | V | 80–120 | A |
| `Vmppt` | Jendela MPPT | V | batas bawah 50–100, batas atas 350–450 | A |
| `Vdc_max` | Voc maksimum masukan | V | 400–500 | A |
| `Idc_max` | Arus masukan | A | 10–12 | A |
| `ηpeak` | Efisiensi puncak | – | 0.95–0.97 | A |
| `P0` | Rugi tanpa beban (RUN) | W | 2–5 | A |
| `Pstandby` | Konsumsi malam | W | 0.5–3 | A |
| `Pdc_max` | Daya DC maksimum yang diterima | × `Pac_r` | 1.2–1.5 (kelebihan dipotong dengan menggeser titik kerja) | A |
| `Vgrid` | Jendela tegangan jaringan | – | 0.85–1.10 × `Vnom` (IEC 61727) | U [PERLU VERIFIKASI] |
| `fgrid` | Jendela frekuensi | Hz | 50 ±1 (IEC 61727) | U [PERLU VERIFIKASI] |
| `tai` | Waktu putus anti-islanding | s | ≤ 2 (IEC 62116; PRD US23) | U [PERLU VERIFIKASI] |
| `trecon` | Tunda sambung kembali | s | 60 (rentang 20–300; IEC 61727: 180) | U/A |

### 6.2 Model

- Mesin status: `OFF` → (syarat mulai: `Vdc ≥ Vdc_start`, jaringan OK) → `TUNGGU trecon` → `RUN` → bila jaringan keluar jendela atau hilang → `OFF` dalam `≤ tai`.
- **Jaringan wajib ada** (anti-islanding): tanpa tegangan jaringan, `Pac = 0` walau PV penuh. Resambung setelah jaringan stabil selama `trecon`.
- RUN: `Pdc = min(Pmpp dalam jendela, Pdc_max)`; `Pac = min(Pac_r, Pdc − (P0 + k1·Pdc + k2·Pdc²))`. Bentuk rugi sama dengan §5.2 (fit dari `ηpeak` dan `P0`).
- `Voc_cold > Vdc_max` → rusak; `Voc` < `Vdc_start` → diam.
- Daya mengalir ke beban dulu, selebihnya diekspor (`Pgrid = Pload − Pac`; negatif = ekspor).

### 6.3 Contoh hitung

4 seri 240W-60P, G = 800, Ta = 30 (`Tc` 55 °C): per panel 166.0 W (26.7 V; 6.21 A) → `Pdc = 664.1 W` pada 106.9 V (di dalam jendela); `Voc` STC 148.8 V, 152.8 V pada 15 °C (< `Vdc_max`). Dengan `η` ≈ 0.96: `Pac ≈ 638 W` (< 1 kW). Bila jaringan padam pada t = 0: `Pac = 0` paling lambat t = 2 s; resambung 60 s setelah jaringan pulih.

---

## 7. Inverter hibrida

Tidak ada datasheet (R4). Baterai LFP 48 V mengacu MBL48-100CP (DS-BAT): 40–58.4 V, discharge kontinu maksimum 100 A.

### 7.1 Parameter

| Simbol | Arti | Satuan | Rentang wajar | Sumber |
|---|---|---|---|---|
| `Pr` | Daya inverter | W | 5000 | PRD §2 |
| `P0`, `η50`, `η100` | Rugi dan efisiensi inverter | W, – | 50; 0.93; 0.91 (fit §5.2: `k1` 0.0216, `k2` 1.345e-5) | A |
| `ηchg` | Efisiensi pengisi dari grid | – | 0.88–0.95 (awal 0.92) | A |
| `ηmppt` | Efisiensi MPPT | – | 0.97–0.98 (awal 0.98; DS-MPPT 0.98) | D/A |
| MPPT ganda | Jendela / Voc maks / Imax per MPPT | V, V, A | 120–450 / 500 / 13–15 | A |
| `Vsbu_off` | Tegangan baterai beralih ke grid (SBU) | V (48 V) | 44–48 (awal 46) | A |
| `Vsbu_on` | Tegangan baterai kembali ke baterai | V (48 V) | 50–54 (awal 52), histeresis ≥ 4 V | A |
| `Igridchg` | Arus isi dari grid (maks) | A | 0–60 (awal 20) | A |
| `exportAllowed` | Ekspor ke grid | – | benar/salah (awal salah) | A |
| `Itransfer` | Waktu alih (grid ↔ baterai) | ms | 10–20 (tidak disimulasikan, dianggap 0) | U; PRD §7 |

### 7.2 Aturan aliran daya (DC-bus)

Notasi: `Ppv` daya MPPT (DC), `Pload` beban AC, `f(P)` rugi inverter §5.2 (daya DC untuk keluaran AC `P`), `Pchg_max = Vbat·Ichg_max_baterai`, `Pdis_max = Vbat·Idis_max`.

| Mode | Beban disuplai oleh | Kelebihan PV | Kekurangan |
|---|---|---|---|
| **SBU** (Solar → Baterai → Utility) | PV, lalu baterai (selama `Vbat > Vsbu_off`; setelah beralih ke grid, kembali ke baterai bila `Vbat ≥ Vsbu_on`) | Isi baterai sampai `Pchg_max`; sisanya dipotong (atau diekspor bila `exportAllowed`) | Baterai: `Pdis = f(Pload) − Ppv` ≤ `Pdis_max`, grid 0 |
| **SUB** (Solar → Utility → Baterai) | PV lewat inverter lebih dulu, kekurangan dari grid; baterai tidak dilepas saat grid ada | Isi baterai | Grid mengisi kekurangan |
| **Utility First** | Grid penuh bila ada | PV hanya mengisi baterai | Grid |

- Grid padam: semua mode berperilaku seperti SBU (baterai menopang).
- **Isi dari grid:** bila `gridChargeEnabled` dan SoC di bawah target: `Pgridchg_dc = min(Vbat·Igridchg, Pchg_max − Pchg_pv)`; daya AC dari grid = `Pgridchg_dc / ηchg`.
- Pembatasan baterai: `Pdis > Pdis_max` → inverter dibatasi atau BMS memutus (§4.5).
- **Neraca daya DC (dipakai uji neraca energi):** `Ppv + Pdis + ηchg·Pac_chg = f(Pinv) + Pchg + Pcurtail`, dengan `Pinv` = bagian beban yang disuplai lewat inverter (bukan bypass grid) dan `Pcurtail` = daya PV yang tidak dipanen.
- `Pgrid = Pgrid_masuk − Pekspor` dikirim ke kWh meter (§10).

### 7.3 Contoh hitung (`f(1000) = 1085 W`)

| Kasus | Hasil |
|---|---|
| SBU, `Ppv` 1500 W | Surplus 415 W → isi baterai 8.0 A pada 52 V; grid 0 |
| SBU, `Ppv` 600 W | Baterai melepas 485 W → 9.3 A; grid 0 |
| SUB, `Ppv` 600 W | PV → AC 535 W; grid impor 465 W; baterai idle |
| Utility First, `Ppv` 600 W | Grid impor 1000 W; PV mengisi baterai |
| Beban 5000 W | `f(5000) = 5495 W` → 107 A pada 51.2 V (125 A pada 44 V) > 100 A maks MBL48 → batas ≈ 4.7 kW keluaran AC atau BMS memutus |

---

## 8. Kabel

### 8.1 Parameter

| Simbol | Arti | Satuan | Rentang | Sumber |
|---|---|---|---|---|
| `ρ20` | Resistivitas tembaga 20 °C | Ω·mm²/m | 0.0175 | D (DS-KBL, permintaan pengguna) |
| `αCu` | Koefisien suhu tembaga | 1/°C | 0.00393 | U |
| `A` | Penampang | mm² | PV: 2.5, 4, 6, 10, 16, 25, 35; NYY: 1.5–35 | D (DS-KBL) |
| `L` | Panjang **satu arah** | m | 0.1–50 | PRD §2 |
| `Kcl` | Faktor kabel berlapis timah kelas 5 | – | 1.00 (awal); sampai 1.11–1.17 setara R maks LAPP | D: bandingkan di bawah |
| `Rc` | Resistansi kontak per sambungan | mΩ | 0.1–0.5 (baik); 5–50 (longgar) | A |
| `Tmax` | Suhu konduktor maksimum | °C | PV H1Z2Z2-K: 90; NYY (PVC): 70 | D (PV); U (NYY) |
| `kamb` | Faktor suhu EN 50618 | – | ≤60 °C: 1.00; 70: 0.92; 80: 0.84; 90: 0.75 | D |
| `τcab` | Konstanta waktu pemanasan | menit | 2–30 (awal 10) | A |

KHA acuan (A), dari DS-KBL:

| A (mm²) | PV bebas di udara | PV di permukaan | PV 2 kabel menyentuh | NYY tanah 20 °C | NYY tanah 30 °C | NYY udara 20 °C | NYY udara 30 °C |
|---|---|---|---|---|---|---|---|
| 1.5 | – | – | – | 30 | 27 | 21 | 18 |
| 2.5 | 41 | 39 | 33 | 41 | 36 | 29 | 25 |
| 4 | 55 | 52 | 44 | 53 | 47 | 38 | 33 |
| 6 | 70 | 67 | 57 | 66 | 59 | 48 | 42 |
| 10 | 98 | 93 | 79 | 88 | 78 | 66 | 57 |
| 16 | 132 | 125 | 107 | 115 | 102 | 90 | 78 |
| 25 | 176 | 167 | 142 | 150 | 134 | 120 | 104 |
| 35 | 218 | 207 | 176 | 180 | 160 | 150 | 131 |

PV: EN 50618 Tabel A.3 pada suhu sekitar 60 °C. NYY: katalog Kitani, kabel 2 inti.

### 8.2 Rumus

```
ρ(T)   = ρ20 * (1 + αCu*(T - 20))
R_loop = ρ(T) * 2*L / A  * Kcl  + sambungan * Rc        (pergi + pulang)
ΔV     = I * R_loop
ΔV%    = ΔV / Vsumber * 100
Iz_eff = KHA * k                                         (k = kamb * pengelompokan; awal 1)
Tcond  = Ta + (Tmax - Tref) * (I / Iz_eff)^2             Tref = 60 °C (PV); 30/20 °C sesuai kolom NYY
Dinamika: dTcond/dt = (Tcond_ss - Tcond)/τcab
```
- Status panas: `I/Iz_eff ≤ 1` normal; `1–1.25` hangat; `> 1.25` atau `Tcond ≥ Tmax` panas. Isolasi rusak (asap) bila `Tcond ≥ Tmax + 20 K` selama 60 s [A].
- Ambang jatuh tegangan yang ditampilkan: hijau ≤ 3%, kuning 3–5%, merah > 5% [A]. Datasheet menyebut 3% hanya sebagai contoh kriteria pengguna, bukan batas standar; sel "Batas jatuh tegangan" memakai satuan "%" tetapi nilainya 0.03 (artinya 3%).
- **Perbedaan model vs datasheet.** `ρ = 0.0175` memberi R/km: 7.00 / 4.375 / 2.917 / 1.75 / 1.094 / 0.70 / 0.50 untuk 2.5…35 mm². R maksimum 20 °C LAPP (tembaga berlapis timah): 8.21 / 5.09 / 3.39 / 1.95 / 1.24 / 0.795 / 0.565 → **11–17% lebih tinggi**. Default model memakai 0.0175 (permintaan pengguna) dan `Kcl` opsional.

### 8.3 Contoh hitung

- Contoh DS-KBL: 2.5 mm², 10 m, 20 A, 48 V → `R = 0.0175·2·10/2.5 = 0.140 Ω`, `ΔV = 2.80 V`, `5.83%` (cocok dengan sheet "Perhitungan").
- Paket Minimum: SCC → baterai 3 m, 20 A, 12.6 V: 4 mm² → 26.3 mΩ, 0.525 V (4.17%); 6 mm² → 17.5 mΩ, 0.350 V (2.78%); 10 mm² → 10.5 mΩ, 1.67%. US4: 2.5 → 6 mm² menurunkan R ke 0.417× (turun 58.3%).
- Panas: PV 4 mm² (2 kabel menyentuh, 44 A), `Ta` = 35 °C, 60 A: `I/Iz = 1.36` → `Tcond = 35 + 30·1.86 = 90.8 °C` ≈ `Tmax` (panas). NYY 2.5 mm² udara 30 °C (25 A), 35 A: `Tcond = 30 + 40·1.96 = 108 °C` > 70 °C → rusak.

---

## 9. Proteksi

### 9.1 MCB AC dan DC

| Simbol | Arti | Rentang di katalog | Sumber |
|---|---|---|---|
| `In` DC | Arus nominal | ABB S200 M UC 0.2–63; Suntree SL7N-63 6–63; Schneider C60H-DC 30; C120N 100 | DS-MCB sheet "MCB DC" |
| `In` AC | Arus nominal | ABB 0.2–63; CHINT NXB-40: 6–40, NXB-63: 1–63, NXB-80: 70–80, NXB-125: 63–125; C120N 100 | DS-MCB sheet "MCB AC" |
| Kurva | Jenis | B, C, D, K, Z (tergantung seri); NXB-63G: `Ii` = 10 `In` / 14.2 `In`; C120N: 8×`In` ±20% | DS-MCB |
| `Ue` DC | Tegangan DC | ABB S200 M UC: 220 V (1P), 440 V (2P); C60H-DC: 500 V; C120N: ≤ 250 V; Suntree: 1P ≤ 250, 2P ≤ 800, 3P ≤ 800, 4P ≤ 1200 V (varian) | DS-MCB |
| `Icu` | Kapasitas pemutusan | AC 4.5–10 kA; DC 6–20 kA (C60H-DC: 20/10/6 kA pada 250/440/500 V; Suntree 6 kA, 2 kA pengecualian) | DS-MCB |
| `Tref` | Suhu acuan | 30 °C (IEC 60898-2), 55 °C B/C dan 20 °C K/Z (IEC 60947-2, ABB), 40 °C (C120N), 25 °C (C60H-DC) | DS-MCB |
| Derating | Pemasangan berdampingan | ≤3: 0.90–0.95; 4–6: 0.80–0.86; 7–9: 0.76–0.78; >9: 0.76 × `In` (CHINT NXB-40/63); NXB-125: 0.9–0.95 / 0.8–0.9 / 0.7–0.8 / 0.7 | DS-MCB (ABB: tabel asli hlm. 5–6, tidak disalin) |
| Polaritas | DC | "Ikuti polaritas pada perangkat" (ABB S200 M UC) | DS-MCB |

Datasheet **tidak memuat kurva waktu-arus**. Kurva di bawah adalah model sederhana dari angka IEC (U) dan titik magnetik di tabel.

```
x = I / In_eff        In_eff = In * (1 - 0.005*(Ta - Tref))        (koefisien 0.003–0.008 /°C [A])
t_trip(x):  x <= 1.13 -> tidak trip
            interpolasi log-log melalui titik tengah:
               (1.13, 7200 s) (1.45, 1800 s) (2.55, 20 s) (5, 6 s), ekstrapolasi kemiringan terakhir
            x >= xm  -> 0.02 s (magnetik)
xm (AC): B 4, C 8, D 14, K 12, Z 3 x In        xm (DC) = kdc * xm(AC),  kdc = 1.4 (1.2–1.5) [A]
```
- Acuan IEC 60898-1: tidak trip dalam 1 jam pada 1.13 `In`, trip < 1 jam pada 1.45 `In`, trip 1–60 s pada 2.55 `In` (`In` ≤ 32 A). IEC 60947-2: 1.05 / 1.30 `In` dalam 2 jam. Rentang magnetik IEC: B 3–5, C 5–10, D 10–20 `In` (K ≈ 8–14, Z ≈ 2–3 `In`) [U, PERLU VERIFIKASI]. Nilai tengah `xm` C = 8 diambil dari C120N.
- **Dosis termal** (arus berubah-ubah): `h += dt / t_trip(x)`; trip saat `h ≥ 1`. Pendinginan: `dh/dt = −h/τcool` untuk `x < 1.0`, `τcool` = 300 s [A].
- **Aturan penolakan/kerusakan** (US13):
  - `Vsistem_dc > Ue` per kutub → "tidak mampu padamkan busur": saat harus trip, MCB rusak (asap) [A].
  - `Iprospektif > Icu` → rusak saat trip [A].
  - MCB tanpa rating DC di datasheet (CHINT NXB, seri AC) di sirkuit DC: `Ue_DC` tak dijamin → bila `V ≥ 48 V` atau arus yang diputus `> 3 In`, tidak padam [A].
  - Polaritas terbalik pada MCB DC berpolaritas: kemampuan putus turun → diperlakukan sebagai `Ue` tidak terpenuhi [A].
- **Arus gangguan:** PV `Ihs ≈ Isc_array` (dibatasi, tidak melebihi sekitar 1.25·`Isc`); baterai `Ihs = OCV / (Rbat + Rkabel + Rc)`.

**Contoh (US13).** MCB 20 A, kurva C, DC (`xm_DC` = 11.2 → 224 A). 2 panel 240W-60P paralel, hubung singkat: `Isc = 17.1 A` (x = 0.86) → **tidak trip**. Baterai VRLA 100 Ah (4.5 mΩ), kabel 2 m / 16 mm² (4.4 mΩ): `Ihs = 12.85/(0.0045 + 0.0044) = 1448 A` → `x = 72` → trip dalam 0.02 s (`Icu` 6 kA ≥ 1.45 kA ✔). Arus tahan: 25 A → 4108 s; 30 A → 1374 s; 50 A → 23.4 s.

### 9.2 Fuse

| Simbol | Arti | Nilai/rentang | Sumber |
|---|---|---|---|
| `In` fuse string PV | Rating | ≤ `Ifuse_max` panel: 15 / 20 / 25 A | DS-PV |
| gPV | Tak melebur / melebur | 1.13 / 1.45 `In` | U (IEC 60269-6) [PERLU VERIFIKASI] |
| Fuse alat ukur | Rating | 10 A cepat (0.2–20 A) | A |
| Tegangan DC | Rating fuse PV | 1000 V | U |

Titik kurva (x = `I/In`, t detik) untuk pelebur [A]: (1.13, 36000), (1.45, 3600), (2, 150), (3, 10), (5, 1), (10, 0.05), (≥ 20, 0.005), interpolasi log-log. Dosis termal sama dengan MCB; fuse putus tidak pulih (harus diganti, PRD §3.2).

**Contoh (US12).** Ampere meter dipasang melintang baterai 12.6 V (`Rpath` 0.03 Ω) → `I = 420 A` = 42× fuse 10 A → putus < 5 ms; meter tampil 0 A dan indikator fuse putus. Fuse string 15 A dengan `Irev` 17.1 A (x = 1.14) tidak melebur berjam-jam (≈ 9 jam pada kurva ini) → fuse string hanya melindungi bila arus balik cukup besar; aturan praktis `(Np−1)·Isc ≥ 1.35·In` [U, PERLU VERIFIKASI].

### 9.3 SPD (simbolis)

| Simbol | Arti | Rentang | Sumber |
|---|---|---|---|
| `Uc` | Tegangan kerja kontinu | ≥ 1.2 × `Voc_cold` (mis. 183 V untuk 4S 240W-60P pada 15 °C; tipikal PV 600–1000 V) | U [PERLU VERIFIKASI] |
| `Up` | Tingkat proteksi | 1.0–2.5 kV | U |
| `In` | Arus nominal 8/20 µs | 5–20 kA | U |
| `Nmax` | Jumlah kejadian sebelum habis | 5–20 | A |

Kejadian lonjakan diskret (waktu, tingkat: rendah/sedang/tinggi) dari skenario. Dengan SPD berpetanahan (jalur PE tersambung): lonjakan diserap, `wear += 1/Nmax`; `wear ≥ 1` → status merah (ganti). Tanpa SPD, SPD habis, atau PE tidak tersambung: perangkat terdampak rusak sesuai data skenario. `Uc` kurang dari `Voc_cold` → SPD terbakar pada operasi normal. Bentuk gelombang tidak dimodelkan (PRD §7).

---

## 10. kWh meter exim

### 10.1 Parameter (DS-KWH)

| Model | Jaringan | Sambungan arus | Tegangan ukur | Akurasi energi | Tampilan | Pulsa |
|---|---|---|---|---|---|---|
| RS PRO 871-8305 | 1P2W / 3P3W / 3P4W | CT eksternal sekunder 1 A atau 5 A | 100–289 V L-N | Class 1 (IEC 62053-21) | 0–9,999,999.9 kWh | tetap 3200 imp/kWh |
| CHINT DTSU666-G | 3P4W | CT 100 A / 40 mA (rasio 2500) | 207–253 V (batas 184–264) | ±1% | tidak dirinci | LED; konstanta tidak dirinci |
| Eastron SDM230-MBus | 1P2W | Langsung 0.5–10 (100) A | 176–276 V L-N | Class 1; Imin 0.5 A | 0–99,999.99 kWh | default 0.001 kWh/pulsa |

Umum: impor dan ekspor energi aktif (dan reaktif); suhu operasi −25…55 °C; konsumsi bantu RS PRO < 2 W.

### 10.2 Model

```
Pgrid > 0: impor (masuk ke instalasi)     Pgrid < 0: ekspor
E_imp += max(Pgrid, 0) * dt/3600          E_exp += max(-Pgrid, 0) * dt/3600          (Wh)
Pembacaan = kuantisasi( (1 + εg) * E )    εg ∈ [-0.01, +0.01] tetap per unit (benih acak) 
```
- Resolusi tampilan diturunkan dari kolom "Tampilan" (RS PRO 0.1 kWh; SDM230 0.01 kWh) [A: resolusi tidak dinyatakan sumber].
- Di bawah `Imin` (0.5 A pada SDM230) akurasi tak dijamin: galat sampai ±5% [A].
- Energi reaktif: beban resistif → PF ≈ 1, kVArh ≈ 0 (PRD §7).
- Tegangan di luar jendela ukur → meter tidak membaca (tampil tanda galat).
- **Salah pasang yang berakibat:** CT terbalik (RS PRO, CHINT) atau `L IN`/`L OUT` tertukar (SDM230) → impor dan ekspor tertukar; fasa/tegangan hilang → `E` tidak bertambah; arus primer `> 100 A` (SDM230 langsung) → rusak [A]. CT 100 A/40 mA: `Isekunder = Iprimer · 0.0004` (63 A → 25.2 mA).

### 10.3 Contoh hitung

30 menit ekspor 300 W lalu 30 menit impor 500 W: `E_exp = 150 Wh`, `E_imp = 250 Wh`. Dengan `εg` = +0.5%: 150.75 / 251.25 Wh; SDM230 menampilkan 0.15 / 0.25 kWh; RS PRO mengeluarkan `250 Wh · 3.2 imp/Wh = 800` pulsa impor.

---

## 11. Profil matahari dan suhu Batam

### 11.1 Parameter

| Simbol | Arti | Satuan | Nilai/rentang | Sumber |
|---|---|---|---|---|
| `φ` | Lintang Batam | ° LU | 1.13 (1.0–1.2) | U [PERLU VERIFIKASI] |
| `λ` | Bujur | ° BT | 104.05; meridian WIB 105 | U [PERLU VERIFIKASI] |
| `Gpeak` | Iradiasi horizontal langit cerah di zenit | W/m² | 1000 (900–1100) | A |
| `p` | Eksponen `cosθz` | – | 1.2 (1.1–1.5) | A |
| `kc` | Faktor awan harian | – | Cerah 1.0; cerah berawan 0.75; berawan 0.5; mendung 0.25; hujan 0.12; tipikal 0.7 | A |
| `ftilt` | Konversi bidang miring | – | 1.0 (kemiringan ≈ 10° di khatulistiwa) | A |
| `Tmin`, `Tmax` | Suhu harian | °C | 24 dan 29 + 3·`kc` (cerah 32); rata-rata tahunan 27–28 | A [PERLU VERIFIKASI] |
| `tmin`, `tmax` | Jam suhu terendah/tertinggi | jam | 06:00 dan 14:30 | A |

### 11.2 Rumus

```
n     = hari ke-n dalam tahun
δ     = 23.45° * sin( 360/365 * (284 + n) )
B     = 360/365 * (n - 81)           EoT = 9.87*sin(2B) - 7.53*cos(B) - 1.5*sin(B)    (menit)
tsur  = tjam_WIB + (4*(λ - 105) + EoT)/60                    (jam surya)
ω     = 15° * (tsur - 12)
cosθz = sin φ * sin δ + cos φ * cos δ * cos ω
G_clear = Gpeak * max(cosθz, 0)^p          G = kc * G_clear * ftilt
Ta(t): setengah-kosinus dua bagian
   tmin..tmax:   Ta = Tmin + (Tmax - Tmin)*0.5*(1 - cos(π*(t - tmin)/(tmax - tmin)))
   tmax..tmin+24: Ta = Tmax - (Tmax - Tmin)*0.5*(1 - cos(π*(t - tmax)/(24 - (tmax - tmin))))
```
- Gangguan awan sesaat (opsional): `kc(t) = kc · (1 − dkc · s(t))`, `s(t)` derau mulus 0–1 skala 1–10 menit dengan benih tetap (hasil dapat diulang), `dkc` 0.3–0.7.
- Matahari terbit/terbenam ≈ 05:57–06:12 / 17:56–18:11 WIB (dihitung dari `cosθz > 0`). Elevasi siang 65–89° sepanjang tahun, sehingga orientasi hampir tidak berpengaruh.
- Iradiasi harian langit cerah (hasil hitung): 7.2 kWh/m² (21 Mar dan 21 Sep), 6.6 (21 Jun), 6.4 (21 Des). Untuk `kc` = 0.7 sekitar 5.0 kWh/m²/hari; rata-rata Indonesia ~4.8 [PERLU VERIFIKASI untuk Batam].

### 11.3 Contoh hitung

21 Maret (n = 80), 10:00 WIB: `EoT = −7.8 menit` → `tsur = 9.807 jam`, `ω = −32.9°`; `cosθz = 0.9998·0.8392 = 0.8391` (elevasi 57.1°). `G_clear = 1000·0.8391^1.2 = 810 W/m²`; `kc` 0.6 → 486 W/m²; `kc` 0.25 → 203. `Ta(10:00) = 24 + 8·0.5·(1 − cos(0.4706π)) = 27.6 °C`; `Tc` (NOCT 45) = `27.6 + 25/800·810 = 53.0 °C`.

---

## 12. Penyelesaian jaringan dan langkah waktu

1. **Simpul dan sumber.** PV sebagai sumber arus `I(V)` (§1); baterai sebagai Thevenin dengan `OCV(SoC)` dan `R` (§4); beban sebagai daya konstan (inverter, §5) atau resistif (`P = V²/R`); SCC/inverter sebagai perilaku (state machine); kabel dan kontak sebagai tahanan seri (§8).
2. **Titik kerja DC.** Cari `Vbus` yang memenuhi `ΣI_masuk(Vbus) − ΣI_keluar(Vbus) = 0` dengan pencarian bagi-dua (fungsi monoton). Jatuh tegangan kabel dihitung ulang 3–5 putaran. Beban daya konstan memakai bentuk tertutup §4.2; diskriminan negatif = runtuh.
3. **Pembaruan keadaan.** SoC, tahap pengisian, penghitung absorption, dosis termal MCB/fuse/kabel, status LVD/BMS, jam kWh meter, hitungan SPD.
4. **Langkah waktu `dt`.** Dasar 1 s waktu simulasi. Percepatan memakai sub-langkah: `dt` hingga 60 s bila semua `x = I/In < 0.9` dan tidak ada transisi keadaan; bila ada `x ≥ 1.0`, `dt ≤ 0.2·t_trip(x)` (minimum 10 ms); kejadian magnetik (t ≤ 0.02 s) diselesaikan sebagai kejadian, bukan integrasi. Dengan demikian percepatan tidak melompati trip (PRD §3.2).
5. **Neraca energi (uji wajib).** Pada tiap langkah: energi PV + energi grid masuk = energi beban + ΔE tersimpan + rugi (inverter, MPPT, kabel, baterai) dalam toleransi 0.5% [A].

---

## 13. Ketidaksesuaian PRD dan datasheet

| # | PRD | Datasheet | Dampak | Usul |
|---|---|---|---|---|
| 1 | Paket Minimum: 2× panel 100 Wp | Tidak ada panel 100 Wp. Terdekat JS185CB-48P (185 Wp, Vmp 15.1 V, kelas 12 V) | 2 paralel = 370 Wp > batas PV RBL-20A (240 W di 12 V); `Isc` 2×13.1 = 26.2 A > 20 A → arus dibatasi (§2.4) | Tambah panel 100 Wp ke katalog atau ubah paket |
| 2 | Paket Rek. A/B/Terbaik: panel 200 Wp | Tidak ada 200 Wp; ada 185, 240, 245, 250, 310, 385–410, 440–460, 540–560 Wp | Contoh hitung memakai 240W-60P dan JS310CB-80P | Pilih model dari daftar atau tambah datasheet |
| 3 | Rek. A: SCC MPPT 40 A | Tersedia 600W/24V (25 A) dan 3KW/24V (60 A); tidak ada 40 A | Batas Voc, jendela, arus berbeda | Pilih salah satu atau tambah datasheet |
| 4 | SCC PWM 20 A | RBL-20A ada, tetapi batas Voc 24 V (sistem 12 V) | Panel 60-sel (Voc ≈ 37 V) tidak boleh dipakai di sistem 12 V | Tampilkan peringatan Voc; panel 12 V-kelas untuk Minimum |
| 5 | VRLA 12 V 100 Ah | FirstPower LFP12100 hanya berisi `Rfull`; TNE12-100 berisi kapasitas C2–C20 tetapi tanpa tegangan isi; Aokly 6-FM berisi tabel lengkap hanya untuk 7–20 Ah | Parameter isi VRLA 100 Ah harus diadopsi dari Aokly | Konfirmasi model 100 Ah |
| 6 | LiFePO4 24 V 100 Ah | Victron 25.6-100 cocok, tetapi **BMS eksternal wajib** | Perlu komponen BMS terpisah atau model "Smart BMS" | Tambahkan BMS ke katalog R2 |
| 7 | LiFePO4 48 V 100 Ah + BMS | MBL48-100CP: BMS "4S/4P/Pre-heat" ambigu | Konfigurasi BMS perlu konfirmasi | Konfirmasi ke pemasok |
| 8 | Inverter 500 W/1.5 kW/1 kW grid-tie/5 kW hibrida, SPD, fuse, busbar | Tidak ada datasheet | §5–§7, §9.2–§9.3 hanya rentang umum | Tambah datasheet sebelum katalog |
| 9 | US13: kurva trip | DS-MCB tidak memuat kurva waktu-arus | Kurva §9.1 memakai angka IEC | Ambil kurva dari katalog produsen |
| 10 | US4: ρ = 0.0175 | R maks LAPP 11–17% lebih tinggi (tembaga berlapis timah) | Jatuh tegangan model sedikit lebih rendah dari nyata | Pakai `Kcl` bila ingin konservatif |
| 11 | US8: "energi MPPT ≥ PWM" | PWM tanpa rugi konversi bisa menyamai/melampaui MPPT bila `Vbat + Vsw ≈ Vmp` | Pada panel 12-V-kelas yang panas, PWM ≈ 96% dari daya maks vs MPPT ≈ 96–97% (§2.4, §3.2) | Ubah KP: "≥ dalam toleransi 3%, nyata bila Vmp array ≥ 1.3·Vbat" |
| 12 | US13: hubung singkat PV tidak memutus MCB | Benar bila `Np·Isc ≤ In`; pada 2P 240W-60P 17.1 A vs 20 A | Tergantung `In` dipilih peserta | Tentukan `In` paket |
| 13 | DS-PWM: LVD 10.7 V, float 13.7 V | "basis 12 V; nilai 24 V tidak dirinci" | Skala × 2 adalah asumsi | Konfirmasi manual RBL 24 V |
| 14 | DS-PV: baris NOCT kosong untuk 240W-60P, 245W-60P, JS185, JS310 | "Tidak tercantum" | Tidak ada pembanding validasi model untuk model ini | Cari datasheet lengkap |
| 15 | DS-KWH: tiga model beda jaringan | RS PRO (CT 1/5 A), CHINT (3P4W, CT), Eastron (1P2W langsung 100 A) | Satu fasa R3: SDM230; 3 fasa: DTSU666 | Tetapkan model per paket |

---

## 14. Daftar [PERLU VERIFIKASI]

| Topik | Bagian |
|---|---|
| Konstanta `L` = 25, `n` pada model log-iradiasi, toleransi uji Isc/Voc/Pmax | §1.3, §1.4 |
| Dioda bypass per modul penuh, `d` = 0.15, `Vf` = 0.6 V | §1.6 |
| `Vsw`, `tabs`, ambang Voc lebih (×1.2 PWM, ×1.1 MPPT), deteksi 12/24 V | §2, §3 |
| Skala 24/36/48 V dari basis 12 V | §2.1, §3.1 |
| MPPT melebihi `Ppv_max`: digeser, tidak rusak | §3.2 |
| Tabel OCV VRLA/LFP, `ΔVover`, `Kk`, `s0`, `R(SoC)`, `k` Peukert, `ηc`, `a` | §4 |
| Tegangan isi VRLA berbasis Aokly diterapkan pada semua VRLA; koefisien suhu "per sel" | §4.1 |
| Waktu BMS (arus lebih 10 s, hubung singkat 1 ms) dan ambang 3×`Idis` | §4.5 |
| DoD latihan 50% / 80% | §4.6 |
| Seluruh parameter inverter (§5–§7): `P0`, `η`, ambang LVD/HVD, jendela MPPT, `trecon`, `Vsbu_*`, `Igridchg` | §5–§7 |
| Tegangan nominal AC (220 vs 230 V) dan jendela jaringan/frekuensi IEC 61727 | §5.1, §6.1 |
| Waktu anti-islanding ≤ 2 s (IEC 62116) | §6.1 |
| Resistivitas `αCu`, `Tmax` NYY 70 °C, faktor panas kabel, konstanta waktu kabel | §8 |
| Kurva waktu-arus MCB/fuse, `kdc` = 1.4, magnetik per kurva, `τcool`, koefisien suhu 0.005/°C | §9.1, §9.2 |
| Aturan fuse string `(Np−1)·Isc ≥ 1.35·In` | §9.2 |
| Parameter SPD (`Uc`, `Up`, `In`, `Nmax`) | §9.3 |
| Galat kWh meter di bawah `Imin` (±5%), resolusi tampilan | §10 |
| Lintang, bujur, `Gpeak`, `p`, `kc`, suhu harian Batam, rata-rata 4.8 kWh/m²/hari | §11 |

---

## 15. Usulan matriks uji referensi independen

PRD §8 meminta referensi **independen**. Baris bertanda **DS** berasal dari datasheet; baris bertanda **H** dihitung dari rumus dokumen ini dengan skrip terpisah dan masih perlu silang-cek (mis. lembar kerja lain) sebelum dianggap independen.

| Besaran | Kondisi | Nilai acuan | Toleransi | Asal |
|---|---|---|---|---|
| Pmax PV-MJT245GB | G 800, Tc 47 | 177 W | ±3% | DS |
| Pmax LR5-72HPH-540M | G 800, Tc 45 | 403.6 W | ±3% | DS |
| Voc AE MD-120 440W | G 800, Tc 45 | 38.8 V | ±2% | DS |
| Isc SW 240 poly | G 800, Tc 46 | 6.80 A | ±2% | DS |
| `Isc(500)/Isc(1000)` | Tc sama | 0.500 | ±0.2% | H |
| Voc 240W-60P | 25 → 65 °C, G 1000 | 37.2 → 33.18 V | ±1% | H |
| Titik daya maks 240W-60P | G 800, Ta 30 | 166.0 W (26.72 V; 6.21 A) | ±1% | H |
| `Ichg` PWM RBL-20A + 2P JS185CB-48P | G 800, Ta 30, Vbat 12.6 | 20.00 A (dibatasi) | ±0.2 A | H |
| `Pout` MPPT 600W/24V + 2S JS310CB-80P | G 800, Ta 30, Vbat 26 | 428.1 W; 16.5 A | ±2% | H |
| Voc_cold 2S 240W-60P | 20 °C | 75.4 V (> 75 V) | ±0.5 V | H |
| Arus baterai VRLA 100 Ah | SoC 0.5, 568.2 W, R 9.3 mΩ | 47.9 A; 11.86 V | ±1% | H |
| Waktu pengosongan | 47.9 A, 100 Ah, `k` 1.2 | 1.33 jam | ±10% (tabel Aokly: 1.28 jam) | DS/H |
| `Pin` inverter 500 W | `Pout` 500 W | 568.2 W | ±0.5% | H |
| Jatuh tegangan kabel | 2.5 mm², 10 m, 20 A, 48 V | 2.80 V (5.83%) | ±1% | DS (DS-KBL "Perhitungan") |
| Waktu trip MCB 20 A kurva C | 30 A / 50 A / 1448 A | 1374 s / 23.4 s / 0.02 s | satu dekade | H (kurva model) |
| Hibrida SBU | `Ppv` 1500, `Pload` 1000 | 415 W ke baterai | ±1% | H |
| Iradiasi 21 Mar 10:00 | `kc` 1 | 810 W/m² | ±2% | H |
| Energi kWh meter | 30 min −300 W, 30 min +500 W | 150 / 250 Wh | ±0.5% | H |
