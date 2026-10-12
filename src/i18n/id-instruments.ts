// Teks alat ukur (multimeter, tang ampere, solar power meter); digabung ke `id` di ./id.ts.
export const instruments = {
  toolbar: 'Alat ukur',
  names: { multimeter: 'Multimeter', clamp: 'Tang ampere', solar: 'Solar power meter' },
  open: (name: string) => `Buka ${name}`,
  close: (name: string) => `Tutup ${name}`,
  reading: (name: string) => `Bacaan ${name}`,
  /** Tampilan di luar batas ukur, seperti pada alat nyata. */
  overload: 'OL',
  functionLabel: 'Fungsi multimeter',
  functions: { vdc: 'V⎓', vac: 'V~', ohm: 'Ω' },
  functionHints: {
    vdc: 'Tegangan DC',
    vac: 'Tegangan AC',
    ohm: 'Tahanan: hanya pada rangkaian tanpa tegangan',
  },
  clampModeLabel: 'Mode tang ampere',
  clampModes: { dc: 'A⎓', ac: 'A~' },
  clampModeHints: { dc: 'Arus DC', ac: 'Arus AC' },
  marks: { vdc: 'DC', vac: 'AC', ohm: '', dc: 'DC', ac: 'AC' },
  units: { volt: 'V', ampere: 'A', ohm: 'Ω', irradiance: 'W/m²' },
  tools: { red: 'Probe merah', black: 'Probe hitam', clamp: 'Jepitan' },
  toolParked: {
    red: 'Probe merah: seret ke terminal',
    black: 'Probe hitam: seret ke terminal',
    clamp: 'Jepitan: seret ke kabel',
  },
  toolAt: (tool: string, target: string) => `${tool} di ${target}: seret untuk memindahkan`,
  wireTarget: (wireId: string) => `kabel ${wireId}`,
  placingHints: {
    red: 'Ketuk terminal untuk probe merah',
    black: 'Ketuk terminal untuk probe hitam',
    clamp: 'Ketuk kabel untuk dijepit',
  },
  parked: '—',
} as const;
