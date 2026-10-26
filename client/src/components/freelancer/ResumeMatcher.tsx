import React, { useRef, useState } from 'react';
import { Button } from '../common/Button';
import { aiApi } from '../../api/aiApi';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';
import type { CareerReport } from '../../types';
import { Sparkles, FileText, Target, Zap, AlertTriangle, Upload } from 'lucide-react';

/** Summary, target roles, strengths and gaps, with an AI / fallback label. */
export const CareerReportView: React.FC<{ report: CareerReport }> = ({ report }) => (
  <div className="space-y-6 animate-fade-in">
    <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20">
      <span
        className={`inline-block mb-3 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
          report.source === 'ai' ? 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10' : 'text-slate-400 border-slate-600 bg-slate-800/60'
        }`}
      >
        {report.source === 'ai' ? 'AI-generated' : 'Basic analysis (AI unavailable)'}
      </span>
      <p className="text-indigo-200 leading-relaxed italic">"{report.summary}"</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {(
        [
          ['Roles to Target', report.targetRoles, Target, 'text-emerald-400', 'text-emerald-500'],
          ['Key Strengths', report.strengths, Zap, 'text-amber-400', 'text-amber-500'],
          ['Areas to Improve', report.weaknesses, AlertTriangle, 'text-rose-400', 'text-rose-500'],
        ] as const
      ).map(([title, items, Icon, iconClass, bulletClass]) => (
        <div key={title} className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon className={`w-4 h-4 ${iconClass}`} />
            {title}
          </h3>
          <ul className="space-y-2">
            {items?.map((item, i) => (
              <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                <span className={`${bulletClass} mt-1`}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

/** Career coach: paste text, upload a PDF/TXT, or analyse the resume stored on the profile. */
export const ResumeMatcher: React.FC<{ hasStoredResume?: boolean }> = ({ hasStoredResume = false }) => {
  const [resumeText, setResumeText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<CareerReport | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (analyse: () => Promise<CareerReport>) => {
    try {
      setIsProcessing(true);
      setReport(await analyse());
      toast.success('Career analysis complete!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to analyze resume'));
    } finally {
      setIsProcessing(false);
    }
  };

  const analyseText = () => {
    if (!resumeText.trim()) {
      toast.error('Paste your resume text or upload a PDF first');
      return;
    }
    void run(() => aiApi.analyzeCareer(resumeText));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void run(() => aiApi.analyzeResume(file));
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 relative overflow-hidden group">
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
          <label htmlFor="resume-text" className="sr-only">Resume text</label>
          <textarea
            id="resume-text"
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[150px] resize-y"
            placeholder="Paste your resume text, skills, or professional summary here..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />

          <div className="flex flex-wrap justify-end gap-2">
            <input ref={fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={onFile} />
            {hasStoredResume && (
              <Button variant="ghost" onClick={() => run(() => aiApi.analyzeResume())} disabled={isProcessing}>
                Analyze my uploaded resume
              </Button>
            )}
            <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => fileInput.current?.click()} disabled={isProcessing}>
              Upload PDF
            </Button>
            <Button onClick={analyseText} isLoading={isProcessing} icon={<FileText className="w-4 h-4" />}>
              {isProcessing ? 'Analyzing…' : 'Get Career Advice'}
            </Button>
          </div>
        </div>

        {report && !isProcessing && <CareerReportView report={report} />}
      </div>
    </div>
  );
};
