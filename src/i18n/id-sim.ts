// Teks kendali simulasi dan umpan balik di meja kerja; digabung ke `id` di ./id.ts.
const number = (value: number, digits = 0): string =>
  value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const sim = {
  play: 'Jalankan simulasi',
  pause: 'Jeda simulasi',
  speed: 'Kecepatan simulasi',
  speedOption: (multiple: number) => `${multiple}×`,
  speedHint: (multiple: number) =>
    multiple === 1 ? 'Waktu nyata' : `1 detik = ${number(multiple / 60)} menit simulasi`,
  clock: 'Jam',
  irradiance: 'Iradiasi',
  irradianceValue: (irradianceWm2: number) => `${number(irradianceWm2)} W/m²`,
  cloud: 'Awan',
  cloudValue: (coverPct: number) => `${number(coverPct)}%`,
  ambient: 'Suhu lingkungan',
  ambientValue: (tempC: number) => `${number(tempC, 1)} °C`,
  auto: (label: string) => `${label}: ikuti jam dan awan`,
  autoMark: 'A',
} as const;
