import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';

/** Geser sejauh ini (px) sebelum ketukan dianggap seretan. */
const DRAG_THRESHOLD_PX = 8;

export interface TrayDrag {
  catalogId: string;
  x: number;
  y: number;
}

interface Press {
  catalogId: string;
  startX: number;
  startY: number;
  dragging: boolean;
}

interface TrayDragOptions {
  /** Dilepas setelah diseret; koordinat layar. */
  onDrop: (catalogId: string, at: { x: number; y: number }) => void;
  /** Diketuk, diklik, atau ditekan Enter tanpa diseret. */
  onTap: (catalogId: string) => void;
}

/**
 * Seret ubin baki dengan pointer events, sehingga sama untuk mouse, pena, dan sentuhan
 * (drag-and-drop HTML5 tidak jalan di layar sentuh). Ubin memakai `touch-action: pan-y`:
 * usapan tegak tetap menggulir baki, usapan mendatar menjadi seretan.
 */
export function useTrayDrag({ onDrop, onTap }: TrayDragOptions) {
  const [drag, setDrag] = useState<TrayDrag>();
  const press = useRef<Press>(undefined);
  const suppressClick = useRef(false);

  const end = () => {
    press.current = undefined;
    setDrag(undefined);
  };
  const tileHandlers = (catalogId: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      suppressClick.current = false;
      press.current = {
        catalogId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = press.current;
      if (!current) return;
      const distancePx = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (!current.dragging && distancePx < DRAG_THRESHOLD_PX) return;
      current.dragging = true;
      setDrag({ catalogId, x: event.clientX, y: event.clientY });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = press.current;
      end();
      if (!current?.dragging) return;
      suppressClick.current = true;
      onDrop(catalogId, { x: event.clientX, y: event.clientY });
    },
    onPointerCancel: end,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        return;
      }
      onTap(catalogId);
    },
  });

  return { drag, tileHandlers };
}
