// Aturan urutan kerja: memutar ulang riwayat pemasangan kabel (`wiringLog`).
import type { ComponentCategory } from '../types';
import type { Finding, Netlist, Wire, WiringEvent } from './types';
import { finding, liveNetlist, netOf, ofCategory, terminalsInNet } from './validate-context';
import type { ValidationContext } from './validate-context';

const SOURCES: readonly ComponentCategory[] = ['pv-module', 'battery', 'grid'];
const BREAKERS: readonly ComponentCategory[] = ['mcb-dc', 'mcb-ac'];

/** Memanggil `visit` untuk tiap kejadian dengan netlist saat kabel itu masih/sudah terpasang. */
function replay(
  ctx: ValidationContext,
  visit: (netlist: Netlist, event: WiringEvent) => void,
): void {
  const wires = new Map<string, Wire>();
  for (const event of ctx.input.wiringLog ?? []) {
    wires.set(event.wire.id, event.wire);
    visit(liveNetlist(ctx.components, [...wires.values()], event.closedSwitchIds), event);
    if (event.action === 'disconnect') wires.delete(event.wire.id);
  }
}

/** SCC yang kedua terminal PV-nya sudah mencapai modul sementara baterainya belum tersambung. */
function sccsWithPvOnly(ctx: ValidationContext, netlist: Netlist): string[] {
  const reaches = (sccId: string, port: string, category: ComponentCategory): boolean =>
    [`${port}-pos`, `${port}-neg`].every(
      (terminalId) =>
        terminalsInNet(ctx, netlist, netOf(netlist, sccId, terminalId), [category]).length > 0,
    );
  return ofCategory(ctx, 'scc-pwm', 'scc-mppt')
    .filter(({ id }) => reaches(id, 'pv', 'pv-module') && !reaches(id, 'bat', 'battery'))
    .map(({ id }) => id);
}

/**
 * PV tersambung ke SCC sebelum baterai (`installOrder` katalog: baterai, PV, beban). Diperiksa
 * pada tiap pemasangan kabel di riwayat dan pada keadaan sekarang; MCB PV yang OFF memutus PV.
 */
export function pvBeforeBattery(ctx: ValidationContext): Finding[] {
  const wireBySccId = new Map<string, string | undefined>();
  replay(ctx, (netlist, event) => {
    if (event.action !== 'connect') return;
    for (const sccId of sccsWithPvOnly(ctx, netlist)) {
      if (!wireBySccId.has(sccId)) wireBySccId.set(sccId, event.wire.id);
    }
  });
  for (const sccId of sccsWithPvOnly(ctx, ctx.live)) {
    if (!wireBySccId.has(sccId)) wireBySccId.set(sccId, undefined);
  }
  return [...wireBySccId].map(([sccId, wireId]) =>
    finding(
      'pv-before-battery',
      'warning',
      [sccId],
      wireId === undefined ? {} : { wireIds: [wireId] },
    ),
  );
}

/** MCB yang ON dan satu net dengan sumber. */
function energizedBreakers(ctx: ValidationContext, netlist: Netlist, event: WiringEvent) {
  const closed = new Set(event.closedSwitchIds);
  const byNet = new Map<string, string[]>();
  for (const net of netlist.nets) {
    if (terminalsInNet(ctx, netlist, net.id, SOURCES).length === 0) continue;
    const breakers = terminalsInNet(ctx, netlist, net.id, BREAKERS)
      .map((ref) => ref.componentId)
      .filter((id) => closed.has(id));
    if (breakers.length > 0) byNet.set(net.id, breakers);
  }
  return byNet;
}

/**
 * Kabel dipasang atau dilepas saat masih ada MCB ON yang bertegangan. Bahaya bila kabel itu
 * sendiri berada di net MCB tersebut, peringatan bila di bagian lain rangkaian.
 */
export function liveRewiring(ctx: ValidationContext): Finding[] {
  const byWireId = new Map<string, Finding>();
  replay(ctx, (netlist, event) => {
    const energized = energizedBreakers(ctx, netlist, event);
    if (energized.size === 0 || byWireId.has(event.wire.id)) return;
    const wireNetId = netlist.wires.find((wire) => wire.id === event.wire.id)?.netId;
    const direct = wireNetId === undefined ? undefined : energized.get(wireNetId);
    byWireId.set(
      event.wire.id,
      finding(
        'live-rewiring',
        direct ? 'danger' : 'warning',
        direct ?? [...energized.values()].flat(),
        {
          wireIds: [event.wire.id],
        },
      ),
    );
  });
  return [...byWireId.values()];
}
