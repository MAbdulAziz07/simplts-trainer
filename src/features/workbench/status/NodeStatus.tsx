import { Check, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { memo } from 'react';
import type { CatalogItem } from '@/domain';
import { t } from '@/i18n';
import { useCircuitStore, useSimStore } from '@/store';
import { ConditionBadge } from './ConditionBadge';
import { batteryKey, ledOf, sccLcdKey, type ChargeDirection, type LedState } from './indicators';

const LED_GLYPH: Record<LedState, React.ReactNode> = {
  off: null,
  green: <Check aria-hidden size={12} strokeWidth={4} />,
  'green-blink': <Check aria-hidden size={12} strokeWidth={4} />,
  yellow: '!',
  red: <X aria-hidden size={12} strokeWidth={4} />,
};

/** Lampu indikator SCC/inverter; tanda di dalamnya membuat keadaan terbaca tanpa warna. */
function StatusLed({ id, item }: NodeStatusProps) {
  const led = useSimStore((state) => ledOf(id, item, state.snapshot));
  if (!led) return null;
  const label = t.status.ledLabel(item.name, t.status.led[led]);
  return (
    <span role="img" aria-label={label} title={label} className="status-led" data-led={led}>
      {LED_GLYPH[led]}
    </span>
  );
}

const decimal = (value: string | undefined) => (value ?? '').replace('.', ',');

/** LCD SCC: tegangan dan arus baterai serta PV; padam bila SCC belum mendapat catu. */
function SccLcd({ id, item }: NodeStatusProps) {
  const key = useSimStore((state) => sccLcdKey(id, state.snapshot));
  const [batteryV, chargeA, pvV, pvA] = key.split('|');
  const isOn = key !== '';
  const rows = [
    { name: 'battery', label: t.status.lcdBattery, voltage: batteryV, current: chargeA },
    { name: 'pv', label: t.status.lcdPv, voltage: pvV, current: pvA },
  ];
  return (
    <div
      role="group"
      aria-label={t.status.lcdLabel(item.name)}
      className="lcd-chip"
      data-on={isOn || undefined}
    >
      {rows.map((row) => (
        <div key={row.name} className="contents" data-row={row.name}>
          <span className="lcd-tag">{row.label}</span>
          <span data-value="voltage">{isOn ? t.status.volt(decimal(row.voltage)) : '--,- V'}</span>
          <span data-value="current">
            {isOn ? t.status.ampere(decimal(row.current)) : '--,- A'}
          </span>
        </div>
      ))}
    </div>
  );
}

const SOC_LOW_PCT = 20;
const SOC_MEDIUM_PCT = 50;

/** Bar SoC baterai dengan angka persen dan arah arus. */
function SocBar({ id, item }: NodeStatusProps) {
  const key = useSimStore((state) => batteryKey(id, state.snapshot));
  if (key === '') return null;
  const [soc = '0', direction = 'idle'] = key.split('|') as [string, ChargeDirection];
  const socPct = Number(soc);
  const tone = socPct < SOC_LOW_PCT ? 'low' : socPct < SOC_MEDIUM_PCT ? 'medium' : 'high';
  return (
    <div className="soc" data-direction={direction}>
      <div
        role="meter"
        aria-label={t.status.socLabel(item.name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={socPct}
        aria-valuetext={`${t.status.soc(socPct)}, ${t.status.charge[direction]}`}
        className="soc-bar"
        data-tone={tone}
      >
        <span className="soc-fill" style={{ width: `${socPct}%` }} />
      </div>
      <span className="soc-text">{t.status.soc(socPct)}</span>
      {direction === 'charging' && <ChevronsUp aria-hidden size={14} className="text-status-ok" />}
      {direction === 'discharging' && (
        <ChevronsDown aria-hidden size={14} className="text-status-warning" />
      )}
    </div>
  );
}

/** Setelan daya beban, terlihat tanpa memilih komponennya; diatur lewat inspektur. */
function LoadPowerChip({ id, item }: NodeStatusProps) {
  const settingW = useCircuitStore(
    (state) => state.doc.components.find((part) => part.id === id)?.powerSettingW,
  );
  if (item.category !== 'load-dc' && item.category !== 'load-ac') return null;
  return (
    <span
      role="img"
      aria-label={`${t.status.loadPowerSetting(item.name)}: ${t.status.loadPowerValue(settingW ?? item.electrical.maxPowerW)}`}
      className="power-chip"
    >
      {t.status.loadPowerValue(settingW ?? item.electrical.maxPowerW)}
    </span>
  );
}

interface NodeStatusProps {
  id: string;
  item: CatalogItem;
}

/**
 * Tampilan keadaan sebuah komponen di luar gambarnya: deret indikator di atas nama (LED, LCD, bar
 * SoC, setelan daya beban) serta tanda kondisi dan tombol reset di pojok kanan atas.
 */
export const NodeStatus = memo(function NodeStatus({ id, item }: NodeStatusProps) {
  const { category } = item;
  const hasLed = category === 'scc-pwm' || category === 'inverter-offgrid';
  const isLoad = category === 'load-dc' || category === 'load-ac';
  const hasStrip = hasLed || isLoad || category === 'battery';
  return (
    <>
      {hasStrip && (
        <div className="node-strip">
          {hasLed && <StatusLed id={id} item={item} />}
          {category === 'scc-pwm' && <SccLcd id={id} item={item} />}
          {category === 'battery' && <SocBar id={id} item={item} />}
          {isLoad && <LoadPowerChip id={id} item={item} />}
        </div>
      )}
      <ConditionBadge id={id} item={item} />
    </>
  );
});
