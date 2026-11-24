# Katalog Komponen — Trainer Virtual PLTS (SimPLTS) v1

Status: katalog dipakai aplikasi; angka generik masih menunggu verifikasi (§8). Sumber: `docs/MODEL_FISIKA.md`, `docs/PRD.md`, dan tujuh berkas di `docs/datasheet/`. Isi katalog ada di `src/data/catalog/*.json`; dokumen ini menjelaskan setiap field. Bentuk dan aturan isinya dijaga skema zod di `src/data/catalog/schema.ts` dan `schema/` (§10); katalog divalidasi saat aplikasi dimuat (`loadCatalog`) dan di `npm run test`.

Angka yang tidak ada di datasheet memakai nilai generik pasar Indonesia tanpa merek dan ditandai **[PERLU VERIFIKASI]** (lihat §5).

## 1. Berkas

Satu berkas per kelompok kategori. Total 52 item di 12 berkas. Kolom paket menghitung keanggotaan (satu item boleh masuk lebih dari satu paket).

| Berkas | Kategori (`category`) | Item |
|---|---|---|
| `pv-modules.json` | `pv-module` | 7 |
| `charge-controllers.json` | `scc-pwm`, `scc-mppt` | 4 |
| `batteries.json` | `battery` | 4 |
| `bms.json` | `bms` | 1 |
| `inverters.json` | `inverter-offgrid`, `inverter-gridtie`, `inverter-hybrid` | 4 |
| `protection-mcb.json` | `mcb-dc`, `mcb-ac` | 9 |
| `protection-other.json` | `fuse`, `spd`, `combiner` | 5 |
| `cables.json` | `cable` | 2 |
| `meters.json` | `kwh-meter` | 1 |
| `distribution.json` | `busbar`, `grounding`, `load-panel` | 7 |
| `loads.json` | `load-dc`, `load-ac` | 7 |
| `grid.json` | `grid` | 1 |

Keanggotaan paket: `min` 26 item, `rek` 39 item, `best` 29 item.

**Tidak masuk katalog** (bukan komponen meja kerja): multimeter, clamp DC, dan meter V AC (fitur `instruments`, PRD F5); tampilan monitoring (nilai di UI, PRD §7). Model datasheet yang tidak dipakai paket mana pun belum dimasukkan: panel LONGi/AESOLAR/REC, SCC PWM RBL selain 20 A, SCC MPPT 300/850 W dan 3KW 12/48 V, baterai FirstPower/Aokly/Tianneng/Victron lain, MCB selain yang dipilih, kWh meter RS PRO dan CHINT.

## 2. Bentuk berkas

```
{ "schemaVersion": 1, "file": "<nama berkas tanpa .json>", "items": [ <item>, ... ] }
```

| Field | Tipe | Arti |
|---|---|---|
| `schemaVersion` | bilangan bulat | Versi format katalog. Naik bila bentuk item berubah; berkas lama dimigrasi atau ditolak (PRD §3.2). Sekarang `1`. |
| `file` | teks | Harus sama dengan nama berkas; dipakai untuk mendeteksi berkas tertukar. |
| `items` | larik | Daftar item katalog. |

## 3. Item

| Field | Tipe | Satuan | Wajib | Arti |
|---|---|---|---|---|
| `id` | teks | – | ya | Pengenal unik di seluruh katalog: huruf kecil, angka, dan tanda hubung (`pv-js185cb-48p`). Dipakai oleh skenario dan berkas simpan, jangan diubah setelah dipakai. |
| `category` | teks | – | ya | Salah satu kategori pada §1. Menentukan parameter yang diharapkan (§6) dan perilaku di `src/domain/`. |
| `name` | teks | – | ya | Nama tampilan, maksimal 3 kata (`SCC PWM 20A`). Tidak berisi merek. |
| `packages` | larik teks | – | ya | Paket yang menyediakan komponen ini di baki: `min` (Minimum, off-grid 12 V), `rek` (Rekomendasi A off-grid 24 V dan B on-grid), `best` (Terbaik, hibrida). Pembeda A/B ada di `notes`. |
| `electrical` | objek | lihat §4 | ya | Parameter listrik. Satuan ada di akhir nama field. |
| `terminals` | larik | – | ya | Terminal (§5.1). Larik kosong untuk kabel (kabel menyambung terminal, bukan diseret ke meja). |
| `protection` | objek | lihat §4 | ya | Rating proteksi: batas yang memicu trip, galat, atau kerusakan. Boleh `{}` bila komponen tidak punya rating proteksi. |
| `image` | teks | – | ya | Path gambar relatif dari akar proyek, berakhiran `.webp`, di `src/assets/components/`. Ada 20 berkas gambar, dibuat dari `assets-src/` oleh `scripts/process-assets.py`; item satu keluarga memakai satu gambar (mis. semua MCB DC memakai `mcb-dc-2p.webp`). 13 item belum punya berkas gambarnya (busbar, fuse, SPD, BMS, elektrode pembumian, panel beban, jaringan PLN) dan tampil sebagai kotak berikon. |
| `datasheet` | objek | – | ya | Asal data (§5.2). |
| `notes` | teks | – | tidak | Catatan untuk pengembang dan reviewer; memuat tanda `[PERLU VERIFIKASI]` bila ada angka tak pasti. Bukan teks tampilan: teks UI ada di `src/i18n/id.ts`. |

## 4. Konvensi nama dan satuan parameter

Satuan ditulis di akhir nama field (AGENTS.md). Pecahan tanpa satuan ditulis sebagai desimal 0–1 (`efficiencyAtFullLoad: 0.88`, `socPct` tidak dipakai di katalog).

| Akhiran | Satuan | | Akhiran | Satuan |
|---|---|---|---|---|
| `V` | volt | | `Mohm` | miliohm (mΩ) |
| `A` | ampere | | `Ohm` | ohm |
| `W` | watt | | `Ma` | miliampere |
| `Wp` | watt-puncak (tidak dipakai; daya STC ditulis `pmaxW`) | | `Ka` | kiloampere |
| `Wh`, `Kwh` | watt-jam, kilowatt-jam | | `Kv` | kilovolt |
| `Ah` | ampere-jam | | `C` | derajat Celsius (`noctC`, `tempOpMinC`) |
| `Pct` | persen (0–100) | | `K` | kelvin (selisih suhu) |
| `Hz` | hertz | | `S`, `Ms`, `Min`, `Hours` | detik, milidetik, menit, jam |
| `Mm2` | mm² | | `PerC` | per °C (koefisien suhu, mis. `-0.0027`) |
| `Factor` | pengali tanpa satuan | | `PerCell`, `PerHour`, `PerDay`, `PerMonth` | dasar per sel, jam, hari, bulan |

Kurva dan tabel ditulis sebagai larik pasangan `[x, y]` atau dua larik sejajar; arti sumbu dijelaskan di §6.

## 5. Terminal dan sumber data

### 5.1 Terminal

| Field | Tipe | Satuan | Arti |
|---|---|---|---|
| `id` | teks | – | Unik dalam satu item (`pos`, `bat-neg`, `l-in`). Dipakai oleh kabel di berkas simpan. |
| `label` | teks | – | Label di gambar komponen (`PV+`, `BAT−`, `L IN`). Singkat; bukan paragraf. |
| `kind` | teks | – | Jenis terminal: `pv+`, `pv-`, `dc+`, `dc-`, `acL`, `acN`, `pe`, `data` (tabel di bawah). |
| `xPct` | bilangan | % lebar gambar | Posisi horizontal pusat terminal terhadap gambar, 0–100. Diisi lewat editor terminal (`/dev/terminal-editor`, hanya saat pengembangan). |
| `yPct` | bilangan | % tinggi gambar | Posisi vertikal, 0–100. Terminal yang masih (0, 0) dianggap belum ditandai dan dijajarkan di bawah gambar. |
| `maxWires` | bilangan bulat | kabel | Kapasitas sambungan per terminal (PRD §2): sambungan ke terminal penuh ditolak. Nilai ini rancangan trainer (1 kabel per terminal; 4 untuk terminal daya modul PV dan baterai agar seri/paralel bisa langsung dari terminal; 2 untuk BMS; 6 untuk elektroda pentanahan), bukan angka datasheet. [PERLU VERIFIKASI] |

| `kind` | Arti | Kutub |
|---|---|---|
| `pv+` / `pv-` | Positif / negatif jalur panel surya | + / − |
| `dc+` / `dc-` | Positif / negatif jalur DC (baterai, busbar DC, beban DC) | + / − |
| `acL` | Fasa (line) AC | – |
| `acN` | Netral AC | – |
| `pe` | Penghantar pembumian | – |
| `data` | Sinyal (BMS, CAN, M-Bus, pulsa); tidak membawa daya | – |

Kutub `+` mencakup `pv+` dan `dc+`; kutub `−` mencakup `pv-` dan `dc-`. Panel (`pv+`) ke MCB DC (`dc+`) ke SCC (`pv+`) adalah rangkaian yang benar; `+` ke `−` adalah polaritas terbalik. Penolakan **mekanis** (terminal penuh, kabel ke diri sendiri) berbeda dari kesalahan **elektris** (polaritas, tegangan) yang diizinkan di Rakit Bebas (PRD §2).

### 5.2 `datasheet`

| Field | Tipe | Arti |
|---|---|---|
| `source` | teks | Berkas dan sheet/halaman sumber, atau pernyataan bahwa tidak ada datasheet. |
| `coverage` | teks | `full` = semua parameter dari datasheet; `partial` = sebagian dari datasheet, sebagian generik; `generic` = tidak ada datasheet, seluruhnya generik. Saat ini tidak ada item `full`. |
| `verify` | larik teks | Jalur field yang **tidak** berasal dari datasheet dan wajib diverifikasi (`electrical.vocV`, `protection.seriesFuseMaxA`). Untuk `generic`, semua field `electrical` dan `protection`. Item `generic` juga dapat diperiksa secara otomatis: larik ini harus sama dengan seluruh isi kedua objek. |

Setiap item yang `coverage`-nya bukan `full` atau `verify`-nya tidak kosong memuat `[PERLU VERIFIKASI]` di `notes`.

## 6. Parameter listrik per kategori

### 6.0 Parameter yang bisa diatur manual

Rating utama tiap kategori (yang tampil di kotak rating inspektur) bisa diubah per komponen lewat tombol "Atur parameter". Daftarnya ada di `PARAM_SPECS` (`src/domain/catalog/params.ts`). Nilai katalog adalah nilai default dan tidak pernah berubah. Ubahan disimpan per komponen di berkas rangkaian sebagai field opsional `params` (mis. `{"ratedA": 25, "curve": "B"}`), jadi berkas lama tetap sah dan `formatVersion` tetap 1.

- Satu ubahan mengisi field dengan nama yang sama di `electrical` dan `protection` sekaligus (mis. `ratedCurrentA` MCB).
- Angka harus > 0 dan paling besar 10× default [PERLU VERIFIKASI]; kurva trip MCB dan kelas fuse dipilih dari daftar.
- Tetap (hanya tampil): tegangan sistem SCC PWM, tegangan nominal baterai (ditentukan jumlah sel dan kurva OCV), jumlah masukan combiner, jumlah posisi busbar, jumlah sirkuit Panel Beban (terikat terminal dan gambar).
- Keterkaitan [PERLU VERIFIKASI]: PV memakai Vmp/Imp/Voc/Isc, jadi Pmax baru menskala Imp (dan Isc bila tidak diatur), dan Vmp baru memperbarui Pmax; Vmp ≥ Voc atau Imp ≥ Isc ditolak. Beban: `resistanceAtMaxOhm = V²/Pmaks` dihitung ulang; daya maksimum di bawah daya minimum ditolak.
- Sebagian rating hanya dipakai pemeriksaan rangkaian atau tampilan, belum oleh model simulasi (mis. tegangan nominal SCC MPPT dan inverter, rating SPD, kelas akurasi kWh meter).
- Mengganti varian MCB/Panel Listrik membuang ubahan parameter komponen itu.

Simbol mengikuti `docs/MODEL_FISIKA.md` (kolom "Simbol"). Bagian `protection` yang memakai nama sama dengan `electrical` (mis. `ratedCurrentA`) adalah salinan nilai rating untuk tampilan peringatan.

### 6.1 `pv-module` — modul PV (MODEL_FISIKA §1)

| Field | Satuan | Arti |
|---|---|---|
| `cellCount` | sel | Jumlah sel (bukan sel seri untuk modul half-cell) |
| `pmaxW`, `vmpV`, `impA`, `vocV`, `iscA` | W, V, A, V, A | Daya maksimum, tegangan dan arus titik daya maksimum, tegangan rangkaian terbuka, arus hubung singkat pada STC (1000 W/m², 25 °C) |
| `tempCoeffIscPerC`, `tempCoeffVocPerC`, `tempCoeffPmaxPerC` | 1/°C | α, β, γ (β dan γ negatif) |
| `noctC` | °C | Suhu sel nominal (NOCT/NMOT) |
| `systemVoltageMaxV` | V DC | Tegangan sistem maksimum |
| `bypassDiodeCount` | buah | Dioda bypass |
| `tempOpMinC`, `tempOpMaxC` | °C | Suhu operasi modul |
| `protection.seriesFuseMaxA` | A | Rating fuse seri maksimum |
| `protection.reverseCurrentMaxA` | A | Arus balik maksimum |

### 6.2 `scc-pwm` — SCC PWM (MODEL_FISIKA §2)

| Field | Satuan | Arti |
|---|---|---|
| `batteryVoltagesV` | V | Tegangan baterai yang dideteksi otomatis |
| `chargeStages` | tahap | Tahap pengisian PWM |
| `chargeCurrentMaxA`, `loadCurrentMaxA` | A | `Ichg_max`, `Iload_max` |
| `pvPowerMax12VW`, `pvPowerMax24VW` | W | Daya PV maksimum pada sistem 12 V / 24 V |
| `pvVocMax12VV`, `pvVocMax24VV` | V | Voc PV maksimum pada sistem 12 V / 24 V |
| `absorptionV` | V | Tegangan absorption/equalization per jenis baterai (`sealed`, `gel`, `flooded`), basis 12 V |
| `floatV`, `rechargeV` | V | Tegangan float, tegangan pengisian kembali (basis 12 V) |
| `loadDisconnectV`, `loadReconnectV` | V | Pemutusan dan penyambungan kembali beban (basis 12 V) |
| `voltageScale24V` | pengali | Pengali ambang tegangan untuk sistem 24 V (asumsi) |
| `selfConsumptionMa` | mA | Konsumsi internal (datasheet: < 10) |
| `switchDropV` | V | Jatuh tegangan sakelar/dioda `Vsw` |
| `absorptionDurationMin` | menit | Lama absorption `tabs` |
| `tempOpMinC`, `tempOpMaxC` | °C | Suhu operasi |
| `installOrder` | larik | Urutan pasang yang benar: `battery`, `pv`, `load` (US17) |
| `protection.vocFaultFactor` | pengali | Voc di atas `pvVocMax × faktor` → rusak; di antaranya → galat tidak mengisi |
| `protection.loadOverloadCurve` | `[rasio, detik]` | Beban lebih: rasio terhadap `loadCurrentMaxA` → waktu putus |
| `protection.features` | larik | Proteksi yang disebut datasheet |
| `protection.reversePolarityDamages` | boolean | `false` = polaritas terbalik tidak merusak, hanya galat |

### 6.3 `scc-mppt` — SCC MPPT (MODEL_FISIKA §3)

| Field | Satuan | Arti |
|---|---|---|
| `batteryNominalV` | V | Tegangan baterai nominal |
| `mpptMinV`, `mpptMaxV` | V | Jendela pelacakan MPPT |
| `pvVocMaxV` | V | Voc PV maksimum (kondisi dingin, US16) |
| `pvPowerMaxW` | W | Daya PV maksimum |
| `inputCurrentMaxA`, `chargeCurrentMaxA` | A | Arus masukan dan arus pengisian maksimum |
| `efficiencyMax`, `trackingEfficiency` | – | `ηmax`, `ηtrk` |
| `standbyPowerW` | W | Rugi tetap `Pfix` |
| `startDeltaV` | V | Selisih PV−baterai agar mulai |
| `bulkV` | V | Tegangan bulk/absorption semua jenis baterai |
| `floatV` | V | Float per jenis (`vented`, `sealed`, `gel`, `nicd`) |
| `lowBatteryAlarmV` | V | Alarm baterai rendah |
| `autoDetectBattery`, `batteryTempSensor` | boolean | Deteksi tegangan otomatis; sensor suhu (BTS) |
| `absorptionDurationMin` | menit | Lama absorption |
| `tempOpMinC`, `tempOpMaxC` | °C | Suhu operasi |
| `protection.vocMaxV` | V | Batas Voc (sama dengan `pvVocMaxV`) |
| `protection.vocFaultFactor` | pengali | Voc di atas `batas × faktor` → rusak (MODEL_FISIKA §3.3: 1.1) |
| `protection.overloadAlarmPct` | % | Alarm beban lebih |
| `protection.features` | larik | Proteksi yang disebut datasheet |

### 6.4 `battery` dan `bms` (MODEL_FISIKA §4)

| Field | Satuan | Arti |
|---|---|---|
| `chemistry` | – | `vrla-agm`, `vrla-gel`, `lifepo4` |
| `nominalVoltageV`, `cellCount` | V, sel | Tegangan nominal; jumlah sel seri |
| `capacityAh`, `capacityBasisHours` | Ah, jam | Kapasitas `Cn` dan laju acuannya (C20 = 20, C5 = 5) |
| `capacityC5Ah`, `capacityC2Ah` | Ah | Kapasitas pada laju 5 jam / 2–3 jam |
| `energyWh` | Wh | Energi nominal (bila tertera) |
| `internalResistanceMohm` | mΩ | Resistansi internal pada keadaan penuh `Rfull` / `Rint` |
| `floatVPerCell`, `cycleVPerCell` | V/sel | Tegangan float dan cycle VRLA |
| `tempCoeffFloatMvPerCPerCell`, `tempCoeffCycleMvPerCPerCell` | mV/°C/sel | Koefisien suhu tegangan isi |
| `chargeVoltageV`, `chargeVoltageToleranceV` | V | Tegangan charge CC/CV LiFePO4 dan toleransinya |
| `chargeVoltageMinV`, `chargeVoltageMaxV`, `chargeVoltageRecommendedV` | V | Rentang dan nilai anjuran tegangan charge |
| `floatV` | V | Tegangan float LiFePO4 |
| `tailCurrentFractionC` | × C | Arus akhir CV (0.02 C) |
| `chargeCurrentMaxA`, `chargeCurrentRecommendedA` | A | Arus charge maksimum dan standar/anjuran |
| `dischargeCurrentMaxA`, `dischargeCurrentRecommendedA` | A | Arus discharge kontinu maksimum dan anjuran |
| `pulseCurrentMaxA`, `pulseDurationS` | A, s | Arus pulsa dan lamanya |
| `dischargeCutoffVPerCell`, `dischargeCutoffV` | V/sel, V | Cut-off discharge |
| `capacityTempPoints` | `[°C, pecahan]` | Kapasitas relatif terhadap suhu (`fT`) |
| `roundTripEfficiency` | – | Efisiensi round-trip |
| `selfDischargePctPerMonth` | %/bulan | Pelepasan sendiri |
| `chargeTempMin/MaxC`, `dischargeTempMin/MaxC` | °C | Rentang suhu isi dan lepas |
| `cycleLife100DodMin/Max`, `cycleLife80Dod`, `cycleLife70Dod`, `cycleLife50Dod` | siklus | Umur siklus pada DoD yang tertera |
| `designLifeYears` | tahun | Umur float desain |
| `trainingDodLimitPct` | % | Batas pemakaian latihan (US9): VRLA 50, LiFePO4 80 |
| `modelParams` | objek | Kalibrasi model §4.2–4.3, semuanya asumsi: `ocvSoc`/`ocvV` kurva OCV (SoC 0–1 → V total), `overVoltageSoc`/`overVoltageV` tambahan tegangan saat mengisi, `resistanceSocFactor`, `sagVoltageV`/`sagSocScale` (runtuh tegangan di ujung pengosongan, `Kk`, `s0`), `peukertExponent`/`peukertRefHours`, `chargeEfficiency`/`chargeEfficiencyKneeSoc`/`chargeEfficiencyAtFull`, `acceptancePerHour` (`a`), `selfDischargePctPerDay` |
| `protection.internalBms` / `externalBmsRequired` | boolean | BMS di dalam baterai / wajib BMS terpisah |
| `protection.overVoltageCutoffV`, `underVoltageCutoffV` | V | Pemutus BMS: charge dan discharge |
| `protection.overCurrentDischargeA`, `overCurrentDelayS` | A, s | Arus lebih discharge dan lama sebelum putus |
| `protection.shortCircuitFactor`, `shortCircuitDelayMs` | × Idis, ms | Hubung singkat: ambang dan waktu putus |
| `bms.*` | | Pada `bms`: `overVoltageCellV`/`underVoltageCellV` (V/sel), `maxBatteriesParallel`, `balancing`; arus maksimum, `chargeTemp*` mengikuti arti di atas |

### 6.5 `inverter-offgrid`, `inverter-gridtie`, `inverter-hybrid` (MODEL_FISIKA §5–§7)

| Field | Satuan | Arti |
|---|---|---|
| `ratedAcPowerW` | W | Daya kontinu `Pr` |
| `surgeMultiple`, `surgeDurationS` | ×`Pr`, s | Lonjakan `Psurge` dan lama maksimum |
| `noLoadPowerW` | W | Konsumsi tanpa beban `P0` |
| `efficiencyAtHalfLoad`, `efficiencyAtFullLoad` | – | `η50`, `η100`; `k1` dan `k2` diturunkan di domain (§5.2) |
| `nominalDcV` | V | Tegangan baterai nominal |
| `dcVoltageLowAlarmV`, `dcVoltageLvdV`, `dcVoltageLvrV`, `dcVoltageHvdV` | V | Alarm, putus rendah (LVD), sambung kembali (LVR), putus tinggi (HVD) |
| `lvdDelayS` | s | Tunda LVD `tlvd` |
| `acOutputVoltageV`, `acOutputFrequencyHz`, `waveform` | V, Hz, – | Keluaran AC; `pure-sine` |
| `mpptCount`, `mpptMinV`, `mpptMaxV` | buah, V | Jumlah dan jendela MPPT |
| `pvVocMaxV`, `dcCurrentMaxA`, `mpptCurrentMaxA` | V, A | Voc masukan maksimum; arus masukan (per MPPT untuk hibrida) |
| `dcStartV` | V | Tegangan mulai (grid-tie) |
| `efficiencyPeak`, `mpptEfficiency` | – | Efisiensi puncak; efisiensi MPPT hibrida |
| `standbyPowerW` | W | Konsumsi malam grid-tie |
| `dcPowerMaxFactor` | ×`Pac_r` | Daya DC maksimum yang diterima |
| `gridVoltageMin/MaxFactor`, `gridFrequencyMin/MaxHz` | ×Vnom, Hz | Jendela tegangan dan frekuensi jaringan |
| `reconnectDelayS` | s | Tunda sambung kembali `trecon` |
| `gridChargeEfficiency` | – | Efisiensi pengisi dari grid |
| `sbuToGridV`, `sbuToBatteryV` | V | Ambang SBU: beralih ke grid, kembali ke baterai |
| `gridChargeCurrentMaxA`, `gridChargeCurrentDefaultA` | A | Arus isi dari grid: batas dan nilai awal |
| `exportAllowedDefault`, `transferTimeMs`, `modes` | boolean, ms, larik | Ekspor awal; waktu alih (dianggap 0); mode SBU/SUB/UTILITY_FIRST |
| `protection.overloadCurve` | `[rasio, detik]` | Beban lebih: `P/Pr` → waktu sampai mati (terkunci) |
| `protection.hasInternalFuse`, `hasReversePolarityProtection`, `reversePolarityDamages` | boolean | Fuse internal; proteksi polaritas; polaritas DC terbalik merusak (US15) |
| `protection.dcVocMaxV` | V | Voc di atas ini merusak (grid-tie) |
| `protection.antiIslanding`, `antiIslandingTimeS` | boolean, s | Anti-islanding dan batas waktunya |

### 6.6 `mcb-dc`, `mcb-ac` (MODEL_FISIKA §9.1)

| Field | Satuan | Arti |
|---|---|---|
| `poles` | kutub | Jumlah kutub (2) |
| `ratedCurrentA` | A | `In` |
| `curve` | – | Kurva trip (B, C, D, K, Z); titik magnetik dan kurva termal diturunkan di domain |
| `ratedVoltageDcV`, `maxVoltageDcV` | V DC | `Ue` per perangkat dan `Umax`; `null` bila datasheet tidak memberi rating DC (MCB AC) |
| `ratedVoltageAcV`, `frequencyHz` | V AC, Hz | Tegangan dan frekuensi nominal AC |
| `breakingCapacityKa` | kA | `Icu`/`Icn` |
| `refTempC` | °C | Suhu acuan `Tref` |
| `polarized` | boolean | Ikuti polaritas; polaritas terbalik menurunkan kemampuan putus |
| `minOperatingVoltageV` | V | Tegangan operasi minimum |

Di baki semua MCB tampil sebagai satu ubin "MCB"; jenis (DC/AC) dan arus pengenal dipilih di inspektur dari item yang ada di paket (`src/domain/catalog/variants.ts`). Tiap arus pengenal tetap item sendiri dengan datasheet-nya, jadi menambah pilihan arus = menambah item.

### 6.7 `fuse`, `spd`, `combiner` (MODEL_FISIKA §9.2–9.3)

| Field | Satuan | Arti |
|---|---|---|
| `fuse.poles`, `class` | kutub, – | Jumlah kutub; kelas (`gPV`, `ANL`) |
| `fuse.ratedCurrentA`, `ratedVoltageDcV`, `breakingCapacityKa` | A, V, kA | Rating fuse |
| `fuse.protection.timeCurrentPoints` | `[I/In, detik]` | Titik kurva pelebur, interpolasi log-log |
| `fuse.protection.blowsPermanently` | boolean | Putus tidak pulih (harus diganti, PRD §3.2) |
| `spd.type` | – | Tipe SPD (2) |
| `spd.continuousVoltageUcV` | V | `Uc`; harus ≥ 1.2 × Voc dingin |
| `spd.protectionLevelUpKv`, `nominalDischargeCurrentKa` | kV, kA | `Up`; arus nominal 8/20 µs |
| `spd.maxEvents` | kejadian | `Nmax` sebelum habis |
| `combiner.stringInputs`, `fusePerStringA` | buah, A | Jumlah input string; fuse tiap string |
| `combiner.ratedVoltageDcV`, `ratedCurrentA` | V, A | Rating kotak |

### 6.8 `cable` (MODEL_FISIKA §8)

| Field | Satuan | Arti |
|---|---|---|
| `conductor` | – | Bahan (`copper`) |
| `resistivityOhmMm2PerM` | Ω·mm²/m | `ρ20` = 0.0175 |
| `tempCoeffPerC` | 1/°C | `αCu` |
| `tinnedFactor` | pengali | `Kcl` (1.0 awal; sampai 1.17 setara R maks LAPP) |
| `contactResistanceMohm` | mΩ | Resistansi kontak per sambungan `Rc` |
| `thermalTimeConstantMin` | menit | `τcab` |
| `ratedVoltageV`, `currentType` | V, – | Tegangan nominal; `dc` atau `ac-dc` |
| `maxConductorTempC` | °C | `Tmax` |
| `ampacityRefAmbientC` | °C | Suhu sekitar acuan KHA |
| `ambientDerating` | `[°C, faktor]` | Faktor koreksi suhu (kabel PV, EN 50618) |
| `sizes[]` | – | Satu entri per penampang: `areaMm2` (mm²); `rMaxOhmPerKm` (Ω/km, R maks 20 °C, hanya kabel PV); KHA (A): `ampacityAirA`, `ampacitySurfaceA`, `ampacityTouchingA` (PV: bebas di udara, di permukaan, 2 kabel menyentuh) atau `ampacityGround20A`, `ampacityGround30A`, `ampacityAir20A`, `ampacityAir30A` (NYY) |
| `protection.maxConductorTempC`, `overheatDamageMarginK`, `overheatDamageDelayS` | °C, K, s | Isolasi rusak bila `Tcond ≥ Tmax + margin` selama waktu ini |

Panjang dan penampang dipilih per kabel di meja kerja, bukan di katalog.

### 6.9 `kwh-meter` (MODEL_FISIKA §10)

| Field | Satuan | Arti |
|---|---|---|
| `network`, `directConnection` | –, boolean | Sistem jaringan (`1P2W`); sambungan langsung tanpa CT |
| `currentMinA`, `currentRefA`, `currentMaxA` | A | `Imin`, `Iref`, `Imax` |
| `voltageMinV`, `voltageMaxV`, `frequencyHz` | V, V, Hz | Jendela ukur; di luar jendela meter tidak membaca |
| `accuracyClass`, `energyAccuracyPct` | kelas, % | Kelas akurasi |
| `lowCurrentErrorPct` | % | Galat di bawah `Imin` (asumsi) |
| `displayMaxKwh`, `displayResolutionKwh` | kWh | Batas dan resolusi tampilan |
| `pulseKwhPerPulse` | kWh/pulsa | Energi per pulsa keluaran 1 (default) |
| `gainErrorMaxPct` | % | Galat penguatan tetap per unit `εg` (asumsi) |
| `terminalMaxMm2`, `tempOpMinC`, `tempOpMaxC` | mm², °C | Kabel terminal maksimum; suhu operasi |
| `protection.overCurrentDamageA`, `ipRating` | A, – | Arus yang merusak; kelas IP |

### 6.10 `busbar`, `grounding`, `load-panel`, `grid`, `load-dc`, `load-ac`

| Kategori | Field | Satuan | Arti |
|---|---|---|---|
| `busbar` | `positions`, `ratedCurrentA`, `ratedVoltageV` | buah, A, V | Jumlah posisi, rating arus dan tegangan |
| `grounding` | `earthResistanceOhm` | Ω | Tahanan pentanahan |
| `load-panel` | `ratedCurrentA`, `circuitCount`, `circuitBreakerA`, `circuitCurve`, `ratedVoltageAcV`, `breakingCapacityKa` | A, buah, A, –, V, kA | Masukan utama; sirkuit keluar dengan MCB internal |
| `grid` | `nominalVoltageV`, `voltageToleranceUpPct`, `voltageToleranceDownPct`, `frequencyHz`, `availableDefault` | V, %, %, Hz, boolean | Jaringan PLN: nominal, toleransi, ada tidaknya jaringan saat mulai |
| `load-dc`, `load-ac` | `kind` | – | `resistive` (tanpa arus lonjakan, PRD §7) |
| | `ratedVoltageV` | V | Tegangan pada daya maksimum |
| | `maxPowerW`, `minPowerW`, `stepW` | W | Rentang dan langkah yang dapat diatur peserta (PRD F8) |
| | `resistanceAtMaxOhm` | Ω | `V²/Pmax`; daya sebenarnya `P = V²/R` |

`busbar` dan `load-panel` tampil di baki sebagai satu ubin "Panel Listrik"; jenisnya (DC+, DC−, L, N, PE dari jenis terminal busbar, atau Panel Beban) dipilih di inspektur. Saat jenis atau arus diganti, kabel tetap di terminal yang id dan jenisnya sama; kabel lain dilepas.

Setelan daya tiap beban disimpan di berkas rangkaian (`powerSettingW`), bukan di katalog. `load-ac-fan-50w` (Kipas AC 50W) juga dimodelkan resistif; gambarnya `load-ac-fan.webp`.

## 7. Contoh satu item

`pv-js185cb-48p` dari `pv-modules.json` (nilai dari datasheet kecuali yang tercantum di `verify`):

```json
{
  "id": "pv-js185cb-48p",
  "category": "pv-module",
  "name": "Panel JS185CB-48P",
  "packages": ["min"],
  "electrical": {
    "cellCount": 48, "pmaxW": 185, "vmpV": 15.1, "impA": 12.3, "vocV": 17.7, "iscA": 13.1,
    "tempCoeffIscPerC": 0.0005, "tempCoeffVocPerC": -0.003, "tempCoeffPmaxPerC": -0.0036,
    "noctC": 45, "systemVoltageMaxV": 1500, "bypassDiodeCount": 3, "tempOpMinC": -40,
    "tempOpMaxC": 85
  },
  "terminals": [
    {"id": "pos", "label": "+", "kind": "pv+", "xPct": 23.1, "yPct": 97.4, "maxWires": 4},
    {"id": "neg", "label": "−", "kind": "pv-", "xPct": 80.9, "yPct": 97.8, "maxWires": 4}
  ],
  "protection": {"seriesFuseMaxA": 20, "reverseCurrentMaxA": 20},
  "image": "src/assets/components/pv-module.webp",
  "datasheet": {
    "source": "Datasheet_Panel_Surya_Update.xlsx › Datasheet PV › kolom R (JS185CB-48P); sumber S7 hlm. 1",
    "coverage": "partial",
    "verify": ["electrical.bypassDiodeCount", "protection.reverseCurrentMaxA"]
  },
  "notes": "[PERLU VERIFIKASI] Jumlah dioda bypass dan arus balik maksimum 'tidak tercantum' di datasheet; diisi generik. ..."
}
```

Cara membaca: Voc 17.7 V ≤ batas 24 V SCC PWM 12 V, sehingga aman di paket Minimum; `seriesFuseMaxA` 20 A dari datasheet, sedangkan `reverseCurrentMaxA` diisi generik sehingga masuk `verify`.

## 8. Keputusan dan asumsi yang perlu dikonfirmasi

| # | Hal | Dampak |
|---|---|---|
| 1 | Panel 100 Wp, 200 Wp, dan SCC MPPT 40 A **tidak ada di datasheet**; dibuat sebagai item generik (`coverage: generic`). Item bersumber datasheet tersedia sebagai alternatif (JS185CB-48P untuk Minimum; 240W-60P, PV-MJT245GB, SW 240, JS310CB-80P dan MPPT 600W/24V, 3KW/24V untuk Rekomendasi). | MODEL_FISIKA §13 butir 1–3 |
| 2 | Inverter (off-grid 500 W/1.5 kW, grid-tie 1 kW, hibrida 5 kW), fuse, SPD, combiner box, BMS 24 V, busbar, pentanahan, panel beban, beban, dan jaringan PLN seluruhnya generik. | Perlu datasheet sebelum rilis |
| 3 | Tegangan nominal AC dipakai **220 V** (nominal PLN) di inverter, beban, dan jaringan; `MODEL_FISIKA.md` §5.1 menyebut nilai awal 230 V. | Selaraskan dokumen atau katalog |
| 4 | MCB DC hanya ABB S200 M UC (16/20/32/63 A) dan Schneider C120N 100 A (produk `discontinued` sejak 23 Sep 2025 di datasheet); MCB AC memakai CHINT NXB-63. Kurva trip bukan dari datasheet. | MODEL_FISIKA §13 butir 9 |
| 5 | Parameter isi VRLA 100 Ah dipinjam dari Aokly 6-FM-20; seluruh `modelParams` baterai adalah asumsi kalibrasi. | MODEL_FISIKA §4, §13 butir 5 |
| 6 | Baterai Victron 24 V wajib BMS eksternal; BMS dimodelkan sebagai pemutus seri pada kedua kutub. BMS MBL48 diperlakukan sebagai BMS internal (sumber ambigu). | MODEL_FISIKA §13 butir 6–7 |
| 7 | `maxWires` (kapasitas terminal) masih rancangan. Posisi `xPct`/`yPct` semua terminal sudah diisi; 13 item belum punya gambar (§3). Gambar `mcb-ac-1p` berkutub satu, sedangkan MCB AC katalog punya 4 terminal. | Gambar menyusul; posisi terminal item itu perlu ditandai ulang saat gambarnya ada |

## 9. Menambah atau mengubah item

1. Pilih berkas sesuai kategori (§1); satu berkas sebaiknya di bawah 250 baris, pecah bila lebih.
2. Beri `id` unik dan jangan ubah `id` item yang sudah dipakai skenario.
3. Isi semua field wajib; satuan di akhir nama field.
4. Nilai yang tidak ada di datasheet: pakai nilai generik tanpa merek, masukkan jalurnya ke `datasheet.verify`, dan tulis `[PERLU VERIFIKASI]` di `notes`.
5. Bila bentuk item berubah, perbarui skema zod dan tipe domain (`src/domain/catalog/`), naikkan `schemaVersion`, dan perbarui dokumen ini.
6. Jalankan `npm run test`: `catalog.test.ts` memeriksa jumlah item dan keanggotaan paket di §1, `rules.test.ts` memeriksa aturan §10.
7. Tandai posisi terminal item baru lewat `/dev/terminal-editor` (`npm run dev`).

## 10. Aturan yang dijaga skema

Selain bentuk tiap field (§2–§6; field yang tidak dikenal ditolak), skema menolak isi yang tidak konsisten. Pelanggaran menggagalkan pemuatan katalog dan `npm run test`.

| # | Aturan | Berlaku untuk |
|---|---|---|
| 1 | `vmpV < vocV`, `impA < iscA`, dan `pmaxW` dalam ±5% dari `vmpV × impA` [PERLU VERIFIKASI toleransi] | `pv-module` |
| 2 | Sumbu x kurva naik ketat; kurva proteksi `[rasio, detik]` bernilai positif; faktor tabel suhu positif (suhu negatif boleh); sumbu SoC baterai naik ketat dari 0 sampai 1 | semua kurva dan tabel |
| 3 | Efisiensi `0 < η ≤ 1` | ketiga jenis inverter, `scc-mppt` |
| 4 | Field bernama sama di `protection` dan `electrical` wajib bernilai sama | semua item |
| 5 | `protection.vocMaxV = electrical.pvVocMaxV` | `scc-mppt` |
| 6 | `mpptMinV < mpptMaxV ≤` batas Voc (grid-tie: `protection.dcVocMaxV`) | `scc-mppt`, `inverter-gridtie`, `inverter-hybrid` |
| 7 | `installOrder` tepat `battery, pv, load` | `scc-pwm` |
| 8 | Id paket dan id terminal tidak boleh ganda dalam satu item; kabel tanpa terminal, komponen lain wajib punya terminal | semua item |
| 9 | Tiap jalur di `datasheet.verify` harus ada di item dan tidak ganda; `coverage: full` tidak boleh punya isi `verify`; `coverage: generic` wajib memuat semua field `electrical` dan `protection` di `verify` | semua item |
| 10 | `notes` wajib memuat `[PERLU VERIFIKASI]` bila `coverage` bukan `full` atau `verify` berisi | semua item |
| 11 | Kedua belas berkas di §1 wajib ada; validasi sebagian hanya lewat opsi `allowPartial` | `validateCatalog` |
