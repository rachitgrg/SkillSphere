import React from 'react';
import type { AvailabilitySlot } from '../../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekly availability template (bookings and the full scheduler arrive with plan 4.12). */
export const AvailabilityCalendar: React.FC<{ slots: AvailabilitySlot[] }> = ({ slots }) => (
  <ul className="grid grid-cols-7 gap-1.5 text-center" aria-label="Weekly availability">
    {DAYS.map((day, i) => {
      const daySlots = slots.filter((s) => s.dayOfWeek === i);
      return (
        <li key={day} className={`rounded-lg border p-2 ${daySlots.length ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
          <div className="text-xs font-medium text-slate-300">{day}</div>
          {daySlots.length ? (
            daySlots.map((s) => (
              <div key={s.startTime} className="text-[10px] text-emerald-300 mt-1 leading-tight">
                {s.startTime}
                <br />
                {s.endTime}
              </div>
            ))
          ) : (
            <div className="text-[10px] text-slate-600 mt-1">—</div>
          )}
        </li>
      );
    })}
  </ul>
);
