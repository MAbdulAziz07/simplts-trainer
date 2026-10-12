# Arsitektur — Trainer Virtual PLTS (SimPLTS)

Status: mesin simulasi sudah tersambung ke tampilan. Yang sudah ada kodenya: katalog dan skemanya, model komponen, netlist dan pemeriksaan rangkaian, solver dan langkah waktu, meja kerja, kendali simulasi, alat ukur, temuan pemeriksaan, dan grafik 24 jam. Engine baru memodelkan paket Minimum (SCC PWM dan inverter off-grid); SCC MPPT, inverter grid-tie dan hibrida, serta SPD berstatus `unsupported`. Belum ada: skenario dan mode terpandu, PWA.

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
│   instruments · scenarios · terminal-editor                          │
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
       │          │ katalog, proyek, preset (JSON)   │
       │          │ + skema zod                      │
       │          └───────────────┬──────────────────┘
       ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ src/domain/                        fisika murni TypeScript           │
│ catalog · components · circuit · engine · instruments                │
└──────────────────────────────────────────────────────────────────────┘
```

| Lapisan | Isi | Bergantung pada pustaka |
|---|---|---|
| `src/domain/` | `catalog/` tipe katalog; `components/` model komponen (PV, baterai, SCC, inverter, kabel, proteksi, beban, matahari); `circuit/` netlist, aturan sambungan, pemeriksaan rangkaian (`validateCircuit`); `engine/` titik kerja dan langkah waktu (`stepSimulation`), fungsi reset; `instruments/` bacaan multimeter dan tang ampere. Fungsi murni: masukan → keluaran, tanpa efek samping. | tidak ada |
| `src/data/` | `catalog/` berkas JSON katalog, skema zod, dan pemuatnya (`loadCatalog`); `project/` skema dan validasi berkas rangkaian `.simplts.json`; `presets/` preset tiga paket. `profiles/` dan `scenarios/` masih kosong. | zod |
| `src/store/` | State Zustand (§2.2): rangkaian di meja kerja, keadaan simulasi, alat ukur, temuan, riwayat grafik, toast. Satu-satunya tempat yang memanggil langkah simulasi. | zustand |
| `src/i18n/` | Semua teks tampilan bahasa Indonesia (`id.ts`, dipecah ke `id-sim.ts` dan `id-instruments.ts`). | tidak ada |
| `src/ui/` | Komponen kecil yang dipakai ulang (gambar komponen, titik terminal) serta ukuran, warna terminal, dan efek gambar. Hanya menerima props. | react, lucide-react |
| `src/features/` | Satu folder per fitur; membaca store lewat selector dan memanggil aksinya. | react, @xyflow/react, lucide-react |

Setiap folder punya `index.ts` sebagai pintu ekspor. Import antarmodul memakai alias `@/` dan lewat pintu itu (`@/domain`, `@/features/tray`), bukan ke berkas di dalamnya.

Katalog mengalir satu arah: `src/data/catalog/*.json` → `catalogFileSchema` (zod, menolak field yang tidak dikenal) → `CatalogItem` (`src/domain/types.ts`). Tipe domain ditulis tangan; test `catalog.test.ts` memastikan tipe hasil skema sama persis dengan tipe domain.

## 2. Alur data satu langkah simulasi

```
 sim-controls        store (Zustand)         data            domain              features
 (putar, kecepatan)  simStore                (JSON)          (murni)             (workbench, instruments,
       │                │                      │                │                 inspector, sim-controls)
       │ 1 setRunning   │                      │                │                     │
       ├───────────────►│                      │                │                     │
       │                │ 2 requestAnimationFrame → advance(dtNyata)                  │
       │                │ 3 item katalog (dimuat sekali), rangkaian, lingkungan       │
       │                │◄─────────────────────┤                │                     │
       │                │ 4 stepSimulation(rangkaian, keadaan, lingkungan, dtNyata, kecepatan)
       │                ├──────────────────────────────────────►│                     │
       │                │                      │   a kenali subsistem dari kabel      │
       │                │                      │   b cari titik kerja (bagi-dua)      │
       │                │                      │   c perbarui keadaan                 │
       │                │                      │   d catat kejadian                   │
       │                │ 5 { state, snapshot, simulatedS }     │                     │
       │                │◄──────────────────────────────────────┤                     │
       │                │ 6 ganti state; tuas MCB yang trip → OFF di circuitStore     │
       │                ├────────────────────────────────────────────────────────────►│
       │                │                      │                │   7 gambar ulang lewat selector
```

1. Tombol putar/jeda di `sim-controls` hanya memanggil `simStore.setRunning`. Selama berjalan, `simStore` sendiri yang memutar `requestAnimationFrame` (`store/sim-loop.ts`) dan memanggil `advance` paling sering 20 kali per detik; jeda antarbingkai dijepit 0,25 s. Saat jeda tidak ada `advance`.
2. Kecepatan (1×, 60×, 600×, 3600×) diteruskan ke domain sebagai `speed`; waktu simulasi yang ditempuh = waktu nyata × kecepatan.
3. Store menyiapkan masukan: rangkaian dari `circuitStore` (komponen dengan item katalognya, kabel, tuas MCB, setelan daya beban) dan lingkungan dari `store/sim-env.ts` (jam, awan, serta iradiasi dan suhu yang mengikuti profil matahari MODEL_FISIKA §11 atau disetel tangan).
4. Store memanggil `stepSimulation`. Di dalamnya (MODEL_FISIKA §12):
   - a. kabel dan terminal diubah menjadi netlist dan subsistem (`recognizeSubsystems`);
   - b. titik kerja DC dicari dengan pencarian bagi-dua, jatuh tegangan kabel dihitung ulang 5 putaran (`solveOperatingPoint`);
   - c. keadaan diperbarui: SoC, tahap pengisian, dosis termal MCB/fuse/kabel, beban lebih, LVD/BMS, kWh meter;
   - d. kejadian dicatat: trip, putus, rusak, galat.
   Percepatan dipecah menjadi sub-langkah di dalam domain supaya trip tidak terlewat (MODEL_FISIKA §12.4, PRD §3.2). Store membatasi 80 sub-langkah per hitungan, jadi saat arus menuju trip simulasi melambat sendiri.
5. Domain mengembalikan `{ state, snapshot, simulatedS }`: keadaan baru (`SimState`), dan `Snapshot` berisi V/I/P tiap net dan terminal, status tiap komponen dan kabel (termasuk arus kabel bertanda), energi, dan kejadian. Domain tidak menyimpan apa pun.
6. Store mengganti state dengan keadaan baru. Tuas MCB yang trip ditulis OFF ke `circuitStore` tanpa menambah langkah undo.
7. Fitur menggambar ulang hanya bagian yang selectornya berubah. Selector mengembalikan nilai sederhana (teks atau angka yang sudah dibulatkan), sehingga LED, LCD, bar SoC, dan animasi kabel tidak digambar ulang tiap hitungan.

Akibat pemisahan ini: langkah simulasi bisa diuji dengan Vitest tanpa browser, dan hasilnya sama untuk masukan yang sama.

### 2.1 Saat rangkaian berubah

`circuitStore` adalah acuan rangkaian: dokumen tak-berubah (`CircuitDoc`) dengan riwayat undo/redo. `simStore` berlangganan padanya:

- Perubahan listrik (komponen, kabel, tuas, setelan daya beban; bukan posisi atau putaran) → `reconcileSimState` menyesuaikan `SimState` (catatan komponen dan kabel yang dihapus dibuang, baterai baru mulai dari SoC awal, tuas mengikuti meja kerja), lalu rangkaian dihitung ulang dengan `dtS = 0`. Karena itu alat ukur tetap membaca saat simulasi dijeda.
- Rangkaian lain dimuat (berkas atau preset) → keadaan awal baru, simulasi dijeda (PRD §3.2).
- Reset percobaan (`resetExperiment`) → rusak, trip, SoC, dan jam kembali ke awal; rangkaian dan setelan dipertahankan.
- Perbaikan per komponen (`repairComponent`, `repairWire`) memakai fungsi reset domain (`replaceFuse`, `resetBms`, `replaceComponent`, …); MCB trip dipulihkan lewat tuasnya.

### 2.2 Store

| Store | Isi | Diperbarui |
|---|---|---|
| `circuitStore` | Dokumen rangkaian, pilihan, riwayat undo, paket, tingkat validasi sambungan | Aksi pengguna; disimpan otomatis ke `localStorage` |
| `simStore` | `SimState`, `Snapshot`, lingkungan, jam, kecepatan, putar/jeda | Tiap hitungan simulasi; tiap rangkaian atau lingkungan berubah |
| `instrumentStore` | Alat yang dibuka, fungsi, tempat probe dan jepitan, bacaan | Dicuplik 2 kali per detik selama ada alat terbuka |
| `findingsStore` | Temuan `validateCircuit` dan riwayat pemasangan kabel (`wiringLog`) | Tiap rangkaian berubah; 2 kali per detik saat simulasi berjalan, dengan arus terukur |
| `chartStore` | Daya PV, daya beban, dan SoC per ruas 5 menit (288 ruas) | Tiap simulasi maju |
| `toastStore` | Pesan singkat yang hilang sendiri | Dipanggil fitur |
| `uiStore` | Tata letak yang tidak ikut tersimpan: baki dilipat atau tidak | Aksi pengguna |

Store turunan (`instrumentStore`, `findingsStore`, `chartStore`) hanya membaca `circuitStore` dan `simStore`; keduanya tidak tahu store turunan itu ada.

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

- Fitur meng-import fitur lain hanya lewat `index.ts`-nya, dan tidak boleh melingkar. Saat ini: `workbench` → `instruments` (lapisan alat ukur, penanda probe dan jepitan), `workbench` → `inspector` (tombol temuan), `inspector` → `sim-controls` (slider), `top-bar` → `sim-controls` (tombol reset percobaan).
- `ui` mengambil data dari `domain` hanya berupa tipe.
- Teks tampilan tidak ditulis langsung di komponen, tetapi diambil dari `src/i18n/`.

Aturan lain dari `AGENTS.md` yang berlaku di semua lapisan: satuan di nama (`voltageV`, `socPct`), satu file di bawah 250 baris, dan setiap fungsi di `src/domain` punya unit test.

## 4. Uji

| Jenis | Alat | Letak | Perintah |
|---|---|---|---|
| Unit (domain, data, store, logika fitur) | Vitest | `src/**/*.test.ts` di samping kodenya | `npm run test` |
| Alur di browser | Playwright (Chromium, 1366x768) | `e2e/*.spec.ts` | `npm run test:e2e` |

`npm run check` menjalankan lint, test unit, dan build. Uji Playwright dijalankan terpisah.
