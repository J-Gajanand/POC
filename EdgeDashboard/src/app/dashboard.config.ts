/**
 * Central dashboard tuning. Change these values to reconfigure live behaviour
 * without touching component logic.
 */
export const DASHBOARD_CONFIG = {
  /** How often the dashboard pulls fresh telemetry from the API (ms). */
  refreshIntervalMs: 2000,
  /** Rolling time-series window: max points kept on the temperature chart. */
  chartHistoryPoints: 30,
  /** Live event-log: max rows shown in the telemetry table. */
  tableHistoryRows: 25,
  /** A device counts as "online" if it produced data within this window (ms). */
  deviceOnlineWindowMs: 30000,
  /** Throughput window for the "recent messages" metric (ms). */
  recentWindowMs: 60000
};

/**
 * Backend timestamps are UTC but serialized without a 'Z' suffix. Parse them
 * explicitly as UTC so all client-side time math is correct.
 */
export function parseUtc(ts: string): number {
  if (!ts) { return 0; }
  const hasZone = /Z$|[+-]\d\d:?\d\d$/.test(ts);
  return new Date(hasZone ? ts : ts + 'Z').getTime();
}

/** Local wall-clock label for a UTC telemetry timestamp. */
export function timeLabel(ts: string): string {
  return new Date(parseUtc(ts)).toLocaleTimeString();
}
