import { Background, BackgroundVariant, ConnectionMode, ReactFlow } from '@xyflow/react';
import { t } from '@/i18n';
import { useCircuitStore } from '@/store';
import { GRID_PX, type ComponentFlowNode, type WireFlowEdge } from './flow-types';
import { ComponentNode } from './nodes/ComponentNode';
import { useFlowHandlers } from './useFlowHandlers';
import { useFlowNodes } from './useFlowNodes';
import { WORKBENCH_ATTRIBUTE } from './usePlaceComponent';
import './workbench.css';

// docs/UX.md §2.1: kisi 24 px, zoom 50–200%, awal 100%.
const SNAP_GRID: [number, number] = [GRID_PX, GRID_PX];
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const FIT_VIEW = { maxZoom: 1, padding: 0.1 };
/** Jarak (px meja) dari pusat terminal yang masih dianggap mengenai terminal itu. */
const CONNECTION_RADIUS_PX = 24;

const NODE_TYPES = { component: ComponentNode };
const NO_EDGES: WireFlowEdge[] = [];

export function Workbench() {
  const nodes = useFlowNodes();
  const handlers = useFlowHandlers();
  const isEmpty = nodes.length === 0;

  return (
    <main aria-label={t.areas.workbench} className="relative" {...{ [WORKBENCH_ATTRIBUTE]: '' }}>
      <ReactFlow<ComponentFlowNode, WireFlowEdge>
        nodes={nodes}
        edges={NO_EDGES}
        nodeTypes={NODE_TYPES}
        onNodesChange={handlers.onNodesChange}
        onEdgesChange={handlers.onEdgesChange}
        onNodeDragStart={handlers.onDragStart}
        onNodeDragStop={handlers.onDragStop}
        onSelectionDragStart={handlers.onDragStart}
        onSelectionDragStop={handlers.onDragStop}
        onInit={(instance) => {
          if (useCircuitStore.getState().doc.components.length > 0) void instance.fitView(FIT_VIEW);
        }}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={CONNECTION_RADIUS_PX}
        deleteKeyCode={null}
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
      {isEmpty && (
        <p className="text-ink-muted pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
          {t.workbench.empty}
        </p>
      )}
    </main>
  );
}
