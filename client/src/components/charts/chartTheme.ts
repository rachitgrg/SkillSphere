/** Shared Recharts styling for the dark glass theme. */
export const chartTheme = {
  grid: '#1e293b',
  axis: '#64748b',
  series: ['#6366f1', '#22d3ee', '#a855f7', '#22c55e', '#f59e0b', '#ef4444'],
  tooltip: { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' },
};

/** "₹12k" style ticks for money axes. */
export const inrTick = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);
