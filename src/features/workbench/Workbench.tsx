import { Background, BackgroundVariant, ReactFlow } from '@xyflow/react';
import { t } from '@/i18n';

// docs/UX.md §2.1: kisi 24 px, zoom 50–200%, awal 100%.
const GRID_PX = 24;
const SNAP_GRID: [number, number] = [GRID_PX, GRID_PX];
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function Workbench() {
  return (
    <main aria-label={t.areas.workbench} className="relative">
      <ReactFlow
        nodes={[]}
        edges={[]}
        snapToGrid
        snapGrid={SNAP_GRID}
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={DEFAULT_VIEWPORT}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={GRID_PX}
          size={1.5}
          bgColor="var(--color-bench)"
          color="var(--color-bench-dot)"
        />
      </ReactFlow>
    </main>
  );
}
