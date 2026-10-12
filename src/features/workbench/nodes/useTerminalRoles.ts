import { useConnection, useStore } from '@xyflow/react';
import { useMemo } from 'react';
import { checkConnection } from '@/domain';
import { toPlacedComponents, useCircuitStore } from '@/store';
import type { TerminalSpot } from './geometry';
import type { TerminalRole } from './TerminalHandle';

const SEPARATOR = '\n';

/**
 * Peran tiap terminal sebuah node selama kabel ditarik (seret) atau setelah terminal asal diklik:
 * asal, boleh dituju, ditolak aturan sambungan, atau penuh. `undefined` bila tidak ada kabel yang
 * ditarik.
 */
export function useTerminalRoles(
  componentId: string,
  spots: readonly TerminalSpot[],
): TerminalRole[] | undefined {
  const dragOrigin = useConnection((connection) =>
    connection.inProgress
      ? `${connection.fromHandle.nodeId}${SEPARATOR}${connection.fromHandle.id ?? ''}`
      : '',
  );
  const clickOrigin = useStore(({ connectionClickStartHandle: handle }) =>
    handle ? `${handle.nodeId}${SEPARATOR}${handle.id ?? ''}` : '',
  );
  const origin = dragOrigin || clickOrigin;

  return useMemo(() => {
    if (!origin) return undefined;
    const [fromComponentId = '', fromTerminalId = ''] = origin.split(SEPARATOR);
    const from = { componentId: fromComponentId, terminalId: fromTerminalId };
    const { doc, level } = useCircuitStore.getState();
    const components = toPlacedComponents(doc);
    const checks = spots.map(({ terminal }) => {
      const to = { componentId, terminalId: terminal.id };
      return checkConnection({ components, wires: doc.wires, from, to, level });
    });
    /** Terminal yang disebut pemeriksaan sebagai yang penuh. */
    const isFull = (terminalId: string, ownerId: string): boolean =>
      checks.some(
        ({ reason, terminal }) =>
          reason === 'terminal-full' &&
          terminal?.componentId === ownerId &&
          terminal.terminalId === terminalId,
      );
    return spots.map(({ terminal }, index): TerminalRole => {
      if (componentId === fromComponentId && terminal.id === fromTerminalId) {
        // Terminal asal yang sudah penuh tidak bisa dipasangi kabel lagi ke mana pun.
        return isFull(fromTerminalId, fromComponentId) ? 'full' : 'origin';
      }
      if (checks[index]?.ok) return 'allowed';
      return isFull(terminal.id, componentId) ? 'full' : 'blocked';
    });
  }, [origin, componentId, spots]);
}
