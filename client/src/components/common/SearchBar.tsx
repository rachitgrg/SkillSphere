import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { debounce } from '../../utils/helpers';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  className?: string;
  defaultValue?: string;
}

export function SearchBar({ placeholder = 'Search...', onSearch, className = '', defaultValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((q: unknown) => onSearch(q as string), 300), [onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="glass-input w-full pl-10 pr-10 py-2.5 text-sm"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
