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
export const pct = z.number().min(0).max(100);
export const bool = z.boolean();

/** Pasangan [x, y]; minimal dua titik agar bisa diinterpolasi. */
export const curve = z.array(z.tuple([num, num])).min(2);
export const tripCurve = z.enum(TRIP_CURVES);
export const protectionFeatures = z.array(z.enum(PROTECTION_FEATURES)).min(1);
export const noProtection = z.strictObject({});

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
