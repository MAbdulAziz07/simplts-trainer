// Tipe kecil yang dipakai beberapa kategori katalog.

/** Pasangan [x, y] pada kurva atau tabel; arti sumbu ada di docs/KATALOG.md §6. */
export type CurvePoint = [number, number];

export const TRIP_CURVES = ['B', 'C', 'D', 'K', 'Z'] as const;
export type TripCurve = (typeof TRIP_CURVES)[number];

export const PROTECTION_FEATURES = [
  'short-circuit',
  'open-circuit',
  'reverse-polarity',
  'reverse-current',
  'overload',
  'overcharge',
] as const;
export type ProtectionFeature = (typeof PROTECTION_FEATURES)[number];

/** Komponen tanpa rating proteksi menulis `"protection": {}`. */
export type NoProtection = Record<string, never>;
