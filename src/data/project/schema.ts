// Skema berkas proyek: susunan meja kerja yang disimpan, dibuka, dan dipakai preset
// (docs/PRD.md §3.2: berkas simpan memuat nomor versi format).
import { z } from 'zod';
import { PACKAGE_IDS } from '@/domain';

export const PROJECT_APP_ID = 'simplts';
export const PROJECT_FORMAT_VERSION = 1;
export const PROJECT_FILE_EXTENSION = '.simplts.json';

export const ROTATIONS_DEG = [0, 90, 180, 270] as const;
export type RotationDeg = (typeof ROTATIONS_DEG)[number];

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const terminalRefSchema = z.strictObject({ componentId: idSchema, terminalId: idSchema });

const componentSchema = z.strictObject({
  /** Unik per rangkaian. */
  id: idSchema,
  /** Id item di katalog. */
  catalogId: idSchema,
  /** Pojok kiri atas di meja kerja. */
  xPx: z.number(),
  yPx: z.number(),
  rotationDeg: z.union(ROTATIONS_DEG.map((deg) => z.literal(deg))),
  /** Setelan daya beban; hanya untuk beban, tanpa nilai berarti daya maksimum. */
  powerSettingW: z.number().nonnegative().optional(),
});

const wireSchema = z.strictObject({
  id: idSchema,
  from: terminalRefSchema,
  to: terminalRefSchema,
  cableId: idSchema,
  areaMm2: z.number().positive(),
  /** Panjang satu penghantar. */
  lengthM: z.number().positive(),
});

export const projectFileSchema = z.strictObject({
  app: z.literal(PROJECT_APP_ID),
  formatVersion: z.literal(PROJECT_FORMAT_VERSION),
  packageId: z.enum(PACKAGE_IDS),
  components: z.array(componentSchema),
  wires: z.array(wireSchema),
  /** MCB/fuse yang ON. */
  closedSwitchIds: z.array(idSchema),
});

export type ProjectFile = z.infer<typeof projectFileSchema>;
export type ProjectComponent = ProjectFile['components'][number];
