import { Cloud, Moon, Sun, SunDim, Thermometer } from 'lucide-react';
import { t } from '@/i18n';
import {
  AMBIENT_TEMP_MAX_C,
  AMBIENT_TEMP_MIN_C,
  HOURS_PER_DAY,
  IRRADIANCE_MAX_WM2,
  formatClock,
  useSimStore,
} from '@/store';
import { SliderField } from './SliderField';

const CLOCK_STEP_H = 0.25;
const IRRADIANCE_STEP_WM2 = 10;
const CLOUD_STEP_PCT = 5;
const AMBIENT_STEP_C = 0.5;
/** Di bawah ini jam diberi ikon bulan. */
const NIGHT_IRRADIANCE_WM2 = 1;

/** Jam simulasi; menggesernya memindahkan matahari tanpa mengubah keadaan rangkaian. */
function ClockField() {
  const clockHour = useSimStore((state) => state.clockHour);
  const isNight = useSimStore((state) => state.environment.irradianceWm2 < NIGHT_IRRADIANCE_WM2);
  const setClockHour = useSimStore((state) => state.setClockHour);
  return (
    <SliderField
      icon={isNight ? Moon : Sun}
      label={t.sim.clock}
      valueText={formatClock(clockHour)}
      min={0}
      max={HOURS_PER_DAY - CLOCK_STEP_H}
      step={CLOCK_STEP_H}
      value={Math.floor(clockHour / CLOCK_STEP_H) * CLOCK_STEP_H}
      onChange={setClockHour}
    />
  );
}

/** Iradiasi pada bidang panel: mengikuti jam dan awan, atau disetel tangan. */
function IrradianceField() {
  const irradianceWm2 = useSimStore((state) => Math.round(state.environment.irradianceWm2));
  const isAuto = useSimStore((state) => state.settings.manualIrradianceWm2 === undefined);
  const patchSettings = useSimStore((state) => state.patchSettings);
  return (
    <SliderField
      icon={SunDim}
      label={t.sim.irradiance}
      valueText={t.sim.irradianceValue(irradianceWm2)}
      min={0}
      max={IRRADIANCE_MAX_WM2}
      step={IRRADIANCE_STEP_WM2}
      value={irradianceWm2}
      onChange={(value) => patchSettings({ manualIrradianceWm2: value })}
      auto={{ on: isAuto, onEnable: () => patchSettings({ manualIrradianceWm2: undefined }) }}
    />
  );
}

function CloudField() {
  const cloudCoverPct = useSimStore((state) => state.settings.cloudCoverPct);
  const patchSettings = useSimStore((state) => state.patchSettings);
  return (
    <SliderField
      icon={Cloud}
      label={t.sim.cloud}
      valueText={t.sim.cloudValue(cloudCoverPct)}
      min={0}
      max={100}
      step={CLOUD_STEP_PCT}
      value={cloudCoverPct}
      onChange={(value) => patchSettings({ cloudCoverPct: value })}
    />
  );
}

function AmbientField() {
  const ambientTempC = useSimStore((state) => Math.round(state.environment.ambientTempC * 10) / 10);
  const isAuto = useSimStore((state) => state.settings.manualAmbientTempC === undefined);
  const patchSettings = useSimStore((state) => state.patchSettings);
  return (
    <SliderField
      icon={Thermometer}
      label={t.sim.ambient}
      valueText={t.sim.ambientValue(ambientTempC)}
      min={AMBIENT_TEMP_MIN_C}
      max={AMBIENT_TEMP_MAX_C}
      step={AMBIENT_STEP_C}
      value={ambientTempC}
      onChange={(value) => patchSettings({ manualAmbientTempC: value })}
      auto={{ on: isAuto, onEnable: () => patchSettings({ manualAmbientTempC: undefined }) }}
    />
  );
}

/** Jam, iradiasi, awan, dan suhu lingkungan (docs/UX.md §2.1). */
export function EnvControls() {
  return (
    <>
      <ClockField />
      <IrradianceField />
      <CloudField />
      <AmbientField />
    </>
  );
}
