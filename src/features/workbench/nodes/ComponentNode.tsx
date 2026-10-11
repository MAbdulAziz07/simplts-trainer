import { useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useMemo } from 'react';
import { ComponentPicture, itemSizePx } from '@/ui';
import type { ComponentFlowNode } from '../flow-types';
import { layoutTerminals, rotatedSizePx } from './geometry';
import { SwitchToggle } from './SwitchToggle';
import { TerminalHandle } from './TerminalHandle';
import { useTerminalRoles } from './useTerminalRoles';

/** Satu komponen di meja kerja: gambar (ikut berputar) dan terminalnya (label tetap tegak). */
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

  // Posisi handle berubah saat komponen diputar atau katalog diperbarui.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => updateNodeInternals(id), [id, spots, updateNodeInternals]);

  return (
    <div
      className="component-node relative"
      data-selected={selected || undefined}
      style={{ width: box.widthPx, height: box.heightPx }}
    >
      <span className="component-name">{item.name}</span>
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: size.widthPx,
          height: size.heightPx,
          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
        }}
      >
        <ComponentPicture item={item} />
      </div>
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
          showLabel={Boolean(selected) || roles !== undefined}
        />
      ))}
    </div>
  );
});
