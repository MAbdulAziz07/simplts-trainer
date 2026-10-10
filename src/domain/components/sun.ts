// Profil matahari dan suhu lingkungan harian (docs/MODEL_FISIKA.md §11).
// Jam = jam lokal desimal (10.5 = 10:30); hari = hari ke-n dalam tahun (1..365).

export interface SunSite {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Meridian acuan zona waktu (WIB = 105). */
  standardMeridianDeg: number;
  /** Iradiasi horizontal langit cerah di zenit. */
  peakIrradianceWm2: number;
  /** Eksponen `p` pada cosθz. */
  zenithExponent: number;
  /** Konversi ke bidang miring. */
  tiltFactor: number;
}

export interface DayTempProfile {
  minTempC: number;
  /** Suhu tertinggi = `maxTempBaseC + maxTempPerCloudFactorC · kc`. */
  maxTempBaseC: number;
  maxTempPerCloudFactorC: number;
  minTempHour: number;
  maxTempHour: number;
}

/** Batam (§11.1); seluruhnya asumsi. [PERLU VERIFIKASI] */
export const BATAM_SITE: SunSite = {
  latitudeDeg: 1.13,
  longitudeDeg: 104.05,
  standardMeridianDeg: 105,
  peakIrradianceWm2: 1000,
  zenithExponent: 1.2,
  tiltFactor: 1.0,
};

/** Suhu harian Batam (§11.1); asumsi. [PERLU VERIFIKASI] */
export const BATAM_DAY_TEMP: DayTempProfile = {
  minTempC: 24,
  maxTempBaseC: 29,
  maxTempPerCloudFactorC: 3,
  minTempHour: 6,
  maxTempHour: 14.5,
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Deklinasi matahari δ (derajat). */
export function sunDeclinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin(toRad((360 / 365) * (284 + dayOfYear)));
}

/** Persamaan waktu EoT (menit). */
export function sunEquationOfTimeMin(dayOfYear: number): number {
  const b = toRad((360 / 365) * (dayOfYear - 81));
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/** Jam surya dari jam lokal. */
export function sunSolarHour(clockHour: number, dayOfYear: number, site = BATAM_SITE): number {
  const correctionMin =
    4 * (site.longitudeDeg - site.standardMeridianDeg) + sunEquationOfTimeMin(dayOfYear);
  return clockHour + correctionMin / 60;
}

/** cosθz (kosinus sudut zenit); negatif = matahari di bawah cakrawala. */
export function sunCosZenith(clockHour: number, dayOfYear: number, site = BATAM_SITE): number {
  const latitude = toRad(site.latitudeDeg);
  const declination = toRad(sunDeclinationDeg(dayOfYear));
  const hourAngle = toRad(15 * (sunSolarHour(clockHour, dayOfYear, site) - 12));
  return (
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  );
}

/** Iradiasi pada bidang panel: G = kc · Gpeak · max(cosθz, 0)^p · ftilt. Malam = 0. */
export function sunIrradianceWm2(
  clockHour: number,
  dayOfYear: number,
  cloudFactor = 1,
  site = BATAM_SITE,
): number {
  const cosZenith = Math.max(sunCosZenith(clockHour, dayOfYear, site), 0);
  const clearSkyWm2 = site.peakIrradianceWm2 * cosZenith ** site.zenithExponent;
  return Math.max(cloudFactor, 0) * clearSkyWm2 * site.tiltFactor;
}

/** Suhu lingkungan: setengah-kosinus naik dari jam terdingin ke terpanas, lalu turun. */
export function sunAmbientTempC(
  clockHour: number,
  cloudFactor = 1,
  profile = BATAM_DAY_TEMP,
): number {
  const { minTempC, minTempHour, maxTempHour } = profile;
  const maxTempC = profile.maxTempBaseC + profile.maxTempPerCloudFactorC * cloudFactor;
  const riseHours = maxTempHour - minTempHour;
  // Jam sejak titik terdingin, 0..24.
  const sinceMinHours = (((clockHour - minTempHour) % 24) + 24) % 24;
  const halfSwingC = (maxTempC - minTempC) * 0.5;
  if (sinceMinHours <= riseHours) {
    return minTempC + halfSwingC * (1 - Math.cos((Math.PI * sinceMinHours) / riseHours));
  }
  const fallPhase = (sinceMinHours - riseHours) / (24 - riseHours);
  return maxTempC - halfSwingC * (1 - Math.cos(Math.PI * fallPhase));
}
