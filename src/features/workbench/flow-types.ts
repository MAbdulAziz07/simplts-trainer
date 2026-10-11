// Bentuk node dan edge @xyflow/react di meja kerja; isinya diturunkan dari store.
import type { Edge, Node } from '@xyflow/react';
import type { CatalogItem, TerminalKind, Wire } from '@/domain';
import type { RotationDeg } from '@/data';

export const GRID_PX = 24;
/** Memaskan seluruh rangkaian ke meja tanpa memperbesar melebihi 100%. */
export const FIT_VIEW_OPTIONS = { maxZoom: 1, padding: 0.1 };

export type ComponentNodeData = {
  item: CatalogItem;
  rotationDeg: RotationDeg;
  /** MCB/fuse dalam keadaan ON; tidak berarti untuk komponen lain. */
  closed: boolean;
};
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

export type WireEdgeData = {
  wire: Wire;
  /** Jenis terminal asal; menentukan warna kabel. */
  kind: TerminalKind;
};
export type WireFlowEdge = Edge<WireEdgeData, 'wire'>;

export const snapToGridPx = (valuePx: number): number => Math.round(valuePx / GRID_PX) * GRID_PX;
