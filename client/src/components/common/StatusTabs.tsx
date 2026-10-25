interface StatusTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface StatusTabsProps<T extends string> {
  tabs: StatusTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Controlled pill tabs used to filter lists by status. */
export function StatusTabs<T extends string>({ tabs, value, onChange, label }: StatusTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 p-1 rounded-xl bg-dark-800/50 mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-ring ${
              active ? 'bg-primary-500/20 text-primary-300' : 'text-dark-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
