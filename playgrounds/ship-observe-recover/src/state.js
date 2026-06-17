export const state = {
  incidentMode: false,
  requestCount: 0,
  errorCount: 0,
  latenciesMs: []
};

export function recordLatency(ms) {
  state.latenciesMs.push(ms);
  if (state.latenciesMs.length > 5000) {
    state.latenciesMs.shift();
  }
}

export function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
