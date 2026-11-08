// Solar position for Sol, after the NOAA Solar Calculator (Meeus, "Astronomical Algorithms").
// Accurate to about a minute for sunrise/sunset between 1800 and 2100. Pure functions, no I/O.

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;

/** Julian century from J2000.0 for a UTC timestamp. */
function julianCentury(utcMs: number): number {
  return (utcMs / DAY_MS + 2440587.5 - 2451545.0) / 36525;
}

export type SolarPosition = {
  /** Degrees above the horizon (negative below), refraction-corrected. */
  elevation: number;
  /** Degrees clockwise from north. */
  azimuth: number;
};

/** Solar declination (degrees) and equation of time (minutes) at a UTC instant. */
export function solarDeclinationAndEquationOfTime(utcMs: number): { declination: number; equationOfTime: number } {
  const t = julianCentury(utcMs);
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const trueLongitude = meanLongitude + center;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLongitude * RAD)) / RAD;
  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const l0 = meanLongitude * RAD;
  const m = meanAnomaly * RAD;
  const equationOfTime =
    (4 / RAD) *
    (y * Math.sin(2 * l0) -
      2 * eccentricity * Math.sin(m) +
      4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l0) -
      0.5 * y * y * Math.sin(4 * l0) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * m));
  return { declination, equationOfTime };
}

function refraction(elevation: number): number {
  if (elevation > 85) return 0;
  const te = Math.tan(elevation * RAD);
  if (elevation > 5) return (58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5) / 3600;
  if (elevation > -0.575) return (1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)))) / 3600;
  return -20.774 / te / 3600;
}

/** Sun elevation and azimuth seen from latitude/longitude (degrees, east positive) at a UTC instant. */
export function solarPosition(latitude: number, longitude: number, utcMs: number): SolarPosition {
  const { declination, equationOfTime } = solarDeclinationAndEquationOfTime(utcMs);
  const utcMinutes = (((utcMs % DAY_MS) + DAY_MS) % DAY_MS) / 60_000;
  const trueSolarMinutes = (((utcMinutes + equationOfTime + 4 * longitude) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarMinutes / 4 < 0 ? trueSolarMinutes / 4 + 180 : trueSolarMinutes / 4 - 180;
  const lat = latitude * RAD;
  const dec = declination * RAD;
  const cosZenith = Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle * RAD)));
  const zenith = Math.acos(cosZenith) / RAD;
  const geometric = 90 - zenith;
  const sinZenith = Math.sin(zenith * RAD);
  let azimuth = 180;
  if (Math.abs(sinZenith) > 1e-9) {
    const cosAz = (Math.sin(lat) * cosZenith - Math.sin(dec)) / (Math.cos(lat) * sinZenith);
    const az = Math.acos(Math.min(1, Math.max(-1, cosAz))) / RAD;
    azimuth = hourAngle > 0 ? (az + 180) % 360 : (540 - az) % 360;
  }
  return { azimuth, elevation: geometric + refraction(geometric) };
}

// ─── Place, date and time zone ───

export type SolPlace = { latitude: number; longitude: number; timeZone: string | null };

/** Offset (minutes east of UTC) of an IANA zone at an instant, or the nearest whole hour from longitude. */
export function utcOffsetMinutes(place: SolPlace, utcMs: number): number {
  if (place.timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      hourCycle: "h23",
      minute: "numeric",
      month: "numeric",
      timeZone: place.timeZone,
      year: "numeric",
    }).formatToParts(new Date(utcMs));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return Math.round((asUtc - Math.floor(utcMs / 60_000) * 60_000) / 60_000);
  }
  return Math.round(place.longitude / 15) * 60;
}

export function formatUtcOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** UTC timestamp of local midnight (in the place's zone) for a day of the year. */
export function localMidnightUtc(place: SolPlace, year: number, dayOfYear: number): number {
  const naive = Date.UTC(year, 0, Math.round(dayOfYear));
  // Two passes settle DST transitions where the offset differs before and after midnight
  let utc = naive - utcOffsetMinutes(place, naive) * 60_000;
  utc = naive - utcOffsetMinutes(place, utc) * 60_000;
  return utc;
}

// ─── Day events ───

export type SolDay = {
  /** Local-time UTC timestamps; null when the event does not happen that day. */
  astronomicalDawn: number | null;
  astronomicalDusk: number | null;
  civilDawn: number | null;
  civilDusk: number | null;
  dayLengthMinutes: number;
  goldenHourEnd: number | null;
  goldenHourStart: number | null;
  midnightUtc: number;
  noonElevation: number;
  solarNoon: number;
  sunrise: number | null;
  sunset: number | null;
  /** Elevation sampled every 5 minutes across the local day (289 samples). */
  samples: readonly number[];
};

const SAMPLE_MINUTES = 5;

function crossing(place: SolPlace, fromMs: number, toMs: number, threshold: number): number {
  let lo = fromMs;
  let hi = toMs;
  const rising = solarPosition(place.latitude, place.longitude, lo).elevation < threshold;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const above = solarPosition(place.latitude, place.longitude, mid).elevation >= threshold;
    if (above === rising) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function findCrossings(place: SolPlace, midnightUtc: number, samples: readonly number[], threshold: number): { down: number | null; up: number | null } {
  let up: number | null = null;
  let down: number | null = null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const from = midnightUtc + (i - 1) * SAMPLE_MINUTES * 60_000;
    const to = from + SAMPLE_MINUTES * 60_000;
    if (up === null && a < threshold && b >= threshold) up = crossing(place, from, to, threshold);
    if (a >= threshold && b < threshold) down = crossing(place, from, to, threshold);
  }
  return { down, up };
}

/** Everything Sol draws about one local day at one place. */
export function computeSolDay(place: SolPlace, year: number, dayOfYear: number): SolDay {
  const midnightUtc = localMidnightUtc(place, year, dayOfYear);
  const samples: number[] = [];
  for (let minute = 0; minute <= 1440; minute += SAMPLE_MINUTES) {
    samples.push(solarPosition(place.latitude, place.longitude, midnightUtc + minute * 60_000).elevation);
  }
  let noonIndex = 0;
  for (let i = 1; i < samples.length; i += 1) if (samples[i] > samples[noonIndex]) noonIndex = i;
  const sun = findCrossings(place, midnightUtc, samples, -0.833);
  const civil = findCrossings(place, midnightUtc, samples, -6);
  const astronomical = findCrossings(place, midnightUtc, samples, -18);
  const golden = findCrossings(place, midnightUtc, samples, 6);
  const daylightSamples = samples.slice(0, -1).filter((elevation) => elevation >= -0.833).length;
  const dayLengthMinutes =
    sun.up !== null && sun.down !== null && sun.down > sun.up
      ? (sun.down - sun.up) / 60_000
      : daylightSamples * SAMPLE_MINUTES;
  return {
    astronomicalDawn: astronomical.up,
    astronomicalDusk: astronomical.down,
    civilDawn: civil.up,
    civilDusk: civil.down,
    dayLengthMinutes,
    goldenHourEnd: sun.down,
    goldenHourStart: golden.down,
    midnightUtc,
    noonElevation: samples[noonIndex],
    samples,
    solarNoon: midnightUtc + noonIndex * SAMPLE_MINUTES * 60_000,
    sunrise: sun.up,
    sunset: sun.down,
  };
}

/** Day length in minutes for every day of the year (used by the year strip). */
export function yearDayLengths(place: SolPlace, year: number): number[] {
  const lengths: number[] = [];
  for (let day = 1; day <= 365; day += 1) {
    const noon = localMidnightUtc(place, year, day) + 12 * 3_600_000;
    const { declination } = solarDeclinationAndEquationOfTime(noon);
    const cosH = (Math.sin(-0.833 * RAD) - Math.sin(place.latitude * RAD) * Math.sin(declination * RAD)) /
      (Math.cos(place.latitude * RAD) * Math.cos(declination * RAD));
    lengths.push(cosH <= -1 ? 1440 : cosH >= 1 ? 0 : ((2 * Math.acos(cosH)) / RAD / 15) * 60);
  }
  return lengths;
}

// ─── Formatting ───

export function formatClock(utcMs: number | null, offsetMinutes: number): string {
  if (utcMs === null) return "—";
  const local = new Date(utcMs + offsetMinutes * 60_000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDayOfYear(year: number, dayOfYear: number): string {
  const date = new Date(Date.UTC(year, 0, Math.round(dayOfYear)));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function dayOfYearOf(utcMs: number, offsetMinutes: number): number {
  const local = new Date(utcMs + offsetMinutes * 60_000);
  const start = Date.UTC(local.getUTCFullYear(), 0, 0);
  return Math.min(365, Math.max(1, Math.floor((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - start) / DAY_MS)));
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}  ${lng}`;
}
