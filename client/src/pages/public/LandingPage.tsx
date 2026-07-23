import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { ArrowRight, Code, PenTool, TrendingUp, Shield, Globe } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 -z-10"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight">
                Where Top Talent Meets <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                  Global Opportunities
                </span>
              </h1>
              <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto">
                Join the ultimate decentralized marketplace for freelancers and clients. 
                Secure payments, transparent reviews, and zero hidden fees.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/register" className="btn-primary text-lg px-8 py-4 rounded-xl flex items-center justify-center">
                  Start Earning Now <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <Link to="/gigs" className="glass-card hover:bg-slate-800 text-white text-lg px-8 py-4 rounded-xl transition-colors border border-slate-700 flex items-center justify-center">
                  Find Talent
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why Choose SkillSphere?</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">We've rebuilt the freelance marketplace from the ground up to be fairer, faster, and more secure.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: <Shield className="w-8 h-8 text-indigo-400" />, title: "Secure Escrow", desc: "Your funds are held securely until milestones are approved." },
                { icon: <Globe className="w-8 h-8 text-cyan-400" />, title: "Global Reach", desc: "Connect with clients and talent from over 150 countries." },
                { icon: <TrendingUp className="w-8 h-8 text-emerald-400" />, title: "Low Fees", desc: "Keep more of what you earn with our industry-low 5% flat fee." }
              ].map((feat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.2 }}
                  viewport={{ once: true }}
                  className="glass-card p-8 rounded-2xl border border-slate-800 text-center hover:-translate-y-2 transition-transform duration-300"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6 border border-slate-700">
                    {feat.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feat.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};
