// Teks inspektur: rating utama (simbol + nama) dan penjelasan singkat tiap kategori komponen.
// Penjelasan hanya tampil lewat tombol "?" (docs/PRD.md US27).
export const inspector = {
  help: (name: string) => `Penjelasan ${name}`,
  remove: (name: string) => `Hapus ${name}`,
  removeHint: 'Hapus dari meja (bisa dibatalkan)',
  ratings: 'Rating utama',
  // Kunci = `RatingKey` (src/features/inspector/ratings.ts). `symbol` tampil sebagai tanda.
  rating: {
    pmax: { symbol: 'Pmax', name: 'Daya puncak' },
    voc: { symbol: 'Voc', name: 'Tegangan rangkaian terbuka' },
    isc: { symbol: 'Isc', name: 'Arus hubung singkat' },
    vmp: { symbol: 'Vmp', name: 'Tegangan pada daya puncak' },
    systemV: { symbol: 'Vsis', name: 'Tegangan sistem baterai' },
    nominalV: { symbol: 'Un', name: 'Tegangan nominal' },
    chargeA: { symbol: 'Iisi', name: 'Arus isi maksimum' },
    dischargeA: { symbol: 'Ilepas', name: 'Arus lepas maksimum' },
    loadA: { symbol: 'Ibeban', name: 'Arus terminal beban maksimum' },
    pvVocMax: { symbol: 'Voc maks', name: 'Batas Voc masukan PV' },
    pvVocMax12: { symbol: 'Voc maks 12', name: 'Batas Voc masukan PV pada sistem 12 V' },
    pvVocMax24: { symbol: 'Voc maks 24', name: 'Batas Voc masukan PV pada sistem 24 V' },
    mpptMin: { symbol: 'MPPT min', name: 'Tegangan MPPT terendah' },
    mpptMax: { symbol: 'MPPT maks', name: 'Tegangan MPPT tertinggi' },
    pvPowerMax: { symbol: 'PV maks', name: 'Daya PV maksimum' },
    mpptRange: { symbol: 'MPPT', name: 'Rentang tegangan MPPT' },
    inputA: { symbol: 'Imasuk', name: 'Arus masukan DC maksimum' },
    capacity: { symbol: 'C', name: 'Kapasitas' },
    acPower: { symbol: 'Pac', name: 'Daya AC nominal' },
    dcV: { symbol: 'Vdc', name: 'Tegangan DC nominal' },
    acV: { symbol: 'Vac', name: 'Tegangan keluaran AC' },
    lvd: { symbol: 'LVD', name: 'Putus tegangan baterai rendah' },
    ratedA: { symbol: 'In', name: 'Arus pengenal' },
    curve: { symbol: 'Kurva', name: 'Kurva trip' },
    fuseClass: { symbol: 'Kelas', name: 'Kelas fuse' },
    breaking: { symbol: 'Icu', name: 'Kemampuan memutus' },
    uc: { symbol: 'Uc', name: 'Tegangan kerja terus-menerus' },
    up: { symbol: 'Up', name: 'Tingkat proteksi tegangan' },
    surge: { symbol: 'In', name: 'Arus lucut nominal' },
    inputs: { symbol: 'String', name: 'Jumlah masukan string' },
    stringFuse: { symbol: 'Fuse', name: 'Fuse tiap string' },
    positions: { symbol: 'Posisi', name: 'Jumlah posisi terminal' },
    circuits: { symbol: 'Sirkuit', name: 'Jumlah sirkuit keluar' },
    circuitA: { symbol: 'MCB', name: 'MCB tiap sirkuit' },
    earthR: { symbol: 'R', name: 'Tahanan pembumian' },
    maxPower: { symbol: 'Pmaks', name: 'Daya maksimum' },
    frequency: { symbol: 'f', name: 'Frekuensi' },
    maxA: { symbol: 'Imaks', name: 'Arus maksimum' },
    maxV: { symbol: 'Umaks', name: 'Tegangan maksimum' },
    accuracy: { symbol: 'Kelas', name: 'Kelas akurasi' },
  },
  // Kunci = kategori katalog. Satu sampai dua kalimat.
  explanations: {
    'pv-module':
      'Mengubah cahaya matahari menjadi listrik DC. Tegangan dan arusnya berubah mengikuti iradiasi dan suhu, jadi selalu disambung lewat SCC.',
    'scc-pwm':
      'Mengatur pengisian baterai dari panel dengan memutus-sambung arus. Pasang baterai dulu, lalu panel, lalu beban.',
    'scc-mppt':
      'Mengatur pengisian baterai sambil mencari titik daya maksimum panel, sehingga tegangan panel boleh lebih tinggi daripada baterai.',
    battery:
      'Menyimpan energi listrik. Tegangannya turun saat dibebani dan saat hampir kosong; hubung singkat di kutubnya sangat berbahaya.',
    bms: 'Memutus baterai litium bila tegangan sel atau arusnya di luar batas, lalu harus direset.',
    'inverter-offgrid':
      'Mengubah DC baterai menjadi AC 220 V untuk beban. Mati sendiri bila tegangan baterai terlalu rendah atau bebannya berlebih.',
    'inverter-gridtie':
      'Menyalurkan daya panel langsung ke jaringan PLN. Berhenti bekerja bila jaringan padam.',
    'inverter-hybrid':
      'Menggabungkan pengisi baterai dari panel, inverter, dan masukan jaringan PLN dalam satu alat.',
    'mcb-dc':
      'Memutus rangkaian DC saat arus melebihi ratingnya. Tuas ON/OFF juga dipakai untuk mengisolasi sebelum merangkai.',
    'mcb-ac': 'Memutus rangkaian AC saat arus melebihi ratingnya. Fasa dan netral diputus bersama.',
    fuse: 'Putus sekali saat arus berlebih dan harus diganti. Dipasang sedekat mungkin dengan sumbernya.',
    spd: 'Mengalihkan lonjakan tegangan (mis. petir) ke pembumian supaya tidak merusak alat.',
    combiner:
      'Menggabungkan beberapa string panel menjadi satu keluaran, dengan fuse untuk tiap string.',
    cable: 'Menghantarkan arus antarterminal. Penampang yang terlalu kecil membuat kabel panas.',
    'kwh-meter': 'Mencatat energi yang lewat, terpisah untuk impor dan ekspor.',
    busbar: 'Rel penyambung: semua terminalnya tersambung, dipakai untuk mencabangkan kabel.',
    grounding:
      'Elektrode pembumian. Semua terminal PE disambung ke sini agar badan alat aman disentuh.',
    'load-panel': 'Membagi masukan AC ke beberapa sirkuit beban, masing-masing dengan MCB sendiri.',
    'load-dc':
      'Beban DC yang dayanya bisa diatur. Daya sebenarnya mengikuti tegangan yang sampai di terminalnya.',
    'load-ac':
      'Beban AC 220 V yang dayanya bisa diatur. Harus disambung ke keluaran AC inverter atau jaringan.',
    grid: 'Jaringan PLN 220 V sebagai sumber AC; bisa padam sewaktu-waktu.',
  },
} as const;

// Keluarga varian: satu ubin di baki, jenis dan arus pengenal dipilih di inspektur.
// Kunci = `VariantFamily` dan `VariantKind` (src/domain/catalog/variants.ts).
export const variant = {
  families: { mcb: 'MCB', panel: 'Panel Listrik' },
  kind: 'Jenis',
  ratedCurrent: 'Arus pengenal',
  kinds: {
    dc: 'DC',
    ac: 'AC',
    'dc+': 'DC+',
    'dc-': 'DC−',
    acL: 'L',
    acN: 'N',
    pe: 'PE',
    'load-panel': 'Panel Beban',
  },
  kindTitles: {
    dc: 'MCB arus searah',
    ac: 'MCB arus bolak-balik',
    'dc+': 'Busbar kutub positif DC',
    'dc-': 'Busbar kutub negatif DC',
    acL: 'Busbar fasa AC',
    acN: 'Busbar netral AC',
    pe: 'Busbar pembumian',
    'load-panel': 'Panel distribusi AC dengan MCB tiap sirkuit',
  },
  ratingA: (ratedCurrentA: number) => `${ratedCurrentA} A`,
} as const;

// Pengaturan parameter manual di inspektur. Kunci `issues` = `ParamIssueCode` (src/domain).
export const params = {
  edit: 'Atur parameter',
  done: 'Selesai mengatur',
  editor: 'Parameter komponen',
  defaultValue: (value: string) => `Default: ${value}`,
  reset: (name: string) => `Kembalikan ${name} ke default`,
  resetAll: 'Kembalikan semua ke default',
  fixed: 'Tetap: terikat bentuk komponen atau model fisikanya',
  tuned: 'Parameter diubah dari default',
  issues: {
    unknown: 'Parameter tidak dikenal',
    fixed: 'Parameter ini tidak bisa diubah',
    'not-number': 'Isi dengan angka',
    'not-option': 'Pilih dari daftar',
    'not-positive': 'Harus lebih dari 0',
    'too-large': 'Terlalu besar (maks. 10× default)',
    'pv-vmp-above-voc': 'Vmp harus di bawah Voc',
    'pv-imp-above-isc': 'Arus Imp harus di bawah Isc',
    'load-max-below-min': 'Di bawah daya minimum beban',
  },
} as const;
