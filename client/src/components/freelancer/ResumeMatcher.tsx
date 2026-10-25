import React, { useState } from 'react';
import { Button } from '../common/Button';
import { gigApi } from '../../api/gigApi';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';
import { Sparkles, FileText, Loader2, Target, Zap, AlertTriangle } from 'lucide-react';

interface CareerReport {
  targetRoles: string[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export const ResumeMatcher: React.FC = () => {
  const [resumeText, setResumeText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<CareerReport | null>(null);

  const handleMatch = async () => {
    if (!resumeText.trim()) {
      toast.error('Please paste your resume text first');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await gigApi.analyzeCareer(resumeText);
      setReport(response.data.data);
      toast.success('Career analysis complete!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to analyze resume'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Career Coach</h2>
            <p className="text-sm text-slate-400">Get personalized feedback on your resume, target roles, and areas for improvement.</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <textarea
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[150px] resize-y"
            placeholder="Paste your resume text, skills, or professional summary here..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
          
          <div className="flex justify-end">
            <Button
              onClick={handleMatch}
              isLoading={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Resume...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Get Career Advice
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results Section */}
        {report && !isProcessing && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20">
              <p className="text-indigo-200 leading-relaxed italic">
                "{report.summary}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" />
                  Roles to Target
                </h3>
                <ul className="space-y-2">
                  {report.targetRoles?.map((role, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">•</span>
                      {role}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Key Strengths
                </h3>
                <ul className="space-y-2">
                  {report.strengths?.map((strength, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {report.weaknesses?.map((weakness, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-rose-500 mt-1">•</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
