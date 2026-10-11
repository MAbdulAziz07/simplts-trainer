import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  type Connection,
} from '@xyflow/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useCircuitStore, useToastStore } from '@/store';
import { SelectedWirePanel } from './edges/SelectedWirePanel';
import { WireEdge } from './edges/WireEdge';
import { FIT_VIEW_OPTIONS, GRID_PX, type ComponentFlowNode, type WireFlowEdge } from './flow-types';
import { ComponentNode } from './nodes/ComponentNode';
import { Toast } from './Toast';
import { useFlowEdges } from './useFlowEdges';
import { useFlowHandlers } from './useFlowHandlers';
import { useFlowNodes } from './useFlowNodes';
import { WORKBENCH_ATTRIBUTE } from './usePlaceComponent';
import { useWorkbenchShortcuts } from './useWorkbenchShortcuts';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import './workbench.css';

// docs/UX.md §2.1: kisi 24 px, zoom 50–200%, awal 100%.
const SNAP_GRID: [number, number] = [GRID_PX, GRID_PX];
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
/** Jarak (px meja) dari pusat terminal yang masih dianggap mengenai terminal itu. */
const CONNECTION_RADIUS_PX = 24;

const NODE_TYPES = { component: ComponentNode };
const EDGE_TYPES = { wire: WireEdge };
const CONNECTION_LINE_STYLE = {
  stroke: 'var(--color-control)',
  strokeWidth: 3,
  strokeDasharray: '6 4',
};

/**
 * Kabel baru dari terminal asal (tempat tarikan dimulai) ke terminal tujuan. Sambungan yang
 * ditolak aturan memberi petunjuk singkat (docs/PRD.md US3, US27).
 */
function connect({ source, sourceHandle, target, targetHandle }: Connection): void {
  if (!sourceHandle || !targetHandle) return;
  const check = useCircuitStore
    .getState()
    .connect(
      { componentId: source, terminalId: sourceHandle },
      { componentId: target, terminalId: targetHandle },
    );
  if (check.reason) useToastStore.getState().show(t.connectionRejections[check.reason], 'warning');
}

export function Workbench() {
  const nodes = useFlowNodes();
  const edges = useFlowEdges();
  const handlers = useFlowHandlers();
  // Mode pilih banyak: menyeret di meja membuat kotak pilih, bukan menggeser meja (untuk layar
  // sentuh; dengan keyboard cukup Shift+seret atau Ctrl+klik).
  const [selectMode, setSelectMode] = useState(false);
  useWorkbenchShortcuts();
  const isEmpty = nodes.length === 0;

  return (
    <main aria-label={t.areas.workbench} className="relative" {...{ [WORKBENCH_ATTRIBUTE]: '' }}>
      <ReactFlow<ComponentFlowNode, WireFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onConnect={connect}
        connectionLineStyle={CONNECTION_LINE_STYLE}
        onNodesChange={handlers.onNodesChange}
        onEdgesChange={handlers.onEdgesChange}
        onNodeDragStart={handlers.onDragStart}
        onNodeDragStop={handlers.onDragStop}
        onSelectionDragStart={handlers.onDragStart}
        onSelectionDragStop={handlers.onDragStop}
        onInit={(instance) => {
          if (useCircuitStore.getState().doc.components.length > 0)
            void instance.fitView(FIT_VIEW_OPTIONS);
        }}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={CONNECTION_RADIUS_PX}
        deleteKeyCode={null}
        selectionOnDrag={selectMode}
        panOnDrag={!selectMode}
        selectionMode={SelectionMode.Partial}
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
        <WorkbenchToolbar
          selectMode={selectMode}
          onToggleSelectMode={() => setSelectMode((on) => !on)}
        />
        <SelectedWirePanel />
      </ReactFlow>
      {isEmpty && (
        <p className="text-ink-muted pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
          {t.workbench.empty}
        </p>
      )}
      <Toast />
    </main>
  );
}
