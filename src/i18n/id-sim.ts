// Teks kendali simulasi dan umpan balik di meja kerja; digabung ke `id` di ./id.ts.
const number = (value: number, digits = 0): string =>
  value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const sim = {
  play: 'Jalankan simulasi',
  pause: 'Jeda simulasi',
  speed: 'Kecepatan simulasi',
  speedOption: (multiple: number) => `${multiple}×`,
  speedHint: (multiple: number) => {
    if (multiple === 1) return 'Waktu nyata';
    return multiple >= 3600
      ? `1 detik = ${number(multiple / 3600)} jam simulasi`
      : `1 detik = ${number(multiple / 60)} menit simulasi`;
  },
  clock: 'Jam',
  irradiance: 'Iradiasi',
  irradianceValue: (irradianceWm2: number) => `${number(irradianceWm2)} W/m²`,
  cloud: 'Awan',
  cloudValue: (coverPct: number) => `${number(coverPct)}%`,
  ambient: 'Suhu lingkungan',
  ambientValue: (tempC: number) => `${number(tempC, 1)} °C`,
  auto: (label: string) => `${label}: ikuti jam dan awan`,
  autoMark: 'A',
  reset: 'Reset percobaan',
  resetConfirm: 'Ketuk lagi untuk mereset percobaan',
  resetMark: 'Reset',
  resetConfirmMark: 'Reset?',
  resetDone: 'Percobaan direset',
} as const;

// `conditions` ≤ 6 huruf: tampil di tanda status node (docs/UX.md §2.4: ikon + teks singkat).
export const status = {
  led: {
    off: 'mati',
    green: 'normal',
    'green-blink': 'mengisi',
    yellow: 'peringatan',
    red: 'gangguan',
  },
  ledLabel: (name: string, state: string) => `Lampu ${name}: ${state}`,
  lcdLabel: (name: string) => `LCD ${name}`,
  lcdOff: 'padam',
  lcdBattery: 'BAT',
  lcdPv: 'PV',
  volt: (value: string) => `${value} V`,
  ampere: (value: string) => `${value} A`,
  socLabel: (name: string) => `SoC ${name}`,
  soc: (socPct: number) => `${socPct}%`,
  charge: { charging: 'mengisi', discharging: 'melepas', idle: 'diam' },
  conditions: {
    tripped: 'TRIP',
    blown: 'PUTUS',
    cutoff: 'BMS',
    lvd: 'LVD',
    hvd: 'HVD',
    overload: 'LEBIH',
    fault: 'GALAT',
    collapsed: 'DROP',
    damaged: 'RUSAK',
    unsupported: 'N/A',
  },
  conditionHints: {
    tripped: 'MCB trip',
    blown: 'Fuse putus',
    cutoff: 'BMS memutus baterai',
    lvd: 'Inverter mati: tegangan baterai rendah',
    hvd: 'Inverter mati: tegangan baterai tinggi',
    overload: 'Mati karena beban lebih',
    fault: 'Galat: tegangan PV di atas batas',
    collapsed: 'Daya tidak tersedia, tegangan runtuh',
    damaged: 'Komponen rusak',
    unsupported: 'Belum disimulasikan',
  },
  repair: {
    blown: (name: string) => `Ganti ${name}`,
    cutoff: (name: string) => `Reset BMS ${name}`,
    overload: (name: string) => `Reset beban lebih ${name}`,
    damaged: (name: string) => `Ganti ${name}`,
  },
  repairWire: (id: string) => `Ganti kabel ${id}`,
  loadPower: 'Daya beban',
  loadPowerValue: (powerW: number) => `${number(powerW)} W`,
  loadPowerSetting: (name: string) => `Setelan daya ${name}`,
  wireDamaged: 'Kabel rusak',
} as const;

// Tombol segitiga temuan di pojok meja kerja; teks tiap temuan ada di `findings` (./id.ts).
export const findingsPanel = {
  button: (count: number) =>
    count === 0 ? 'Tidak ada temuan pemeriksaan' : `${count} temuan pemeriksaan`,
  list: 'Temuan pemeriksaan',
  show: (message: string) => `${message}: tunjukkan di meja`,
  explain: (message: string) => `Penjelasan: ${message}`,
  more: (count: number) => `+${count}`,
} as const;

// Grafik 24 jam yang dibuka dari bilah simulasi.
export const chart = {
  open: 'Grafik 24 jam',
  close: 'Tutup grafik',
  title: 'Grafik 24 jam simulasi',
  power: 'Daya (W)',
  soc: 'SoC baterai (%)',
  series: { pv: 'PV', load: 'Beban', soc: 'SoC' },
  watt: (powerW: number) => `${number(powerW)} W`,
  percent: (socPct: number) => `${number(socPct)}%`,
  none: '—',
  empty: 'Jalankan simulasi untuk mengisi grafik',
  hint: 'Arahkan penunjuk atau tekan panah kiri dan kanan untuk membaca nilai',
  table: 'Cuplikan tiap jam',
  hour: 'Jam',
} as const;
