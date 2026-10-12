import { CLAMP_MODES, METER_FUNCTIONS, type TerminalRef } from '@/domain';
import { t } from '@/i18n';
import { findCatalogItem, useCircuitStore, useInstrumentStore, type ProbeId } from '@/store';
import { clampDisplay, multimeterDisplay, solarDisplay } from './display';
import { InstrumentPanel, OptionGroup, ToolChip } from './InstrumentPanel';

/** Label terminal tempat probe menempel, mis. `BAT+`. */
function useTerminalLabel(ref: TerminalRef | undefined): string | undefined {
  return useCircuitStore((state) => {
    const part = ref && state.doc.components.find((candidate) => candidate.id === ref.componentId);
    const item = part && findCatalogItem(part.catalogId);
    return item?.terminals.find((terminal) => terminal.id === ref?.terminalId)?.label;
  });
}

function ProbeChip({ probe }: { probe: ProbeId }) {
  const ref = useInstrumentStore((state) => state.probes[probe]);
  return <ToolChip tool={probe} target={useTerminalLabel(ref)} />;
}

/** Multimeter: VDC, VAC, ohm; probe merah dan hitam ke terminal mana pun. */
export function MultimeterPanel() {
  const fn = useInstrumentStore((state) => state.meterFunction);
  const reading = useInstrumentStore((state) => state.readings.multimeter);
  const setMeterFunction = useInstrumentStore((state) => state.setMeterFunction);
  return (
    <InstrumentPanel id="multimeter" display={multimeterDisplay(reading, fn)}>
      <OptionGroup
        label={t.instruments.functionLabel}
        options={METER_FUNCTIONS}
        value={fn}
        text={t.instruments.functions}
        hints={t.instruments.functionHints}
        onChange={setMeterFunction}
      />
      <div className="flex gap-2">
        <ProbeChip probe="red" />
        <ProbeChip probe="black" />
      </div>
    </InstrumentPanel>
  );
}

/** Tang ampere: dijepitkan ke satu kabel; mode DC (bertanda arah) atau AC. */
export function ClampPanel() {
  const mode = useInstrumentStore((state) => state.clampMode);
  const reading = useInstrumentStore((state) => state.readings.clamp);
  const wireId = useInstrumentStore((state) => state.clampWireId);
  const setClampMode = useInstrumentStore((state) => state.setClampMode);
  return (
    <InstrumentPanel id="clamp" display={clampDisplay(reading, mode)}>
      <OptionGroup
        label={t.instruments.clampModeLabel}
        options={CLAMP_MODES}
        value={mode}
        text={t.instruments.clampModes}
        hints={t.instruments.clampModeHints}
        onChange={setClampMode}
      />
      <div className="flex">
        <ToolChip tool="clamp" target={wireId && t.instruments.wireTarget(wireId)} />
      </div>
    </InstrumentPanel>
  );
}

/** Solar power meter: iradiasi pada bidang panel. */
export function SolarPanel() {
  const irradianceWm2 = useInstrumentStore((state) => state.readings.solarWm2);
  return <InstrumentPanel id="solar" display={solarDisplay(irradianceWm2)} />;
}
