import React from 'react';
import { AvailabilityCalendar } from '../../components/profile/AvailabilityCalendar';

export const SchedulerPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Availability Scheduler</h1>
      <AvailabilityCalendar />
    </div>
  );
};
