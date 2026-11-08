// Solar model for Sol: arc geometry inputs, Sunrise-Sunset API data, and formatting.
// Pure functions plus a small per-location/date cache; no React and no canvas here.

export const SUNRISE_SUNSET_API = "https://api.sunrise-sunset.org/json";

export type SunTimes = {
  civilTwilightBegin: string;
  civilTwilightEnd: string;
  /** Seconds of daylight between sunrise and sunset. */
  dayLengthSeconds: number;
  solarNoon: string;
  /** "live" when the API answered, "computed" when the local estimate is used. */
  source: "computed" | "live";
  sunrise: string;
  sunset: string;
};

export type SunInputs = {
  dayOfYear: number;
  latitude: number;
  longitude: number;
};

const DAY_MS = 86_400_000;

/** Solar declination in degrees for a day of the year (1-365). */
export function solarDeclination(dayOfYear: number): number {
  return 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
}

/** Height of the sun at solar noon, in degrees above the horizon (can be negative in polar night). */
export function solarNoonAltitude(latitude: number, dayOfYear: number): number {
  return 90 - Math.abs(latitude - solarDeclination(dayOfYear));
}

/** Hours of daylight from the sunrise equation; 0 in polar night, 24 under the midnight sun. */
export function dayLengthHours(latitude: number, dayOfYear: number): number {
  const declination = (solarDeclination(dayOfYear) * Math.PI) / 180;
  const latitudeRad = (latitude * Math.PI) / 180;
  const cosHourAngle = -Math.tan(latitudeRad) * Math.tan(declination);

  if (cosHourAngle >= 1) return 0;
  if (cosHourAngle <= -1) return 24;

  return (2 * Math.acos(cosHourAngle) * 180) / Math.PI / 15;
}

/** Calendar date for a day of the year in the given year (local time, midnight). */
export function dateForDayOfYear(dayOfYear: number, year: number): Date {
  return new Date(year, 0, Math.round(dayOfYear));
}

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local estimate used when the API cannot be reached: noon at 12:00, twilight 30 minutes out. */
export function computeSunTimes({ dayOfYear, latitude }: SunInputs, year: number): SunTimes {
  const hours = dayLengthHours(latitude, dayOfYear);
  const noon = dateForDayOfYear(dayOfYear, year);
  noon.setHours(12, 0, 0, 0);
  const halfDayMs = (hours * 3_600_000) / 2;
  const sunrise = new Date(noon.getTime() - halfDayMs);
  const sunset = new Date(noon.getTime() + halfDayMs);

  return {
    civilTwilightBegin: new Date(sunrise.getTime() - 30 * 60_000).toISOString(),
    civilTwilightEnd: new Date(sunset.getTime() + 30 * 60_000).toISOString(),
    dayLengthSeconds: hours * 3600,
    solarNoon: noon.toISOString(),
    source: "computed",
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
  };
}

export function sunTimesCacheKey({ dayOfYear, latitude, longitude }: SunInputs, year: number): string {
  return `${latitude.toFixed(1)}_${longitude.toFixed(1)}_${isoDate(dateForDayOfYear(dayOfYear, year))}`;
}

type ApiResults = {
  civil_twilight_begin: string;
  civil_twilight_end: string;
  day_length: number;
  solar_noon: string;
  sunrise: string;
  sunset: string;
};

export function parseSunriseSunsetResponse(json: unknown): SunTimes | null {
  if (!json || typeof json !== "object") return null;
  const { results, status } = json as { results?: Partial<ApiResults>; status?: string };
  if (status !== "OK" || !results) return null;
  const { civil_twilight_begin, civil_twilight_end, day_length, solar_noon, sunrise, sunset } = results;
  if (
    typeof civil_twilight_begin !== "string" ||
    typeof civil_twilight_end !== "string" ||
    typeof day_length !== "number" ||
    typeof solar_noon !== "string" ||
    typeof sunrise !== "string" ||
    typeof sunset !== "string"
  ) {
    return null;
  }

  return {
    civilTwilightBegin: civil_twilight_begin,
    civilTwilightEnd: civil_twilight_end,
    dayLengthSeconds: day_length,
    solarNoon: solar_noon,
    source: "live",
    sunrise,
    sunset,
  };
}

const sunTimesCache = new Map<string, SunTimes>();
const pendingRequests = new Map<string, Promise<SunTimes>>();

/** Cached times for these inputs, or null while they have not been fetched yet. */
export function getCachedSunTimes(inputs: SunInputs, year: number): SunTimes | null {
  return sunTimesCache.get(sunTimesCacheKey(inputs, year)) ?? null;
}

/** API times for these inputs (cached); falls back to the local estimate when the request fails. */
export function loadSunTimes(
  inputs: SunInputs,
  year: number,
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<SunTimes> {
  const key = sunTimesCacheKey(inputs, year);
  const cached = sunTimesCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const date = isoDate(dateForDayOfYear(inputs.dayOfYear, year));
  const url = `${SUNRISE_SUNSET_API}?lat=${inputs.latitude}&lng=${inputs.longitude}&date=${date}&formatted=0`;
  const request = fetcher(url)
    .then((response) => response.json())
    .then((json) => parseSunriseSunsetResponse(json) ?? computeSunTimes(inputs, year))
    .catch(() => computeSunTimes(inputs, year))
    .then((times) => {
      sunTimesCache.set(key, times);
      pendingRequests.delete(key);
      return times;
    });

  pendingRequests.set(key, request);
  return request;
}

/** Test helper: forget cached and pending API results. */
export function clearSunTimesCache(): void {
  sunTimesCache.clear();
  pendingRequests.clear();
}

/**
 * Where the sun sits on the daytime arc for the current time of day, 0 = sunrise, 1 = sunset.
 * At night it waits at sunset until the middle of the night, then at sunrise.
 */
export function sunProgress(times: SunTimes | null, nowMs: number): number {
  if (!times) return 0.5;
  const sunrise = new Date(times.sunrise).getTime();
  const sunset = new Date(times.sunset).getTime();
  const daylightMs = sunset - sunrise;
  if (!(daylightMs > 0)) return 0.5;
  const sinceSunrise = (((nowMs - sunrise) % DAY_MS) + DAY_MS) % DAY_MS;
  if (sinceSunrise <= daylightMs) return sinceSunrise / daylightMs;
  return sinceSunrise - daylightMs < (DAY_MS - daylightMs) / 2 ? 1 : 0;
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", hour12: true, minute: "2-digit" });
}

export function formatDayLength(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

export function dayOfYearFor(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.min(365, Math.max(1, Math.floor((date.getTime() - startOfYear.getTime()) / DAY_MS)));
}
