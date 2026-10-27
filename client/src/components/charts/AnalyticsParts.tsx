import type { AnalyticsPeriod } from '../../types';

/** Titled glass card that frames one chart on the analytics pages. */
export const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-card p-6 rounded-2xl border border-slate-800">
    <h2 className="font-semibold text-white mb-4">{title}</h2>
    {children}
  </section>
);

export const PeriodSelect = ({ value, onChange }: { value: AnalyticsPeriod; onChange: (period: AnalyticsPeriod) => void }) => (
  <select aria-label="Period" value={value} onChange={(e) => onChange(e.target.value as AnalyticsPeriod)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
    <option value="30d">Last 30 days</option>
    <option value="90d">Last 90 days</option>
    <option value="12m">Last 12 months</option>
  </select>
);
