# Arsitektur — Trainer Virtual PLTS (SimPLTS)

Status: kerangka proyek. Yang sudah ada kodenya: tipe dan skema katalog, tata letak 5 area yang masih kosong, dan aturan lint antarlapisan. Mesin simulasi (§2) masih **rancangan**; nama fungsi di §2 belum ada di kode.

Acuan: `AGENTS.md` (stack dan struktur folder), `docs/MODEL_FISIKA.md` §12 (penyelesaian jaringan dan langkah waktu), `docs/PRD.md` §3.2 (kontrak reset, jeda, simpan), `docs/UX.md` §2 (tata letak).

## 1. Lapisan

Panah berarti "boleh meng-import". Lapisan bawah tidak tahu apa pun tentang lapisan di atasnya.

```
┌──────────────────────────────────────────────────────────────────────┐
│ src/main.tsx, src/App.tsx          akar aplikasi: menyusun 5 area    │
└───────────────┬──────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/features/                      fitur UI (React)                  │
│   top-bar · tray · workbench · inspector · sim-controls              │
│   instruments · scenarios                                            │
└──────┬──────────────────┬───────────────────┬────────────────┬───────┘
       ▼                  ▼                   │                ▼
┌─────────────┐   ┌───────────────┐           │        ┌──────────────┐
│ src/ui/     │   │ src/store/    │           │        │ src/i18n/    │
│ komponen UI │   │ state Zustand │           │        │ teks tampil  │
│ kecil       │   │               │           │        │ (id.ts)      │
└──────┬──────┘   └───────┬───────┘           │        └──────────────┘
       │                  ▼                   ▼
       │          ┌──────────────────────────────────┐
       │          │ src/data/                        │
       │          │ katalog, skenario, profil (JSON) │
       │          │ + skema zod                      │
       │          └───────────────┬──────────────────┘
       ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/domain/                        fisika murni TypeScript           │
│ tipe katalog, model komponen, penyelesaian jaringan                  │
└──────────────────────────────────────────────────────────────────────┘
```

| Lapisan | Isi | Bergantung pada pustaka |
|---|---|---|
| `src/domain/` | Tipe (`types.ts`), model fisika, langkah simulasi. Fungsi murni: masukan → keluaran, tanpa efek samping. | tidak ada |
| `src/data/` | Berkas JSON, skema zod yang memvalidasinya, dan pemuatnya (`loadCatalog`). | zod |
| `src/store/` | State Zustand: rangkaian di meja kerja, keadaan simulasi, pilihan pengguna. Satu-satunya tempat yang memanggil langkah simulasi. | zustand |
| `src/i18n/` | Semua teks tampilan bahasa Indonesia. | tidak ada |
| `src/ui/` | Komponen kecil yang dipakai ulang (tombol, cip LCD, ikon status). Hanya menerima props. | react, lucide-react, motion |
| `src/features/` | Satu folder per fitur; membaca store lewat selector dan memanggil aksinya. | react, @xyflow/react, motion |

Setiap folder punya `index.ts` sebagai pintu ekspor. Import antarmodul memakai alias `@/` dan lewat pintu itu (`@/domain`, `@/features/tray`), bukan ke berkas di dalamnya.

Katalog mengalir satu arah: `src/data/catalog/*.json` → `catalogFileSchema` (zod, menolak field yang tidak dikenal) → `CatalogItem` (`src/domain/types.ts`). Tipe domain ditulis tangan; test `catalog.test.ts` memastikan tipe hasil skema sama persis dengan tipe domain.

## 2. Alur data satu langkah simulasi (rancangan)

```
 sim-controls        store                  data            domain              features
 (putar, kecepatan)  (Zustand)              (JSON)          (murni)             (workbench, inspector,
       │                │                     │                │                 instruments)
       │ 1 tick(dtNyata)│                     │                │                     │
       ├───────────────►│                     │                │                     │
       │                │ 2 dtSim = dtNyata × kecepatan        │                     │
       │                │ 3 parameter komponen, profil matahari│                     │
       │                │◄────────────────────┤                │                     │
       │                │ 4 step(rangkaian, keadaan, lingkungan, dtSim)              │
       │                ├─────────────────────────────────────►│                     │
       │                │                     │   a bangun simpul dari kabel         │
       │                │                     │   b cari titik kerja (bagi-dua)      │
       │                │                     │   c perbarui keadaan                 │
       │                │                     │   d catat kejadian                   │
       │                │ 5 { keadaan baru, bacaan, kejadian } │                     │
       │                │◄─────────────────────────────────────┤                     │
       │                │ 6 ganti state (tidak diubah di tempat)                     │
       │                ├───────────────────────────────────────────────────────────►│
       │                │                     │                │   7 gambar ulang lewat selector
```

1. Saat simulasi berjalan, `sim-controls` memanggil aksi `tick` di store pada tiap bingkai layar. Saat jeda, tidak ada `tick`.
2. Store mengubah waktu nyata menjadi waktu simulasi sesuai kecepatan (1x, 60x, 600x).
3. Store menyiapkan masukan: rangkaian (komponen dan kabel di meja kerja), parameter tiap komponen dari katalog, dan lingkungan (iradiasi, suhu, awan dari profil dan slider).
4. Store memanggil satu fungsi domain. Di dalamnya (MODEL_FISIKA §12):
   - a. kabel dan terminal diubah menjadi simpul listrik;
   - b. titik kerja DC dicari dengan pencarian bagi-dua, jatuh tegangan kabel dihitung ulang 3–5 putaran;
   - c. keadaan diperbarui: SoC, tahap pengisian, dosis termal MCB/fuse/kabel, LVD/BMS, kWh meter;
   - d. kejadian dicatat: trip, putus, rusak, galat.
   Percepatan dipecah menjadi sub-langkah di dalam domain supaya trip tidak terlewat (MODEL_FISIKA §12.4, PRD §3.2).
5. Domain mengembalikan keadaan baru, bacaan tiap terminal (V, A, W), dan daftar kejadian. Domain tidak menyimpan apa pun.
6. Store mengganti state dengan keadaan baru.
7. Fitur menggambar ulang hanya bagian yang selectornya berubah: cip LCD dan ikon status di meja kerja, angka di inspeksi, tampilan alat ukur, toast kejadian.

Akibat pemisahan ini: langkah simulasi bisa diuji dengan Vitest tanpa browser, dan hasilnya sama untuk masukan yang sama.

## 3. Aturan ketergantungan

| Lapisan | Boleh meng-import | Tidak boleh meng-import |
|---|---|---|
| `domain` | `domain` | `data`, `store`, `i18n`, `ui`, `features`; react, react-dom, zustand, @xyflow/react, motion, lucide-react |
| `data` | `domain`, zod | `store`, `i18n`, `ui`, `features`; pustaka tampilan dan state di atas |
| `i18n` | – | semua lapisan lain; pustaka tampilan dan state di atas |
| `store` | `domain`, `data`, zustand | `ui`, `features` |
| `ui` | `domain` (tipe), `i18n`, react | `store`, `features` |
| `features` | semua lapisan di bawahnya | – |

Kolom "tidak boleh" dijaga otomatis oleh aturan `no-restricted-imports` di `eslint.config.js`; pelanggaran menggagalkan `npm run lint`. Tiga aturan berikut belum dijaga lint dan diperiksa saat review:

- Fitur meng-import fitur lain hanya lewat `index.ts`-nya.
- `ui` mengambil data dari `domain` hanya berupa tipe.
- Teks tampilan tidak ditulis langsung di komponen, tetapi diambil dari `src/i18n/id.ts`.

Aturan lain dari `AGENTS.md` yang berlaku di semua lapisan: satuan di nama (`voltageV`, `socPct`), satu file di bawah 250 baris, dan setiap fungsi di `src/domain` punya unit test.

## 4. Uji

| Jenis | Alat | Letak | Perintah |
|---|---|---|---|
| Unit (domain, data) | Vitest | `src/**/*.test.ts` di samping kodenya | `npm run test` |
| Alur di browser | Playwright (Chromium, 1366x768) | `e2e/*.spec.ts` | `npm run test:e2e` |

`npm run check` menjalankan lint, test unit, dan build. Uji Playwright dijalankan terpisah.
