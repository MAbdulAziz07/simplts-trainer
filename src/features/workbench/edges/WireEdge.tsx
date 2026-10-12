import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { useSimStore } from '@/store';
import { terminalStyle } from '@/ui';
import type { WireFlowEdge } from '../flow-types';
import { WireFlow } from './WireFlow';
import { wireLane, wirePath } from './wire-path';
import { WIRE_HALO_PX, WIRE_HIT_WIDTH_PX, wireStrokePx } from './wire-style';

/**
 * Satu kabel: warna menurut terminal asal, tebal menurut penampang, lingkar cahaya bila terpilih.
 * Kabel rusak digambar hangus dan putus-putus.
 */
export const WireEdge = memo(function WireEdge(props: EdgeProps<WireFlowEdge>) {
  const { id, data, selected } = props;
  const isDamaged = useSimStore((state) => state.snapshot.wires[id]?.condition === 'damaged');
  if (!data) return null;

  const { d, midX, midY } = wirePath(
    { x: props.sourceX, y: props.sourceY, side: `${props.sourcePosition}` },
    { x: props.targetX, y: props.targetY, side: `${props.targetPosition}` },
    wireLane(id),
  );
  const { color, stripeColor } = terminalStyle(data.kind);
  const widthPx = wireStrokePx(data.wire.areaMm2);
  return (
    <>
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="var(--color-brand)"
          strokeOpacity={0.5}
          strokeWidth={widthPx + 2 * WIRE_HALO_PX}
          strokeLinecap="round"
        />
      )}
      <BaseEdge
        id={id}
        path={d}
        interactionWidth={WIRE_HIT_WIDTH_PX}
        style={{
          stroke: isDamaged ? 'var(--color-status-broken)' : color,
          strokeWidth: widthPx,
          strokeLinecap: 'round',
          strokeDasharray: isDamaged ? '3 8' : undefined,
        }}
      />
      {stripeColor && !isDamaged && (
        <path
          d={d}
          fill="none"
          stroke={stripeColor}
          strokeWidth={widthPx}
          strokeDasharray="8 8"
          pointerEvents="none"
        />
      )}
      <WireFlow wireId={id} d={d} widthPx={widthPx} midX={midX} midY={midY} />
    </>
  );
});
