import React from 'react';
import { Avatar } from '../../components/common/Avatar';
import { SkillBadge } from '../../components/profile/SkillBadge';
import { PortfolioCard } from '../../components/profile/PortfolioCard';
import { MapPin, Link as LinkIcon, Calendar, Edit } from 'lucide-react';
import { Link } from 'react-router';

export const ProfilePage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Cover & Avatar */}
      <div className="relative rounded-3xl overflow-hidden glass-card border border-slate-800">
        <div className="h-48 bg-gradient-to-r from-indigo-600 to-cyan-600"></div>
        <div className="px-8 pb-8 pt-0 relative flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 md:-mt-12">
          <div className="relative">
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="xl" className="border-4 border-slate-900 ring-2 ring-slate-800" />
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
          </div>
          
          <div className="flex-1 text-center md:text-left mt-2">
            <h1 className="text-3xl font-bold text-white">Alex Developer</h1>
            <p className="text-indigo-400 font-medium">Senior Full Stack Engineer</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 text-sm text-slate-400">
              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> San Francisco, CA</span>
              <span className="flex items-center"><LinkIcon className="w-4 h-4 mr-1" /> alex.dev</span>
              <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> Joined 2021</span>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <Link to="/freelancer/profile/edit" className="btn-secondary flex-1 md:flex-none justify-center px-4 py-2 rounded-xl flex items-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
              <Edit className="w-4 h-4 mr-2" /> Edit Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4">About Me</h3>
            <p className="text-slate-300 leading-relaxed">
              I am a passionate Full Stack Developer with 5+ years of experience building scalable web applications. 
              I specialize in React, Node.js, and cloud architecture. I love turning complex problems into simple, beautiful, and intuitive designs.
            </p>
          </div>
          
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="text-xl font-bold text-white mb-4">Portfolio</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <PortfolioCard 
                title="E-Commerce Dashboard" 
                description="A complete admin panel for managing online stores." 
                imageUrl="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600" 
              />
              <PortfolioCard 
                title="Fintech Mobile App" 
                description="Cross-platform app for tracking expenses." 
                imageUrl="https://images.unsplash.com/photo-1563986768494-4dee2763ff0f?auto=format&fit=crop&q=80&w=600" 
              />
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="font-bold text-white mb-4">Skills</h3>
            <div className="flex flex-wrap gap-2">
              <SkillBadge skill="React" proficiency="expert" />
              <SkillBadge skill="Node.js" proficiency="expert" />
              <SkillBadge skill="TypeScript" proficiency="intermediate" />
              <SkillBadge skill="PostgreSQL" proficiency="intermediate" />
              <SkillBadge skill="AWS" proficiency="beginner" />
            </div>
          </div>
          
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="font-bold text-white mb-4">Stats</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Job Success</span>
                  <span className="text-emerald-400 font-medium">98%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full w-[98%]"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">On Time Delivery</span>
                  <span className="text-indigo-400 font-medium">100%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full w-[100%]"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
