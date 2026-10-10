// Blok bangun skema katalog: field bersama setiap item (docs/KATALOG.md §3 dan §5).
import { z } from 'zod';
import {
  DATASHEET_COVERAGES,
  PACKAGE_IDS,
  PROTECTION_FEATURES,
  TERMINAL_KINDS,
  TRIP_CURVES,
  type ComponentCategory,
} from '@/domain';

export const num = z.number();
export const positive = z.number().positive();
export const nonNegative = z.number().nonnegative();
export const count = z.number().int().positive();
/** Pecahan tanpa satuan, 0–1 (KATALOG §4). */
export const fraction = z.number().min(0).max(1);
/** Efisiensi yang menjadi pembagi di model (MODEL_FISIKA §5.2): 0 < η ≤ 1. */
export const efficiency = z.number().gt(0).max(1);
export const pct = z.number().min(0).max(100);
export const bool = z.boolean();

export const isStrictlyIncreasing = (values: number[]): boolean =>
  values.every((value, i) => i === 0 || value > values[i - 1]!);

/** Pasangan [x, y]; minimal dua titik dan x naik ketat agar interpolasi tidak ambigu. */
const curve = (x: z.ZodNumber, y: z.ZodNumber) =>
  z
    .array(z.tuple([x, y]))
    .min(2)
    .refine((points) => isStrictlyIncreasing(points.map(([xValue]) => xValue)), {
      error: 'Sumbu x kurva harus naik ketat tanpa titik berulang',
    });

/** `[rasio arus atau daya, detik]`; keduanya positif untuk interpolasi log-log (§9.2). */
export const tripTimeCurve = curve(positive, positive);
/** `[°C, faktor]`; suhu boleh negatif, faktor harus positif. */
export const tempFactorCurve = curve(num, positive);
/** Sumbu SoC sebuah kurva baterai: naik ketat dan mencakup 0–1 (§4.2). */
export const socAxis = z
  .array(fraction)
  .min(2)
  .refine(isStrictlyIncreasing, { error: 'Titik SoC harus naik ketat tanpa titik berulang' })
  .refine((soc) => soc[0] === 0 && soc.at(-1) === 1, {
    error: 'Titik SoC harus mulai dari 0 dan berakhir di 1',
  });
export const tripCurve = z.enum(TRIP_CURVES);
export const protectionFeatures = z.array(z.enum(PROTECTION_FEATURES)).min(1);
export const noProtection = z.strictObject({});

interface MpptLimits {
  mpptMinV: number;
  mpptMaxV: number;
  pvVocMaxV?: number;
}

/** Argumen `.refine()`: jendela MPPT tidak kosong dan di bawah batas Voc (MODEL_FISIKA §3.2). */
export const mpptWindow: [(limits: MpptLimits) => boolean, { error: string; path: string[] }] = [
  ({ mpptMinV, mpptMaxV, pvVocMaxV = Infinity }: MpptLimits) =>
    mpptMinV < mpptMaxV && mpptMaxV <= pvVocMaxV,
  { error: 'Harus mpptMinV < mpptMaxV ≤ batas Voc', path: ['mpptMaxV'] },
];

const terminalSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  label: z.string().min(1),
  kind: z.enum(TERMINAL_KINDS),
  xPct: pct,
  yPct: pct,
  maxWires: count,
});

const datasheetSchema = z.strictObject({
  source: z.string().min(1),
  coverage: z.enum(DATASHEET_COVERAGES),
  verify: z.array(z.string().regex(/^(electrical|protection)\.[A-Za-z0-9.]+$/)),
});

const MAX_NAME_WORDS = 3;

/** Skema satu item: field bersama + `electrical` dan `protection` milik kategorinya. */
export function itemSchema<C extends ComponentCategory, E extends z.ZodType, P extends z.ZodType>(
  category: C,
  electrical: E,
  protection: P,
) {
  return z.strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    category: z.literal(category),
    name: z
      .string()
      .min(1)
      .refine((name) => name.trim().split(/\s+/).length <= MAX_NAME_WORDS, {
        error: `Nama tampilan maksimal ${MAX_NAME_WORDS} kata`,
      }),
    packages: z.array(z.enum(PACKAGE_IDS)).min(1),
    electrical,
    terminals: z.array(terminalSchema),
    protection,
    image: z.string().regex(/^src\/assets\/components\/[a-z0-9-]+\.webp$/),
    datasheet: datasheetSchema,
    notes: z.string().optional(),
  });
}
