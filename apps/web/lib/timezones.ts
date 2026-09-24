// A curated fallback for engines without Intl.supportedValuesOf("timeZone")
// (e.g. older Safari). Covers one representative zone per UTC offset/region
// so the dropdown is never empty.
const FALLBACK_TIME_ZONES: readonly string[] = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Tunis",
  "America/Anchorage",
  "America/Bogota",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

function supportedTimeZones(): readonly string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    return supportedValuesOf("timeZone");
  }
  return FALLBACK_TIME_ZONES;
}

/**
 * Every IANA time zone the current runtime knows about, plus `extra` (e.g. a
 * schedule's already-saved value) so a dropdown never silently drops it.
 */
export function listTimeZones(extra?: string): readonly string[] {
  const zones = new Set(supportedTimeZones());
  if (extra) {
    zones.add(extra);
  }
  return Array.from(zones).sort((a, b) => a.localeCompare(b));
}
