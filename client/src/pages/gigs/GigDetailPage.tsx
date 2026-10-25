import React, { useState } from 'react';
import { useParams } from 'react-router';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Clock, IndianRupee, Calendar, MapPin, Share2, Heart, ShieldCheck } from 'lucide-react';
import { ApplyModal } from './ApplyModal';


export const GigDetailPage: React.FC = () => {
  const { id } = useParams();
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-8 rounded-3xl border border-slate-800">
              <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-white leading-tight">Senior React Native Developer for Fintech Mobile App</h1>
                <div className="flex gap-2">
                  <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"><Heart className="w-5 h-5" /></button>
                  <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"><Share2 className="w-5 h-5" /></button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 mb-8 text-sm text-slate-300">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1 text-indigo-400" /> Posted 2 hours ago</span>
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-cyan-400" /> Worldwide</span>
                <span className="flex items-center"><ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" /> Payment Verified</span>
              </div>
              
              <div className="border-t border-slate-800 py-6">
                <h3 className="text-lg font-semibold text-white mb-4">Project Description</h3>
                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed">
                  <p>We are looking for an experienced React Native developer to help us build a new mobile application for our fintech startup.</p>
                  <p>Responsibilities include:</p>
                  <ul>
                    <li>Developing new user-facing features using React Native</li>
                    <li>Building reusable components and front-end libraries</li>
                    <li>Translating designs and wireframes into high-quality code</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-slate-800 py-6">
                <h3 className="text-lg font-semibold text-white mb-4">Skills Required</h3>
                <div className="flex flex-wrap gap-2">
                  {['React Native', 'Redux', 'TypeScript', 'REST APIs', 'Mobile UI'].map(skill => (
                    <Badge key={skill} className="bg-slate-800 text-slate-300 px-3 py-1 text-sm">{skill}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-slate-400 text-xs flex items-center mb-1"><IndianRupee className="w-3 h-3 mr-1" /> Budget</div>
                  <div className="text-2xl font-bold text-white">₹5,000</div>
                  <div className="text-xs text-slate-500">Fixed Price</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs flex items-center mb-1"><Calendar className="w-3 h-3 mr-1" /> Duration</div>
                  <div className="text-xl font-bold text-white">2 Months</div>
                  <div className="text-xs text-slate-500">Est. Time</div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsApplyModalOpen(true)}
                className="btn-primary w-full py-3 rounded-xl flex justify-center text-lg font-medium mb-3"
              >
                Apply Now
              </button>
            </div>
            
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <h3 className="font-semibold text-white mb-4">About the Client</h3>
              <div className="flex items-center gap-3 mb-4">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704e" />
                <div>
                  <div className="font-medium text-white">TechCorp Inc.</div>
                  <div className="text-xs text-slate-400">United States</div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between"><span>Jobs Posted</span><span className="font-medium text-white">12</span></div>
                <div className="flex justify-between"><span>Hire Rate</span><span className="font-medium text-white">85%</span></div>
                <div className="flex justify-between"><span>Total Spent</span><span className="font-medium text-white">₹4.5L+</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {id && <ApplyModal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} gigId={id} />}
    </div>
  );
};
