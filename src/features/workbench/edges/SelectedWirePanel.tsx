import { Panel } from '@xyflow/react';
import { useCircuitStore } from '@/store';
import { WirePopover } from './WirePopover';

/**
 * Pilihan kabel muncul saat tepat satu kabel terpilih. Diletakkan di tepi atas meja, bukan di
 * dekat kabelnya, supaya tidak terpotong tepi meja dan ukurannya tidak ikut zoom.
 */
export function SelectedWirePanel() {
  const wire = useCircuitStore((state) =>
    state.selectedComponentIds.length === 0 && state.selectedWireIds.length === 1
      ? state.doc.wires.find((candidate) => candidate.id === state.selectedWireIds[0])
      : undefined,
  );
  if (!wire) return null;
  return (
    <Panel position="top-center">
      <WirePopover wire={wire} />
    </Panel>
  );
}
