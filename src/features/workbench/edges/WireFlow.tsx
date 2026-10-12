import { ViewportPortal } from '@xyflow/react';
import { Wrench } from 'lucide-react';
import { t } from '@/i18n';
import { useSimStore } from '@/store';
import { flowSpeedPxPerS } from '../status/indicators';
import { WIRE_HALO_PX } from './wire-style';

/** Jarak antartitik arus; sama dengan panjang pola `stroke-dasharray` di status.css. */
const DOT_PITCH_PX = 16;

interface WireFlowProps {
  wireId: string;
  /** Atribut `d` lintasan kabel, dari `wire.from` ke `wire.to`. */
  d: string;
  widthPx: number;
  midX: number;
  midY: number;
}

/**
 * Keadaan listrik sebuah kabel di atas garisnya: titik bergerak searah arus dengan kecepatan
 * sebanding besar arus, pendar jingga saat terlalu panas, dan tombol ganti saat rusak.
 */
export function WireFlow({ wireId, d, widthPx, midX, midY }: WireFlowProps) {
  const speedPxPerS = useSimStore((state) =>
    flowSpeedPxPerS(state.snapshot.wires[wireId]?.flowA ?? 0),
  );
  const condition = useSimStore((state) => state.snapshot.wires[wireId]?.condition ?? 'ok');
  const repairWire = useSimStore((state) => state.repairWire);

  if (condition === 'damaged')
    return (
      // Di atas node (bukan di lapisan label kabel) supaya tombolnya tidak tertutup gambar.
      <ViewportPortal>
        <button
          type="button"
          aria-label={t.status.repairWire(wireId)}
          title={`${t.status.wireDamaged}. ${t.status.repairWire(wireId)}`}
          onClick={() => repairWire(wireId)}
          className="wire-repair nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)` }}
        >
          <span aria-hidden className="smoke">
            <i />
            <i />
            <i />
          </span>
          <Wrench aria-hidden size={20} />
        </button>
      </ViewportPortal>
    );

  return (
    <>
      {condition === 'overheating' && (
        <path d={d} className="wire-overheat" strokeWidth={widthPx + 2 * WIRE_HALO_PX} />
      )}
      {speedPxPerS !== 0 && (
        <path
          d={d}
          className="wire-flow"
          data-flow={speedPxPerS > 0 ? 'forward' : 'reverse'}
          strokeWidth={Math.max(widthPx - 1, 2)}
          style={{
            animationDuration: `${(DOT_PITCH_PX / Math.abs(speedPxPerS)).toFixed(3)}s`,
            animationDirection: speedPxPerS > 0 ? 'normal' : 'reverse',
          }}
        />
      )}
    </>
  );
}
