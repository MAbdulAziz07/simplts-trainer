import { useMemo } from 'react';
import type { Wire } from '@/domain';
import { toPlacedComponents, useCircuitStore } from '@/store';
import type { WireEdgeData, WireFlowEdge } from './flow-types';

// Jenis terminal asal tidak berubah selama kabelnya ada, jadi `data` bisa dipakai ulang.
const dataByWire = new WeakMap<Wire, WireEdgeData>();

/** Edge @xyflow/react dari kabel di store. */
export function useFlowEdges(): WireFlowEdge[] {
  const wires = useCircuitStore((state) => state.doc.wires);
  const selectedIds = useCircuitStore((state) => state.selectedWireIds);

  return useMemo(() => {
    // Komponen dibaca sekali saat kabel berubah; menggeser komponen tidak membuat ulang edge.
    const components = toPlacedComponents(useCircuitStore.getState().doc);
    return wires.flatMap((wire): WireFlowEdge[] => {
      let data = dataByWire.get(wire);
      if (!data) {
        const origin = components
          .find((component) => component.id === wire.from.componentId)
          ?.item.terminals.find((terminal) => terminal.id === wire.from.terminalId);
        if (!origin) return [];
        dataByWire.set(wire, (data = { wire, kind: origin.kind }));
      }
      return [
        {
          id: wire.id,
          type: 'wire',
          source: wire.from.componentId,
          sourceHandle: wire.from.terminalId,
          target: wire.to.componentId,
          targetHandle: wire.to.terminalId,
          selected: selectedIds.includes(wire.id),
          data,
        },
      ];
    });
  }, [wires, selectedIds]);
}
