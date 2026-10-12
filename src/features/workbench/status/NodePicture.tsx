import type { CatalogItem } from '@/domain';
import type { RotationDeg } from '@/data';
import { useSimStore } from '@/store';
import { ComponentPicture, pictureEffect, type PictureEffect, type SizePx } from '@/ui';
import { LOAD_LEVELS, loadLevelOf } from './indicators';

/** Putaran kipas per detik pada daya terkecil dan pada daya penuh. */
const FAN_MIN_RPS = 0.5;
const FAN_MAX_RPS = 3;
/** Pendar paling redup yang masih terlihat. */
const GLOW_MIN_OPACITY = 0.3;

const BLADE_ANGLES_DEG = [0, 120, 240];

function effectBox(effect: PictureEffect, scale: number) {
  return {
    left: `${effect.xPct}%`,
    top: `${effect.yPct}%`,
    width: `${effect.radiusPct * 2 * scale}%`,
  };
}

/** Pendar lampu atau baling-baling berputar, sebanding daya terserap beban. */
function LoadEffect({
  id,
  item,
  effect,
}: {
  id: string;
  item: CatalogItem;
  effect: PictureEffect;
}) {
  const level = useSimStore((state) => loadLevelOf(id, item, state.snapshot));
  if (level === 0) return null;
  const ratio = level / LOAD_LEVELS;

  if (effect.kind === 'glow')
    return (
      <span
        className="lamp-glow"
        data-level={level}
        style={{
          ...effectBox(effect, 1.7),
          opacity: GLOW_MIN_OPACITY + (1 - GLOW_MIN_OPACITY) * ratio,
        }}
      />
    );

  const rps = FAN_MIN_RPS + (FAN_MAX_RPS - FAN_MIN_RPS) * ratio;
  return (
    <svg
      className="fan-blades"
      data-level={level}
      viewBox="-50 -50 100 100"
      style={{ ...effectBox(effect, 1), animationDuration: `${(1 / rps).toFixed(3)}s` }}
    >
      <circle r="46" className="fan-blur" />
      {BLADE_ANGLES_DEG.map((angleDeg) => (
        <path
          key={angleDeg}
          d="M 0,0 C 10,-14 30,-22 44,-10 C 40,4 22,12 0,0 Z"
          transform={`rotate(${angleDeg})`}
        />
      ))}
    </svg>
  );
}

interface NodePictureProps {
  id: string;
  item: CatalogItem;
  size: SizePx;
  rotationDeg: RotationDeg;
}

/**
 * Gambar komponen (ikut berputar) beserta efeknya: pendar, putaran, dan saat rusak gambar
 * menghitam dengan garis retak (docs/UX.md §2.4).
 */
export function NodePicture({ id, item, size, rotationDeg }: NodePictureProps) {
  const isDamaged = useSimStore((state) => state.snapshot.components[id]?.condition === 'damaged');
  const effect = pictureEffect(item.image);
  return (
    <div
      className="node-picture absolute top-1/2 left-1/2"
      data-damaged={isDamaged || undefined}
      style={{
        width: size.widthPx,
        height: size.heightPx,
        transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
      }}
    >
      <ComponentPicture item={item} />
      {effect && !isDamaged && <LoadEffect id={id} item={item} effect={effect} />}
      {isDamaged && (
        <svg className="crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points="38,4 52,26 41,43 60,58 47,76 58,96" />
          <polyline points="41,43 22,52" />
          <polyline points="60,58 80,50" />
        </svg>
      )}
    </div>
  );
}
