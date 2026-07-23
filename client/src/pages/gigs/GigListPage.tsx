import React from 'react';
import { GigCard } from '../../components/gigs/GigCard';
import { GigFilters } from '../../components/gigs/GigFilters';
import { Input } from '../../components/common/Input';
import { Search } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

export const GigListPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Find Freelance Work</h1>
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for gigs (e.g. React Developer)" 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/4 flex-shrink-0">
            <GigFilters />
          </div>
          
          <div className="w-full lg:w-3/4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <GigCard key={i} gig={{ id: i, title: `Project ${i}: React Developer Needed`, budget: `${i}000`, client: { name: 'Startup Inc.' } }} />
              ))}
            </div>
            
            <div className="mt-10 flex justify-center">
              <button className="btn-secondary px-6 py-2 rounded-lg bg-slate-900 text-white border border-slate-700 hover:bg-slate-800">Load More</button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
