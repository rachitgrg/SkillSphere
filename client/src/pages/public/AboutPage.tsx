import React from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-20 max-w-4xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 text-center">About SkillSphere</h1>
        <div className="glass-card p-8 rounded-2xl border border-slate-800 prose prose-invert max-w-none">
          <p className="text-lg text-slate-300 mb-6">
            SkillSphere was founded with a simple mission: to create a fair, transparent, and efficient marketplace for independent professionals and businesses to collaborate.
          </p>
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Our Vision</h2>
          <p className="text-slate-300 mb-6">
            We believe the future of work is decentralized and borderless. Our platform removes the friction from finding talent, managing projects, and securely processing payments globally.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};
