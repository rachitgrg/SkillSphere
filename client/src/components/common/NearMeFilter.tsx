import { useState } from 'react';
import toast from 'react-hot-toast';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { CITIES, nearestCity } from '../../utils/constants';

export interface NearMeValue {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

const RADII = [5, 10, 25, 50, 100];
const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';

/** Picks a point (browser location or a city with built-in coordinates) and a radius. No paid geocoding. */
export function NearMeFilter({ value, onChange }: { value: NearMeValue; onChange: (next: NearMeValue) => void }) {
  const [locating, setLocating] = useState(false);
  const active = value.lat !== undefined && value.lng !== undefined;
  const city = active ? nearestCity([value.lng!, value.lat!]) : undefined;

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Your browser does not support location');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)), radiusKm: value.radiusKm ?? 25 });
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location; pick a city instead');
      },
      { timeout: 10_000 }
    );
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs text-slate-400 mb-1 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" /> Near
      </legend>
      <div className="flex gap-2">
        <label htmlFor="near-city" className="sr-only">City</label>
        <select
          id="near-city"
          className={fieldClass}
          value={active ? city?.name ?? '' : ''}
          onChange={(e) => {
            const picked = CITIES.find((c) => c.name === e.target.value);
            onChange(picked ? { lng: picked.coordinates[0], lat: picked.coordinates[1], radiusKm: value.radiusKm ?? 25 } : {});
          }}
        >
          <option value="">Anywhere</option>
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button type="button" onClick={locate} disabled={locating} aria-label="Use my location" title="Use my location" className="btn-secondary px-2.5 py-2 focus-ring">
          <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
        </button>
        {active && (
          <button type="button" onClick={() => onChange({})} aria-label="Clear location" className="btn-ghost px-2 py-2">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {active && (
        <>
          <label htmlFor="near-radius" className="sr-only">Radius</label>
          <select id="near-radius" className={fieldClass} value={value.radiusKm ?? 25} onChange={(e) => onChange({ ...value, radiusKm: Number(e.target.value) })}>
            {RADII.map((r) => (
              <option key={r} value={r}>Within {r} km</option>
            ))}
          </select>
        </>
      )}
    </fieldset>
  );
}
