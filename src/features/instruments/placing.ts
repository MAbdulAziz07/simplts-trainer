// Membawa probe atau jepitan tang ampere ke sasarannya: diseret lalu dilepas di atas terminal atau
// kabel, atau diketuk lalu sasarannya diketuk (docs/PRD.md US25: tidak ada fungsi yang hanya seret).
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TerminalRef } from '@/domain';
import { t } from '@/i18n';
import { useInstrumentStore, useToastStore, type PlacingTool } from '@/store';

/** Gerak di bawah ini dianggap ketukan, bukan seretan. */
const DRAG_THRESHOLD_PX = 6;

/** Atribut penanda bagian panel alat ukur; ketukan di dalamnya bukan ketukan ke sasaran. */
export const INSTRUMENT_UI_ATTRIBUTE = 'data-instrument-ui';

export interface PointPx {
  x: number;
  y: number;
}

/** Letak penunjuk terakhir selama alat dibawa; dibaca bayangan alat saat pertama tampil. */
export const lastPointer: PointPx = { x: 0, y: 0 };

/** Terminal @xyflow/react dari elemen handle-nya. */
function terminalOf(handle: HTMLElement): TerminalRef | undefined {
  const componentId = handle.dataset.nodeid;
  const terminalId = handle.dataset.handleid;
  return componentId && terminalId ? { componentId, terminalId } : undefined;
}

/**
 * Terminal di sebuah titik layar. Bila area sentuh beberapa terminal bertumpuk (terminal rapat),
 * yang pusatnya paling dekat dengan titik itu yang dipilih. Gagang probe yang sedang menempel
 * tidak dihitung sebagai terminalnya.
 */
function terminalAtPoint(point: PointPx, elements: readonly Element[]): TerminalRef | undefined {
  let nearest: { handle: HTMLElement; distancePx: number } | undefined;
  for (const element of elements) {
    const handle = element.closest<HTMLElement>('.react-flow__handle');
    if (!handle || element.closest('.probe-marker')) continue;
    const box = handle.getBoundingClientRect();
    const distancePx = Math.hypot(
      box.left + box.width / 2 - point.x,
      box.top + box.height / 2 - point.y,
    );
    if (!nearest || distancePx < nearest.distancePx) nearest = { handle, distancePx };
  }
  return nearest && terminalOf(nearest.handle);
}

/** Sasaran alat di sebuah titik layar: terminal untuk probe, id kabel untuk jepitan. */
export function targetAt(tool: PlacingTool, point: PointPx): TerminalRef | string | undefined {
  const elements = document.elementsFromPoint(point.x, point.y);
  // Panel alat ukur menutupi meja kerja di bawahnya.
  if (elements[0]?.closest(`[${INSTRUMENT_UI_ATTRIBUTE}]`)) return undefined;
  if (tool !== 'clamp') return terminalAtPoint(point, elements);
  for (const element of elements) {
    const wireId = element.closest('.react-flow__edge')?.getAttribute('data-id');
    if (wireId) return wireId;
  }
  return undefined;
}

/** Menempelkan alat ke sasaran di titik ini; `false` bila tidak ada sasaran di sana. */
export function dropTool(tool: PlacingTool, point: PointPx): boolean {
  const target = targetAt(tool, point);
  if (target === undefined) return false;
  const store = useInstrumentStore.getState();
  if (tool === 'clamp') {
    if (typeof target === 'string') store.attachClamp(target);
  } else if (typeof target !== 'string') {
    store.attachProbe(tool, target);
  }
  return true;
}

/**
 * Mulai membawa alat dari tombolnya di panel atau dari tempatnya menempel. Seretan berakhir saat
 * dilepas; ketukan membuat alat tetap dibawa sampai sasaran diketuk (lihat `usePlacingTaps`), dan
 * ketukan kedua pada alat yang sama membatalkannya.
 */
export function beginPlacing(tool: PlacingTool, event: ReactPointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const store = useInstrumentStore.getState();
  const wasPlacing = store.placing === tool;
  if (tool === 'clamp') store.attachClamp(undefined);
  else store.attachProbe(tool, undefined);
  store.setPlacing(tool);

  const start: PointPx = { x: event.clientX, y: event.clientY };
  Object.assign(lastPointer, start);
  let dragged = false;
  const onMove = (move: PointerEvent): void => {
    if (Math.hypot(move.clientX - start.x, move.clientY - start.y) > DRAG_THRESHOLD_PX) {
      dragged = true;
    }
  };
  const onEnd = (end: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    if (dragged && end.type === 'pointerup') dropTool(tool, { x: end.clientX, y: end.clientY });
    if (dragged || wasPlacing) useInstrumentStore.getState().setPlacing(undefined);
    // Ketukan: alat tetap dibawa, petunjuk singkat menyebut langkah berikutnya.
    else useToastStore.getState().show(t.instruments.placingHints[tool]);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}
