import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { gigApi } from '../../api/gigApi';
import type { GigFormData, GigBudgetType } from '../../types';
import toast from 'react-hot-toast';

const CATEGORIES = [
  'Web Development',
  'Mobile App Development',
  'UI/UX Design',
  'Digital Marketing',
  'Writing & Translation',
  'Video & Animation',
  'Data Science & Analytics',
  'Customer Support'
];

export const CreateGigPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  
  const [formData, setFormData] = useState<GigFormData>({
    title: '',
    description: '',
    category: CATEGORIES[0],
    subcategory: '',
    skills: [],
    budgetType: 'fixed',
    budgetMin: 0,
    budgetMax: 0,
    currency: 'USD',
    estimatedDuration: 1,
    durationUnit: 'months',
    experienceLevel: 'intermediate',
    milestones: [],
    tags: [],
    deadline: '',
  });

  const handleSkillAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!formData.skills.includes(skillInput.trim())) {
        setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skillToRemove) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.skills.length === 0) {
      toast.error('Please add at least one skill.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        duration: `${formData.estimatedDuration} ${formData.durationUnit}`
      };
      await gigApi.createGig(payload);
      toast.success('Gig posted successfully!');
      navigate('/gigs');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to post gig');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-white mb-8">Post a New Gig</h1>
      
      <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-4">1. Basic Details</h3>
          <div className="space-y-4">
            <Input 
              label="Job Title" 
              placeholder="e.g. Senior Frontend Developer Needed" 
              required 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Experience Level</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
              >
                <option value="entry">Entry Level</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
              <textarea 
                rows={5} 
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Describe the project in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              ></textarea>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-xl font-semibold text-white mb-4">2. Budget & Timeline</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Project Type</label>
            <div className="flex gap-4">
              <label className="flex items-center text-slate-300">
                <input 
                  type="radio" 
                  name="budgetType" 
                  value="fixed" 
                  checked={formData.budgetType === 'fixed'}
                  onChange={() => setFormData({ ...formData, budgetType: 'fixed' })}
                  className="mr-2 text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                Fixed Price
              </label>
              <label className="flex items-center text-slate-300">
                <input 
                  type="radio" 
                  name="budgetType" 
                  value="hourly" 
                  checked={formData.budgetType === 'hourly'}
                  onChange={() => setFormData({ ...formData, budgetType: 'hourly' })}
                  className="mr-2 text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                />
                Hourly
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input 
              label={formData.budgetType === 'fixed' ? 'Budget ($)' : 'Min Hourly Rate ($)'} 
              type="number" 
              placeholder="e.g. 500" 
              required 
              min={1}
              value={formData.budgetMin}
              onChange={(e) => setFormData({ ...formData, budgetMin: Number(e.target.value), budgetMax: formData.budgetType === 'fixed' ? Number(e.target.value) : formData.budgetMax })}
            />
            {formData.budgetType === 'hourly' && (
              <Input 
                label="Max Hourly Rate ($)" 
                type="number" 
                placeholder="e.g. 1000" 
                required 
                min={1}
                value={formData.budgetMax}
                onChange={(e) => setFormData({ ...formData, budgetMax: Number(e.target.value) })}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Estimated Duration" 
              type="number"
              placeholder="e.g. 2" 
              required 
              min={1}
              value={formData.estimatedDuration}
              onChange={(e) => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Duration Unit</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                value={formData.durationUnit}
                onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as any })}
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-xl font-semibold text-white mb-4">3. Skills Required</h3>
          <Input 
            label="Skills"
            placeholder="Type a skill and press Enter..." 
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillAdd}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {formData.skills.map(skill => (
              <span key={skill} className="flex items-center px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} className="ml-2 text-slate-400 hover:text-white">✕</button>
              </span>
            ))}
            {formData.skills.length === 0 && (
              <span className="text-sm text-slate-500 italic">No skills added yet.</span>
            )}
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6 flex justify-end gap-4">
          <Button variant="ghost" type="button" className="border-slate-700 hover:bg-slate-800 text-white" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Post Gig</Button>
        </div>
      </form>
    </div>
  );
};
