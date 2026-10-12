// Semua teks yang tampil ke pengguna, bahasa Indonesia.
import { instruments } from './id-instruments';
import { findingsPanel, sim, status } from './id-sim';

export const id = {
  appName: 'Trainer Virtual PLTS',
  areas: {
    topBar: 'Bilah atas',
    tray: 'Baki komponen',
    workbench: 'Meja kerja',
    inspector: 'Inspeksi',
    simControls: 'Kendali simulasi',
  },
  packages: { min: 'Minimum', rek: 'Rekomendasi', best: 'Terbaik' },
  packageLabel: 'Paket alat',
  levels: { beginner: 'Pemula', expert: 'Mahir' },
  levelLabel: 'Tingkat validasi sambungan',
  levelHints: {
    beginner: 'Pemula: sambungan yang mustahil ditolak',
    expert: 'Mahir: semua sambungan diizinkan, akibatnya terlihat saat simulasi',
  },
  // Kunci = alasan `checkConnection` (src/domain/circuit/connect-rules.ts). Satu kalimat singkat.
  connectionRejections: {
    'unknown-terminal': 'Terminal tidak ditemukan',
    'same-terminal': 'Pilih terminal lain sebagai tujuan',
    'duplicate-wire': 'Kedua terminal sudah tersambung',
    'terminal-full': 'Terminal penuh, cabangkan lewat busbar',
    data: 'Terminal data hanya untuk kabel data',
    earth: 'PE hanya disambung ke PE',
    'dc-ac': 'DC tidak disambung ke AC',
    polarity: 'Kutub + tidak disambung ke kutub −',
    'line-neutral': 'Fasa (L) tidak disambung ke netral (N)',
  },
  tray: {
    groups: {
      source: 'Sumber',
      control: 'Pengatur',
      storage: 'Baterai',
      inverter: 'Inverter',
      protection: 'Proteksi',
      distribution: 'Distribusi',
      load: 'Beban',
    },
    add: (name: string) => `Tambah ${name}`,
  },
  workbench: {
    empty: 'Seret komponen dari baki ke sini',
    component: (name: string, id: string) => `${name} (${id})`,
    terminal: (label: string) => `Terminal ${label}`,
  },
  file: {
    save: 'Simpan',
    open: 'Buka',
    preset: 'Preset',
    saveHint: 'Simpan rangkaian ke berkas .json',
    openHint: 'Buka rangkaian dari berkas .json',
    presetHint: 'Muat preset: komponen paket tertata di meja, belum dirangkai',
    saved: 'Rangkaian disimpan ke berkas',
    opened: 'Rangkaian dibuka',
    presetLoaded: (name: string) => `Preset ${name} dimuat`,
    // Kunci = `ProjectRejection` (src/data/project/validate.ts).
    rejections: {
      'not-project': 'Bukan berkas rangkaian SimPLTS',
      'unsupported-version': 'Versi berkas tidak didukung',
      invalid: 'Isi berkas tidak sah',
    },
  },
  switch: {
    on: 'ON',
    off: 'OFF',
    tripped: 'TRIP',
    label: (name: string) => `Tuas ${name}`,
  },
  actions: {
    toolbar: 'Alat meja kerja',
    undo: 'Urungkan (Ctrl+Z)',
    redo: 'Ulangi (Ctrl+Y)',
    rotate: 'Putar 90° (R)',
    remove: 'Hapus (Delete)',
    zoomIn: 'Perbesar',
    zoomOut: 'Perkecil',
    fit: 'Paskan ke layar',
    selectMode: 'Pilih banyak: seret kotak di meja',
  },
  wire: {
    properties: (id: string) => `Kabel ${id}`,
    cableType: 'Jenis kabel',
    area: 'Penampang',
    areaOption: (areaMm2: number) => `${areaMm2.toLocaleString('id-ID')} mm²`,
    length: 'Panjang kabel (m)',
    lengthUnit: 'm',
    shorter: 'Kurangi panjang',
    longer: 'Tambah panjang',
    remove: 'Lepas kabel',
  },
  // Halaman pengembang /dev/terminal-editor; tidak ikut ke build produksi.
  terminalEditor: {
    title: 'Editor terminal',
    devOnly: 'Mode pengembang',
    hint: 'Pilih terminal, lalu klik letaknya pada gambar. Titik bisa diseret.',
    items: 'Komponen',
    terminals: 'Terminal',
    unplaced: 'belum ditandai',
    clear: (label: string) => `Kosongkan posisi ${label}`,
    applyToSiblings: (count: number) => `Terapkan juga ke ${count} item bergambar sama`,
    save: 'Simpan ke katalog',
    reset: 'Batalkan perubahan',
    dirty: 'Belum disimpan',
    saved: (count: number) => `Tersimpan ke ${count} item`,
    saveFailed: (reason: string) => `Gagal menyimpan: ${reason}`,
    backToApp: 'Kembali ke aplikasi',
    progress: (placed: number, total: number) => `${placed}/${total}`,
  },
  findingsPanel,
  instruments,
  sim,
  status,
  severities: {
    info: 'Info',
    warning: 'Peringatan',
    danger: 'Bahaya',
  },
  // Kunci = kode temuan `validateCircuit` (src/domain/circuit/types.ts). `message` maksimal 8 kata.
  findings: {
    'reverse-polarity': {
      message: 'Polaritas terbalik',
      explanation:
        'Kutub positif alat tersambung ke kutub negatif sumber, atau sebaliknya. Alat tanpa proteksi polaritas terbalik akan rusak. Tukar kedua kabelnya.',
    },
    'short-circuit': {
      message: 'Hubung singkat pada sumber',
      explanation:
        'Kutub positif dan negatif sumber bertemu tanpa beban di antaranya. Arus sangat besar mengalir, kabel panas, dan proteksi trip. Lepas kabel yang menyatukan kedua kutub.',
    },
    'pv-direct': {
      message: 'Modul surya langsung ke inverter atau beban',
      explanation:
        'Tegangan modul surya berubah mengikuti cahaya dan bisa jauh di atas tegangan kerja alat. Sambungkan modul ke masukan PV pada SCC.',
    },
    'pv-voc-over-limit': {
      message: 'Voc array melebihi batas masukan PV',
      explanation:
        'Pada suhu sel terendah, tegangan rangkaian terbuka array lebih tinggi daripada batas alat. Kurangi jumlah modul seri atau pakai alat dengan batas Voc lebih tinggi.',
    },
    'breaker-overcurrent': {
      message: 'Arus melebihi rating MCB atau fuse',
      explanation:
        'Proteksi akan trip atau putus saat rangkaian bekerja. Pilih rating di atas arus kerja tetapi tetap di bawah KHA kabel.',
    },
    'cable-overcurrent': {
      message: 'Arus melebihi KHA kabel',
      explanation:
        'Kabel terlalu kecil untuk arus yang lewat sehingga panas dan isolasinya bisa rusak. Pakai penampang yang lebih besar.',
    },
    'cable-unknown': {
      message: 'Kabel tidak ada di katalog',
      explanation:
        'Jenis atau penampang kabel ini tidak ada di katalog, sehingga kuat hantar arusnya tidak bisa diperiksa. Ganti dengan kabel dari baki.',
    },
    'system-voltage-mismatch': {
      message: 'Tegangan sistem tidak cocok',
      explanation:
        'Tegangan bank baterai (12, 24, atau 48 V) berbeda dari tegangan kerja alat. Samakan tegangan baterai dengan SCC, inverter, dan beban DC.',
    },
    'pv-before-battery': {
      message: 'PV tersambung sebelum baterai',
      explanation:
        'SCC mengenali tegangan sistem dari baterai. Urutan pasang: baterai, lalu PV, lalu beban. Urutan lepas sebaliknya.',
    },
    'open-circuit': {
      message: 'Rangkaian terbuka',
      explanation:
        'Baru satu sisi dari pasangan terminal yang dipasangi kabel, sehingga arus belum bisa mengalir. Pasang kabel pada terminal pasangannya.',
    },
    'ac-load-on-dc': {
      message: 'Beban AC di keluaran DC',
      explanation:
        'Beban AC memerlukan 220 V AC dari inverter atau jaringan. Pindahkan beban ke keluaran AC inverter.',
    },
    'gridtie-without-grid': {
      message: 'Inverter grid-tie tanpa jaringan',
      explanation:
        'Inverter grid-tie hanya bekerja bila terminal L dan N tersambung ke jaringan PLN. Tanpa jaringan, inverter tidak menyalurkan daya.',
    },
    'pe-not-connected': {
      message: 'PE belum tersambung ke pembumian',
      explanation:
        'Badan alat tidak terhubung ke elektrode pembumian sehingga berbahaya saat terjadi gangguan isolasi. Sambungkan terminal PE ke rel PE dan elektrode pembumian.',
    },
    'live-rewiring': {
      message: 'Merangkai saat MCB masih ON',
      explanation:
        'Kabel dipasang atau dilepas ketika rangkaian masih bertegangan. Matikan semua MCB sebelum mengubah rangkaian.',
    },
  },
} as const;
