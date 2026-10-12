// Lingkungan simulasi dari setelan bilah kendali: jam, awan, dan iradiasi/suhu yang mengikuti
// profil matahari (docs/MODEL_FISIKA.md §11) atau disetel tangan.
import { sunAmbientTempC, sunIrradianceWm2, type SolverEnvironment } from '@/domain';

/** Pengali waktu simulasi terhadap waktu nyata (docs/ARSITEKTUR.md §2 butir 2). */
export const SIM_SPEEDS = [1, 60, 600] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

export const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = 3600;

export const IRRADIANCE_MAX_WM2 = 1200;
export const AMBIENT_TEMP_MIN_C = 15;
export const AMBIENT_TEMP_MAX_C = 45;

/** Faktor awan saat langit tertutup penuh = nilai "hujan" §11.1. [PERLU VERIFIKASI] */
const OVERCAST_CLOUD_FACTOR = 0.12;

export interface EnvSettings {
  /** Jam lokal saat waktu simulasi 0 s. */
  startHour: number;
  /** Hari ke-n dalam tahun untuk posisi matahari. */
  dayOfYear: number;
  /** Tutupan awan 0–100; 0 = cerah. */
  cloudCoverPct: number;
  /** Terisi = iradiasi disetel tangan; kosong = mengikuti jam dan awan. */
  manualIrradianceWm2?: number;
  /** Terisi = suhu lingkungan disetel tangan; kosong = mengikuti jam dan awan. */
  manualAmbientTempC?: number;
}

/** Mulai pukul 10:00 pada 21 Maret, langit cerah. [PERLU VERIFIKASI] */
export const DEFAULT_ENV: EnvSettings = { startHour: 10, dayOfYear: 80, cloudCoverPct: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const wrapHour = (hour: number) => ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;

/** Jam lokal desimal (10.5 = 10:30) pada waktu simulasi `timeS`. */
export function clockHourAt(settings: EnvSettings, timeS: number): number {
  return wrapHour(settings.startHour + timeS / SECONDS_PER_HOUR);
}

/** Setelan yang membuat jam menunjukkan `clockHour` sekarang; waktu simulasi tidak diubah. */
export function withClockHour(
  settings: EnvSettings,
  timeS: number,
  clockHour: number,
): EnvSettings {
  return { ...settings, startHour: wrapHour(clockHour - timeS / SECONDS_PER_HOUR) };
}

/** Faktor awan `kc` (§11.1): 1 saat cerah, turun lurus sampai nilai hujan saat tertutup penuh. */
export function cloudFactorOf(cloudCoverPct: number): number {
  return 1 - (1 - OVERCAST_CLOUD_FACTOR) * (clamp(cloudCoverPct, 0, 100) / 100);
}

/** Iradiasi pada bidang panel dan suhu lingkungan pada waktu simulasi `timeS`. */
export function environmentAt(settings: EnvSettings, timeS: number): SolverEnvironment {
  const hour = clockHourAt(settings, timeS);
  const cloudFactor = cloudFactorOf(settings.cloudCoverPct);
  return {
    irradianceWm2:
      settings.manualIrradianceWm2 === undefined
        ? sunIrradianceWm2(hour, settings.dayOfYear, cloudFactor)
        : clamp(settings.manualIrradianceWm2, 0, IRRADIANCE_MAX_WM2),
    ambientTempC:
      settings.manualAmbientTempC === undefined
        ? sunAmbientTempC(hour, cloudFactor)
        : clamp(settings.manualAmbientTempC, AMBIENT_TEMP_MIN_C, AMBIENT_TEMP_MAX_C),
  };
}

/** `10.5` → `10:30`. */
export function formatClock(clockHour: number): string {
  const totalMin = Math.floor(wrapHour(clockHour) * 60 + 1e-6);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(Math.floor(totalMin / 60))}:${two(totalMin % 60)}`;
}
