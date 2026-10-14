import { useStore, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { SlidersHorizontal } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import { t } from '@/i18n';
import { itemSizePx } from '@/ui';
import type { ComponentFlowNode } from '../flow-types';
import { NodePicture } from '../status/NodePicture';
import { NodeStatus } from '../status/NodeStatus';
import { layoutTerminals, rotatedSizePx } from './geometry';
import { hitClipPath, hitPolygon, hitSidePx, quantizeZoom } from './hit-area';
import { SwitchToggle } from './SwitchToggle';
import { TerminalHandle, type TerminalHit } from './TerminalHandle';
import { useTerminalRoles } from './useTerminalRoles';

/**
 * Satu komponen di meja kerja: gambar (ikut berputar), keadaan simulasinya, dan terminalnya (label
 * tetap tegak).
 */
export const ComponentNode = memo(function ComponentNode({
  id,
  data,
  selected,
}: NodeProps<ComponentFlowNode>) {
  const { item, rotationDeg } = data;
  const size = useMemo(() => itemSizePx(item), [item]);
  const box = rotatedSizePx(size, rotationDeg);
  const spots = useMemo(
    () => layoutTerminals(item.terminals, size, rotationDeg),
    [item, size, rotationDeg],
  );
  const roles = useTerminalRoles(id, spots);
  // Area sentuh terminal tetap 44 px di layar: ukurannya di ruang meja mengikuti zoom.
  const zoom = useStore((state) => quantizeZoom(state.transform[2]));
  const hits = useMemo((): TerminalHit[] => {
    const sidePx = hitSidePx(zoom);
    return spots.map((spot) => ({
      sidePx,
      clipPath: hitClipPath(hitPolygon(spot, spots, sidePx), sidePx),
    }));
  }, [spots, zoom]);

  // Posisi handle berubah saat komponen diputar atau katalog diperbarui.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => updateNodeInternals(id), [id, spots, updateNodeInternals]);

  return (
    <div
      className="component-node relative"
      data-selected={selected || undefined}
      style={{ width: box.widthPx, height: box.heightPx }}
    >
      <span className="component-name">
        {data.tuned && (
          <SlidersHorizontal
            aria-label={t.params.tuned}
            role="img"
            size={12}
            className="component-tuned"
          />
        )}
        {item.name}
      </span>
      <NodePicture id={id} item={item} size={size} rotationDeg={rotationDeg} />
      <NodeStatus id={id} item={item} />
      <SwitchToggle
        componentId={id}
        category={item.category}
        name={item.name}
        closed={data.closed}
      />
      {spots.map((spot, index) => (
        <TerminalHandle
          key={spot.terminal.id}
          spot={spot}
          role={roles?.[index] ?? 'idle'}
          hit={hits[index] ?? { sidePx: 0, clipPath: 'none' }}
          emphasized={Boolean(selected) || roles !== undefined}
        />
      ))}
    </div>
  );
});
