import React from 'react';
import { Avatar } from '../../components/common/Avatar';
import { MapPin, Globe, Star } from 'lucide-react';
import { ReviewCard } from '../../components/reviews/ReviewCard';

export const ProfilePage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="glass-card p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-8 items-center md:items-start">
        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704e" size="xl" className="border-4 border-slate-900" />
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">TechCorp Inc.</h1>
          <p className="text-slate-400 max-w-2xl">Leading provider of SaaS solutions for enterprise resource planning. We are constantly looking for talented freelancers to join our remote teams.</p>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-300 justify-center md:justify-start">
            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-indigo-400" /> New York, USA</span>
            <span className="flex items-center"><Globe className="w-4 h-4 mr-1 text-cyan-400" /> techcorp.com</span>
            <span className="flex items-center"><Star className="w-4 h-4 mr-1 text-yellow-500" /> 4.9 (124 Reviews)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-white">Open Roles</h3>
          <div className="grid sm:grid-cols-2 gap-4">
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-xl font-bold text-white">Recent Reviews</h3>
          <ReviewCard review={{ author: { name: 'Alex Developer' }, rating: 5, projectTitle: 'Frontend Dashboard', comment: 'Great client to work with, clear requirements and fast payments.' }} />
        </div>
      </div>
    </div>
  );
};
