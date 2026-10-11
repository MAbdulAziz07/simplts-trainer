import { useMemo } from 'react';
import type { CatalogItem } from '@/domain';
import type { RotationDeg } from '@/data';
import { t } from '@/i18n';
import { findCatalogItem, useCircuitStore } from '@/store';
import { itemSizePx } from '@/ui';
import type { ComponentFlowNode, ComponentNodeData } from './flow-types';
import { rotatedSizePx } from './nodes/geometry';

const dataByItem = new WeakMap<CatalogItem, Map<string, ComponentNodeData>>();

/**
 * `data` node yang sama untuk isi yang sama, sehingga menyeret satu komponen tidak menggambar
 * ulang isi komponen lain.
 */
function nodeData(item: CatalogItem, rotationDeg: RotationDeg, closed: boolean): ComponentNodeData {
  let variants = dataByItem.get(item);
  if (!variants) dataByItem.set(item, (variants = new Map()));
  const key = `${rotationDeg}|${closed}`;
  let data = variants.get(key);
  if (!data) variants.set(key, (data = { item, rotationDeg, closed }));
  return data;
}

/** Node @xyflow/react dari komponen di store. */
export function useFlowNodes(): ComponentFlowNode[] {
  const components = useCircuitStore((state) => state.doc.components);
  const closedSwitchIds = useCircuitStore((state) => state.doc.closedSwitchIds);
  const selectedIds = useCircuitStore((state) => state.selectedComponentIds);

  return useMemo(
    () =>
      components.flatMap((part): ComponentFlowNode[] => {
        const item = findCatalogItem(part.catalogId);
        if (!item) return [];
        const box = rotatedSizePx(itemSizePx(item), part.rotationDeg);
        return [
          {
            id: part.id,
            type: 'component',
            position: { x: part.xPx, y: part.yPx },
            width: box.widthPx,
            height: box.heightPx,
            selected: selectedIds.includes(part.id),
            ariaLabel: t.workbench.component(item.name, part.id),
            data: nodeData(item, part.rotationDeg, closedSwitchIds.includes(part.id)),
          },
        ];
      }),
    [components, closedSwitchIds, selectedIds],
  );
}
