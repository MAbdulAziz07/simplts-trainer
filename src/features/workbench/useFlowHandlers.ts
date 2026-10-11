import type { EdgeChange, NodeChange } from '@xyflow/react';
import { useMemo } from 'react';
import { useCircuitStore, type PartMove } from '@/store';
import type { ComponentFlowNode, WireFlowEdge } from './flow-types';

/** Id terpilih setelah perubahan `select` dari @xyflow/react diterapkan. */
function applySelection(
  selectedIds: readonly string[],
  changes: readonly (NodeChange | EdgeChange)[],
): string[] {
  const next = new Set(selectedIds);
  for (const change of changes) {
    if (change.type !== 'select') continue;
    if (change.selected) next.add(change.id);
    else next.delete(change.id);
  }
  return [...next];
}

const hasSelect = (changes: readonly (NodeChange | EdgeChange)[]): boolean =>
  changes.some((change) => change.type === 'select');

/** Meneruskan perubahan dari kanvas (geser, pilih) ke store; kanvas tidak menyimpan state. */
export function useFlowHandlers() {
  return useMemo(() => {
    const store = () => useCircuitStore.getState();
    return {
      onNodesChange: (changes: NodeChange<ComponentFlowNode>[]) => {
        const moves: PartMove[] = [];
        for (const change of changes)
          if (change.type === 'position' && change.position)
            moves.push({ id: change.id, xPx: change.position.x, yPx: change.position.y });
        if (moves.length > 0) store().moveComponents(moves);
        if (hasSelect(changes))
          store().select(
            applySelection(store().selectedComponentIds, changes),
            store().selectedWireIds,
          );
      },
      onEdgesChange: (changes: EdgeChange<WireFlowEdge>[]) => {
        if (hasSelect(changes))
          store().select(
            store().selectedComponentIds,
            applySelection(store().selectedWireIds, changes),
          );
      },
      // Satu seretan (satu atau banyak komponen) menjadi satu langkah undo.
      onDragStart: () => store().beginGesture(),
      onDragStop: () => store().endGesture(),
    };
  }, []);
}
