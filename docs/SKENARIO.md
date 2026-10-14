# Menulis skenario SimPLTS

Panduan untuk instruktur (widyaiswara): menulis skenario praktik baru sebagai berkas JSON, tanpa mengubah kode.

## 1. Cara memakai berkas skenario

Ada dua cara:

1. **Tanpa kode.** Buka aplikasi, ketuk **Skenario** di bilah atas, lalu **Buka berkas**, dan pilih berkas `.json`. Skenario itu masuk ke daftar sampai halaman dimuat ulang. Bila berkas tidak sah, pesan galat menyebut bagian yang salah, misalnya `steps.2.done.a: Penunjuk terminal ditulis komponen.terminal`.
2. **Skenario bawaan.** Simpan berkas sebagai `src/data/scenarios/<id>.json`. Nama berkas harus sama dengan `id`. Berkas langsung diperiksa oleh `npm run test`.

Sebaiknya mulai dari salah satu contoh yang sudah ada:

| Berkas | Mode | Isi |
|---|---|---|
| `offgrid-dc-terpandu.json` | Praktik Terpandu | Merangkai off-grid 12 V dari preset Minimum, 8 langkah, setiap langkah punya petunjuk |
| `offgrid-cari-gangguan.json` | Cari Gangguan | Sistem off-grid lengkap dengan 8 pilihan gangguan tersembunyi |
| `asesmen-offgrid-dc.json` | Asesmen | 6 langkah tanpa petunjuk, batas lulus 75% |

## 2. Isi berkas

```json
{
  "formatVersion": 1,
  "id": "offgrid-dc-terpandu",
  "version": 1,
  "title": "Merangkai PLTS off-grid DC",
  "package": "min",
  "mode": "guided",
  "goal": "Merangkai PLTS off-grid 12 V dengan urutan aman. Beban DC menyala dari terminal beban SCC.",
  "environment": { "startHour": 10, "cloudCoverPct": 0 },
  "steps": [ ... ],
  "faults": [],
  "faultCount": 1,
  "rubric": { "stepPoints": 10, "hintPenalty": [2, 5], "passPct": 70 }
}
```

| Kunci | Wajib | Arti |
|---|---|---|
| `formatVersion` | ya | Selalu `1` |
| `id` | ya | Huruf kecil, angka, dan tanda `-`, misalnya `cari-gangguan-2` |
| `version` | ya | Naikkan setiap kali isi skenario diubah; versi ikut tercatat di hasil CSV |
| `title` | ya | Judul pendek, maksimal 60 huruf |
| `package` | ya | Paket alat: `min`, `rek`, atau `best` |
| `mode` | ya | `guided` (Praktik Terpandu), `troubleshoot` (Cari Gangguan), atau `assessment` (Asesmen) |
| `goal` | ya | Tujuan, **paling banyak 2 kalimat** |
| `initialCircuit` | tidak* | Rangkaian awal: isi berkas `.simplts.json` (hasil tombol **Simpan**). Bila tidak ada, yang dimuat adalah preset paket. *Wajib untuk `troubleshoot`. |
| `environment` | tidak | `startHour` (jam mulai, 0–23,9), `cloudCoverPct` (0–100), `irradianceWm2` (iradiasi tetap, 0–1200) |
| `steps` | ya | Daftar langkah, minimal satu (§3) |
| `faults` | tidak | Pilihan gangguan untuk instruktur (§5) |
| `faultCount` | tidak | Jumlah gangguan yang disuntikkan saat diacak; bawaan 1 |
| `rubric` | tidak | Rubrik nilai (§6); kunci yang tidak ditulis memakai nilai bawaan |

Cara cepat membuat `initialCircuit`:

1. Rangkai sistemnya di aplikasi.
2. Tekan **Simpan**.
3. Salin seluruh isi berkas `.simplts.json` itu sebagai nilai `initialCircuit`.

## 3. Langkah

```json
{
  "id": "baterai-scc",
  "text": "Sambungkan baterai ke terminal BAT SCC.",
  "icon": "battery",
  "done": { "kind": "connected", "a": "scc.bat-pos", "b": "battery.pos", "throughSwitches": true },
  "hints": ["Baterai dipasang ke SCC sebelum panel.", "+ baterai → fuse → busbar + → BAT+ SCC."],
  "points": 10
}
```

- `id`: unik di dalam skenario.
- `text`: satu kalimat perintah, maksimal 120 huruf.
- `icon`: salah satu dari `cable`, `plug`, `battery`, `sun`, `gauge`, `toggle`, `lightbulb`, `search`, `shield`, `clock`, `wrench`, `zap`, `check`.
- `done`: aturan selesai (§4). Langkah tercentang otomatis begitu aturannya terpenuhi, lalu langkah berikutnya tampil.
- `hints`: 0–2 petunjuk. Petunjuk 1 samar, petunjuk 2 jelas. Setiap petunjuk yang dibuka mengurangi nilai langkah itu. Pada mode Asesmen petunjuk tidak ditampilkan.
- `points`: nilai langkah; bila tidak ditulis, dipakai `rubric.stepPoints`.

Langkah diperiksa **berurutan**. Langkah berikutnya baru diperiksa setelah langkah sebelumnya selesai. Bila beberapa langkah berurutan sudah terpenuhi, semuanya tercentang sekaligus.

## 4. Aturan selesai (`done`)

### 4.1 Menunjuk komponen dan terminal

**Komponen** bisa ditunjuk dengan salah satu cara berikut, diperiksa menurut urutan ini:

1. id di meja kerja, misalnya `bat` atau `mcb-pv` (lihat `initialCircuit` atau preset);
2. kategori katalog, misalnya `battery`, `scc-pwm`, `fuse`, atau `pv-module`;
3. alias kelompok: `scc`, `inverter`, `mcb`, `load`, `pv`;
4. id katalog, misalnya `mcb-dc-16a`.

Bila penunjuk cocok dengan beberapa komponen (misalnya `pv` untuk dua panel), aturan terpenuhi oleh **salah satu** dari komponen itu.

**Terminal** ditulis `komponen.terminal`, misalnya `scc.bat-pos` atau `battery.neg`. Id terminal paket Minimum:

| Komponen | Terminal |
|---|---|
| Panel surya, baterai | `pos`, `neg` |
| SCC PWM | `pv-pos`, `pv-neg`, `bat-pos`, `bat-neg`, `load-pos`, `load-neg` |
| MCB DC | `pos-in`, `pos-out`, `neg-in`, `neg-out` |
| MCB AC | `l-in`, `l-out`, `n-in`, `n-out` |
| Fuse baterai | `in`, `out` |
| Inverter off-grid | `dc-pos`, `dc-neg`, `ac-l`, `ac-n`, `pe` |
| Beban DC/AC | `a` (+ atau L), `b` (− atau N) |
| Busbar | `t1` … `t6` |
| Elektroda pentanahan | `pe` |

Id terminal paket lain ada di `src/data/catalog/*.json` (kunci `terminals`).

### 4.2 Jenis aturan

| `kind` | Kunci lain | Terpenuhi bila |
|---|---|---|
| `connected` | `a`, `b`, `throughSwitches` | Terminal `a` dan `b` tersambung lewat kabel dan busbar. Dengan `"throughSwitches": true`, sambungan juga boleh lewat MCB/fuse yang ON. |
| `placed` | `component`, `count` | Ada sedikitnya `count` (bawaan 1) komponen yang ditunjuk di meja |
| `switch` | `component`, `on` | Tuas MCB/fuse ON (`true`) atau OFF (`false`) |
| `condition` | `component`, `conditions` | Kondisi simulasi komponen termasuk daftar, misalnya `["tripped"]`. Kondisi: `ok`, `off`, `tripped`, `blown`, `cutoff`, `lvd`, `hvd`, `overload`, `fault`, `collapsed`, `damaged` |
| `multimeter` | `fn`, `red`, `black`, `expected`, `tolerancePct` | Multimeter terbuka pada fungsi `fn` (`vdc`, `vac`, `ohm`), kedua probe menempel di terminal `red`/`black` (bila disebut), dan bacaannya sesuai `expected` ± `tolerancePct` (bawaan 5%) |
| `clamp` | `mode`, `wire`, `expected`, `tolerancePct`, `minA` | Tang ampere terbuka pada mode `dc`/`ac`, menjepit kabel yang salah satu ujungnya di terminal `wire`, bacaan sesuai `expected` atau sedikitnya `minA` |
| `value` | `quantity`, `min`, `max` | Besaran saat ini di antara `min` dan `max` |
| `trend` | `quantity`, `direction`, `durationS`, `minDelta` | Besaran naik (`rise`) atau turun (`fall`) selama `durationS` detik **simulasi** terakhir, sedikitnya `minDelta` |
| `no-finding` | `severity` | Tidak ada temuan pemeriksaan rangkaian dengan keparahan ini atau lebih (`info`, `warning`, `danger`; bawaan `danger`) |
| `fault-found` | — | Peserta sudah menunjuk semua gangguan tersembunyi (hanya mode `troubleshoot`) |
| `all` | `rules` | Semua aturan di dalam `rules` terpenuhi |
| `any` | `rules` | Salah satu aturan di dalam `rules` terpenuhi |

**Besaran** (`quantity`):

| Nama | Arti |
|---|---|
| `soc-pct` | SoC baterai rata-rata, % |
| `battery-voltage-v` | Tegangan baterai rata-rata, V |
| `battery-current-a` | Arus baterai, A (positif = diisi) |
| `pv-power-w` | Daya semua modul PV, W |
| `load-power-w` | Daya semua beban, W |
| `sim-time-s` | Waktu simulasi sejak mulai, detik |

**Nilai harapan** (`expected`) berupa angka (misalnya `12.6`) atau acuan yang dihitung dari keadaan saat itu:

| Acuan | Arti |
|---|---|
| `{ "ref": "module-voc" }` | Voc satu modul PV pada iradiasi dan suhu saat ini |
| `{ "ref": "module-isc" }` | Isc satu modul PV pada iradiasi dan suhu saat ini |
| `{ "ref": "battery-ocv" }` | Tegangan rangkaian terbuka baterai pada SoC-nya |

Tambahkan `"factor"` untuk array, misalnya dua modul seri: `{ "ref": "module-voc", "factor": 2 }`.

Bila `red` disebut pada `vdc`, tanda bacaan ikut diperiksa: probe yang terbalik (bacaan negatif) tidak lulus. Tanpa `red`, yang dibandingkan nilai mutlaknya.

### 4.3 Contoh aturan

Multimeter membaca Voc array dua modul seri ±5%:

```json
{ "kind": "multimeter", "fn": "vdc", "red": "mcb-pv.pos-in", "black": "mcb-pv.neg-in",
  "expected": { "ref": "module-voc", "factor": 2 }, "tolerancePct": 5 }
```

SoC naik selama 10 menit simulasi:

```json
{ "kind": "trend", "quantity": "soc-pct", "direction": "rise", "durationS": 600 }
```

Beban menyala dan tidak ada temuan bahaya:

```json
{ "kind": "all", "rules": [
  { "kind": "value", "quantity": "load-power-w", "min": 10 },
  { "kind": "no-finding" }
] }
```

MCB beban trip saat beban lebih:

```json
{ "kind": "condition", "component": "mcb-ac", "conditions": ["tripped"] }
```

## 5. Gangguan tersembunyi (mode Cari Gangguan)

Gangguan tidak terlihat di meja kerja. Gangguan hanya mengubah perhitungan simulasi dan bacaan alat ukur, sehingga peserta harus mengukur untuk menemukannya.

```json
"faults": [
  { "kind": "wire-open", "target": "w4" },
  { "kind": "pv-shaded", "target": "pv1", "value": 0.8 }
],
"faultCount": 1
```

| `kind` | `target` | `value` (opsional) | Akibat di simulasi |
|---|---|---|---|
| `wire-open` | id kabel | — | Kabel tidak menghantar walau tampak terpasang |
| `fuse-blown` | id fuse | — | Fuse tidak menghantar walau tampak utuh |
| `mc4-loose` | id kabel PV | Resistansi kontak, Ω (bawaan 0,5) | Jatuh tegangan dan rugi daya pada kabel itu |
| `pv-shaded` | id modul PV | Bagian teduh 0–1 (bawaan 0,7) | Arus dan daya modul turun |
| `battery-weak-cell` | id baterai | — | Kapasitas tinggal 30%, resistansi dalam 5×, tegangan turun 0,6 V |
| `scc-setting-wrong` | id SCC PWM | — | SCC bekerja dengan setelan sistem 24 V pada baterai 12 V: terminal beban diputus, ambang pengisian salah |
| `mcb-wrong-rating` | id MCB | Arus pengenal sebenarnya, A (bawaan ¼ rating) | MCB trip pada arus yang jauh lebih kecil dari labelnya |
| `grid-outage` | id jaringan PLN | — | Jaringan tidak bertegangan |

Id kabel (`w1`, `w2`, …) dan id komponen dibaca dari `initialCircuit`. Pemeriksa berkas menolak sasaran yang tidak ada atau salah jenis. Bila `faults` kosong, instruktur memilih dari semua gangguan yang cocok dengan rangkaian.

**Saat memulai,** instruktur membuka **Pilihan instruktur** di dialog Skenario. Instruktur memilih satu atau beberapa gangguan, atau membiarkan **Acak** (sejumlah `faultCount` gangguan diacak dari daftar, dengan jenis yang diusahakan berbeda).

**Cara peserta menjawab:**

1. Ketuk kabel atau komponen yang dicurigai di meja.
2. Tekan **Tunjuk penyebab** dan pilih ikon jenis gangguan.
3. Tekan **Diagnosa**.

Jawaban benar mencabut gangguan itu (sistem "diperbaiki"). Jawaban dihitung **dengan bukti ukur** bila sebelumnya ada bacaan alat ukur yang tercatat.

## 6. Rubrik nilai

| Kunci | Bawaan | Arti |
|---|---|---|
| `stepPoints` | 10 | Nilai tiap langkah yang tidak menyebut `points` |
| `hintPenalty` | `[2, 5]` | Potongan petunjuk 1 dan petunjuk 2 (dijumlah) dari nilai langkah itu |
| `faultPoints` | 40 | Nilai menemukan semua gangguan dengan bukti ukur |
| `faultNoEvidencePoints` | 20 | Nilai menemukan gangguan tanpa bukti ukur |
| `wrongAnswerPenalty` | 5 | Potongan tiap jawaban gangguan yang salah |
| `damagePenalty` | 10 | Potongan tiap komponen atau kabel yang rusak |
| `dangerFindingPenalty` | 5 | Potongan tiap jenis temuan bahaya yang pernah muncul |
| `passPct` | 70 | Batas lulus, % |
| `timeLimitS` | — | Batas waktu yang disarankan (detik); hanya dicatat |

Skor dihitung sebagai berikut, dan tidak pernah kurang dari 0:

> skor = Σ (nilai langkah − potongan petunjuk) + nilai gangguan − potongan jawaban salah − potongan kerusakan − potongan temuan bahaya

Persentase = skor ÷ (Σ nilai langkah + `faultPoints` bila mode Cari Gangguan).

## 7. Hasil dan log

Saat peserta menekan **Selesai**, muncul ringkasan nilai. Dari ringkasan itu instruktur bisa:

- **Ekspor CSV:** berkas `hasil-<id>-<tanggal><jam>.csv`, berpemisah titik koma (langsung terbuka di Excel berbahasa Indonesia). Isinya:
  - ringkasan: peserta, skenario dan versinya, mode, waktu mulai/selesai, lama, nilai, hasil, gangguan, potongan;
  - tabel langkah: petunjuk, nilai, detik selesai;
  - log aksi bertanda waktu: detik nyata dan detik simulasi.
- **Cetak:** jendela cetak browser berisi ringkasan dan log aksi; bisa disimpan sebagai PDF.

Log mencatat:

- mulai dan selesai;
- langkah yang selesai dan petunjuk yang dibuka;
- komponen yang ditaruh atau dihapus, kabel yang dipasang atau dilepas, tuas ON/OFF;
- setiap bacaan alat ukur di titik yang baru;
- kejadian simulasi (trip, fuse putus, rusak);
- temuan bahaya;
- jawaban diagnosa.

## 8. Daftar periksa sebelum membagikan skenario

1. Tujuan paling banyak 2 kalimat; teks langkah satu kalimat perintah.
2. Uji sendiri sampai semua langkah tercentang, termasuk langkah `trend` (pakai kecepatan 60× atau 600×).
3. Untuk Cari Gangguan, coba setiap gangguan sekali dan pastikan gejalanya bisa diukur.
4. Naikkan `version` setiap kali skenario diubah.

## 9. Batasan saat ini

- Engine baru memodelkan paket Minimum (SCC PWM, inverter off-grid). Skenario paket Rekomendasi/Terbaik bisa ditulis, tetapi bagian yang berstatus `unsupported` tidak dihitung, sehingga gangguan `grid-outage` belum berdampak.
- Angka akibat gangguan (resistansi MC4 longgar 0,5 Ω, sel lemah 30% kapasitas / 5× resistansi / −0,6 V, bagian teduh 0,7) adalah asumsi. [PERLU VERIFIKASI]
- Waktu asesmen dihitung dengan jam nyata dan tetap berjalan saat simulasi dijeda.
- Skenario yang dibuka dari berkas hilang saat halaman dimuat ulang.
