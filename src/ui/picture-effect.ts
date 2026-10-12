// Efek yang digambar di atas gambar komponen saat bekerja: pendar bola lampu dan putaran
// baling-baling. Letaknya mengikuti gambar, jadi didaftar per nama berkas gambar.

export interface PictureEffect {
  kind: 'glow' | 'spin';
  /** Pusat efek terhadap gambar. */
  xPct: number;
  yPct: number;
  /** Jari-jari efek terhadap lebar gambar. */
  radiusPct: number;
}

const EFFECT_BY_IMAGE: Record<string, PictureEffect | undefined> = {
  'load-ac': { kind: 'glow', xPct: 50, yPct: 31, radiusPct: 48 },
  'load-dc': { kind: 'glow', xPct: 50, yPct: 24, radiusPct: 48 },
  'load-ac-fan': { kind: 'spin', xPct: 50, yPct: 36.5, radiusPct: 33 },
};

/** @param imagePath field `image` item katalog, mis. `src/assets/components/load-ac.webp`. */
export function pictureEffect(imagePath: string): PictureEffect | undefined {
  return EFFECT_BY_IMAGE[imagePath.replace(/^.*\//, '').replace(/\.webp$/, '')];
}
