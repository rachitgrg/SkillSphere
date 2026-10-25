import React, { useState, useMemo } from 'react';
import { GigCard } from '../../components/gigs/GigCard';
import { GigFilters } from '../../components/gigs/GigFilters';
import { Search, X, Briefcase, RefreshCw } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';

export const INITIAL_GIGS = [
  {
    id: 'gig-1',
    title: 'Senior React & Next.js SaaS Platform Architect',
    description: 'Looking for an expert React/Next.js developer to construct a modern multi-tenant SaaS dashboard with TailwindCSS, Redux Toolkit, and real-time WebSocket updates.',
    category: 'Web Development',
    skills: ['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'Node.js'],
    budget: 5500,
    budgetType: 'fixed' as const,
    duration: '2 months',
    experienceLevel: 'expert',
    client: { name: 'TechSphere Labs', avatar: '', rating: 4.9, totalReviews: 24, location: 'San Francisco, CA' }
  },
  {
    id: 'gig-2',
    title: 'Cross-Platform Flutter Mobile App for iOS & Android',
    description: 'We require a skilled Flutter developer to build a high-performance ecommerce mobile application integrated with Firebase backend and Stripe payment gateway.',
    category: 'Mobile Development',
    skills: ['Flutter', 'Dart', 'Mobile Dev', 'Firebase', 'REST API'],
    budget: 7800,
    budgetType: 'fixed' as const,
    duration: '3 months',
    experienceLevel: 'expert',
    client: { name: 'AppForge Inc.', avatar: '', rating: 5.0, totalReviews: 18, location: 'Austin, TX' }
  },
  {
    id: 'gig-3',
    title: 'Enterprise Figma UI/UX Design System & Prototypes',
    description: 'Design a scalable dark-themed design system in Figma with 50+ component variants, mobile wireframes, and interactive prototype flows.',
    category: 'UI/UX Design',
    skills: ['UI/UX', 'Figma', 'Prototyping', 'Design Systems', 'User Research'],
    budget: 3200,
    budgetType: 'fixed' as const,
    duration: '1 month',
    experienceLevel: 'intermediate',
    client: { name: 'Apex Design Studio', avatar: '', rating: 4.8, totalReviews: 31, location: 'New York, NY' }
  },
  {
    id: 'gig-4',
    title: 'Python Machine Learning Model Pipeline & Training',
    description: 'Looking for a Data Science engineer to build predictive ML algorithms using PyTorch and Pandas, deployed as a REST microservice via FastAPI.',
    category: 'Data Science & AI',
    skills: ['Python', 'PyTorch', 'Data Science', 'Pandas', 'Machine Learning'],
    budget: 95,
    budgetType: 'hourly' as const,
    duration: '6 months',
    experienceLevel: 'expert',
    client: { name: 'NeuralMetrics AI', avatar: '', rating: 4.9, totalReviews: 15, location: 'Boston, MA' }
  },
  {
    id: 'gig-5',
    title: 'AWS Kubernetes & Docker Infrastructure Automation',
    description: 'Automate containerized microservices deployment on AWS EKS using Terraform, Helm charts, and GitHub Actions CI/CD pipelines.',
    category: 'DevOps & Cloud',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
    budget: 110,
    budgetType: 'hourly' as const,
    duration: '3 months',
    experienceLevel: 'expert',
    client: { name: 'CloudScale Systems', avatar: '', rating: 4.7, totalReviews: 9, location: 'Seattle, WA' }
  },
  {
    id: 'gig-6',
    title: 'Ethereum Smart Contract Audit & DeFi DApp Development',
    description: 'Build secure ERC-20 token staking contracts in Solidity and connect them to a Web3 React frontend via Ethers.js and Hardhat.',
    category: 'Blockchain & Web3',
    skills: ['Solidity', 'Web3', 'Ethereum', 'React', 'Hardhat'],
    budget: 12000,
    budgetType: 'fixed' as const,
    duration: '2 months',
    experienceLevel: 'expert',
    client: { name: 'BlockChain Ventures', avatar: '', rating: 5.0, totalReviews: 42, location: 'Miami, FL' }
  },
  {
    id: 'gig-7',
    title: 'Full-Stack Node.js & GraphQL Microservices Developer',
    description: 'Refactor legacy REST backend into GraphQL microservices with Apollo Server, Node.js, TypeScript, and MongoDB Atlas.',
    category: 'Web Development',
    skills: ['Node.js', 'GraphQL', 'MongoDB', 'TypeScript', 'Express'],
    budget: 4200,
    budgetType: 'fixed' as const,
    duration: '1.5 months',
    experienceLevel: 'intermediate',
    client: { name: 'Omniscience Tech', avatar: '', rating: 4.6, totalReviews: 14, location: 'Chicago, IL' }
  },
  {
    id: 'gig-8',
    title: 'Penetration Testing & SOC 2 Cybersecurity Audit',
    description: 'Conduct vulnerability assessment and security penetration test on enterprise cloud application. Provide detailed remediation reports for SOC 2 compliance.',
    category: 'Cyber Security',
    skills: ['Cyber Security', 'Penetration Testing', 'Python', 'Ethical Hacking', 'SOC 2'],
    budget: 6500,
    budgetType: 'fixed' as const,
    duration: '3 weeks',
    experienceLevel: 'expert',
    client: { name: 'SecureShield Global', avatar: '', rating: 5.0, totalReviews: 29, location: 'Washington, D.C.' }
  },
  {
    id: 'gig-9',
    title: 'Django & PostgreSQL E-Commerce Backend Systems',
    description: 'Develop robust e-commerce backend API using Python Django REST framework, PostgreSQL database, Redis caching, and Stripe webhook handler.',
    category: 'Web Development',
    skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker'],
    budget: 3800,
    budgetType: 'fixed' as const,
    duration: '1 month',
    experienceLevel: 'intermediate',
    client: { name: 'GlobalMart Retail', avatar: '', rating: 4.8, totalReviews: 22, location: 'Toronto, Canada' }
  },
  {
    id: 'gig-10',
    title: 'Vue 3 & Vite Real-Time Financial Data Analytics',
    description: 'Create ultra-fast real-time crypto charting dashboard in Vue 3, Vite, Pinia, and TailwindCSS using WebSockets feed.',
    category: 'Web Development',
    skills: ['Vue.js', 'Vite', 'TypeScript', 'Pinia', 'TailwindCSS'],
    budget: 2400,
    budgetType: 'fixed' as const,
    duration: '3 weeks',
    experienceLevel: 'intermediate',
    client: { name: 'Datadash Media', avatar: '', rating: 4.9, totalReviews: 19, location: 'London, UK' }
  },
  {
    id: 'gig-11',
    title: 'Native Android Kotlin Banking App Development',
    description: 'Develop native Android mobile banking application utilizing Kotlin, Jetpack Compose, Clean Architecture, and biometric security features.',
    category: 'Mobile Development',
    skills: ['Android', 'Kotlin', 'Mobile Dev', 'Jetpack Compose', 'REST API'],
    budget: 85,
    budgetType: 'hourly' as const,
    duration: '4 months',
    experienceLevel: 'expert',
    client: { name: 'PayPulse Fintech', avatar: '', rating: 4.7, totalReviews: 11, location: 'Berlin, Germany' }
  },
  {
    id: 'gig-12',
    title: 'OpenAI GPT-4 LLM & LangChain Chatbot Integration',
    description: 'Integrate custom LLM agent using LangChain, OpenAI API, and Vector Database (Pinecone) into an existing React customer portal.',
    category: 'Data Science & AI',
    skills: ['Python', 'LangChain', 'OpenAI API', 'Node.js', 'React'],
    budget: 4500,
    budgetType: 'fixed' as const,
    duration: '1 month',
    experienceLevel: 'expert',
    client: { name: 'Cognitive AI Labs', avatar: '', rating: 5.0, totalReviews: 36, location: 'San Jose, CA' }
  },
  {
    id: 'gig-13',
    title: 'React Native Telehealth Booking & Video Call App',
    description: 'Build cross-platform React Native app for doctor consultations with WebRTC video calling, appointment booking, and encrypted chat.',
    category: 'Mobile Development',
    skills: ['React Native', 'TypeScript', 'Redux', 'Mobile Dev', 'Node.js'],
    budget: 6200,
    budgetType: 'fixed' as const,
    duration: '2 months',
    experienceLevel: 'intermediate',
    client: { name: 'HealthFirst Solutions', avatar: '', rating: 4.9, totalReviews: 27, location: 'Denver, CO' }
  },
  {
    id: 'gig-14',
    title: 'Golang High-Throughput Microservice API Service',
    description: 'Build lightweight high-performance REST and gRPC API in Go with PostgreSQL for handling over 50,000 requests per second.',
    category: 'Web Development',
    skills: ['Go', 'Golang', 'gRPC', 'PostgreSQL', 'Docker'],
    budget: 120,
    budgetType: 'hourly' as const,
    duration: '3 months',
    experienceLevel: 'expert',
    client: { name: 'Velocity Streams', avatar: '', rating: 4.8, totalReviews: 16, location: 'Austin, TX' }
  },
  {
    id: 'gig-15',
    title: 'Figma Brand Guidelines & Webflow Marketing Website',
    description: 'Craft fresh brand assets, logo redesign, design system, and implement high-converting landing pages inside Webflow.',
    category: 'UI/UX Design',
    skills: ['UI/UX', 'Figma', 'Webflow', 'Graphic Design', 'Branding'],
    budget: 1800,
    budgetType: 'fixed' as const,
    duration: '2 weeks',
    experienceLevel: 'entry',
    client: { name: 'Nova Creative Agency', avatar: '', rating: 4.7, totalReviews: 8, location: 'Los Angeles, CA' }
  },
  {
    id: 'gig-16',
    title: 'Angular 17 Enterprise ERP Dashboard Modules',
    description: 'Build enterprise inventory management frontend using Angular 17, RxJS, NgRx state management, and AG-Grid data tables.',
    category: 'Web Development',
    skills: ['Angular', 'TypeScript', 'RxJS', 'NgRx', 'Bootstrap'],
    budget: 65,
    budgetType: 'hourly' as const,
    duration: '5 months',
    experienceLevel: 'intermediate',
    client: { name: 'Enterprise Systems Ltd.', avatar: '', rating: 4.6, totalReviews: 13, location: 'Dallas, TX' }
  }
];

// Extract all unique skills and categories for filter options
const ALL_SKILLS = Array.from(
  new Set(INITIAL_GIGS.flatMap((g) => g.skills))
).sort();

const ALL_CATEGORIES = Array.from(
  new Set(INITIAL_GIGS.map((g) => g.category))
).sort();

export const GigListPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<{ fixed: boolean; hourly: boolean }>({
    fixed: true,
    hourly: true,
  });
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'budget_high' | 'budget_low'>('newest');

  // Handle Type Change
  const handleTypeChange = (type: 'fixed' | 'hourly') => {
    setSelectedTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Handle Skill Toggle
  const handleToggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // Handle Clear All
  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedTypes({ fixed: true, hourly: true });
    setMinBudget('');
    setMaxBudget('');
    setSelectedCategory('');
    setSelectedSkills([]);
    setSortBy('newest');
  };

  // Calculate active filters count
  const activeCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (!selectedTypes.fixed || !selectedTypes.hourly) count++;
    if (minBudget !== '') count++;
    if (maxBudget !== '') count++;
    if (selectedCategory !== '') count++;
    count += selectedSkills.length;
    return count;
  }, [searchQuery, selectedTypes, minBudget, maxBudget, selectedCategory, selectedSkills]);

  // Filter Gigs
  const filteredGigs = useMemo(() => {
    return INITIAL_GIGS.filter((gig) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = gig.title.toLowerCase().includes(q);
        const matchesDesc = gig.description.toLowerCase().includes(q);
        const matchesSkill = gig.skills.some((s) => s.toLowerCase().includes(q));
        const matchesCategory = gig.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesSkill && !matchesCategory) {
          return false;
        }
      }

      // 2. Project Type Filter
      if (!selectedTypes.fixed && gig.budgetType === 'fixed') return false;
      if (!selectedTypes.hourly && gig.budgetType === 'hourly') return false;

      // 3. Category Filter
      if (selectedCategory && gig.category !== selectedCategory) {
        return false;
      }

      // 4. Min Budget Filter
      if (minBudget !== '' && !isNaN(Number(minBudget))) {
        if (gig.budget < Number(minBudget)) return false;
      }

      // 5. Max Budget Filter
      if (maxBudget !== '' && !isNaN(Number(maxBudget))) {
        if (gig.budget > Number(maxBudget)) return false;
      }

      // 6. Skills Filter (Gig must have at least one of the selected skills, or all)
      if (selectedSkills.length > 0) {
        const hasSkill = selectedSkills.some((s) => gig.skills.includes(s));
        if (!hasSkill) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'budget_high') return b.budget - a.budget;
      if (sortBy === 'budget_low') return a.budget - b.budget;
      return 0; // newest / default order
    });
  }, [searchQuery, selectedTypes, minBudget, maxBudget, selectedCategory, selectedSkills, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-[#020b16] text-white">
      <Navbar />

      <main className="flex-grow pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header & Search Bar */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Find Freelance Work</h1>
              <p className="text-sm text-slate-400 mt-1">
                Browse through <span className="text-indigo-400 font-semibold">{INITIAL_GIGS.length}</span> curated high-paying freelance projects
              </p>
            </div>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="budget_high">Budget: High to Low</option>
                <option value="budget_low">Budget: Low to High</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative max-w-3xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, skill (e.g. React, Python, Figma), or category..."
              className="w-full bg-[#081426] border border-slate-700/80 rounded-2xl py-3.5 pl-12 pr-10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-lg shadow-black/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="w-full lg:w-1/4 flex-shrink-0">
            <GigFilters
              selectedTypes={selectedTypes}
              onTypeChange={handleTypeChange}
              minBudget={minBudget}
              maxBudget={maxBudget}
              onMinBudgetChange={setMinBudget}
              onMaxBudgetChange={setMaxBudget}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedSkills={selectedSkills}
              onToggleSkill={handleToggleSkill}
              availableSkills={ALL_SKILLS}
              availableCategories={ALL_CATEGORIES}
              onClearAll={handleClearAll}
              activeCount={activeCount}
            />
          </div>

          {/* Gig List Section */}
          <div className="w-full lg:w-3/4">
            {/* Status Info Bar */}
            <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
              <span>
                Showing <strong className="text-white">{filteredGigs.length}</strong> of{' '}
                <strong className="text-slate-300">{INITIAL_GIGS.length}</strong> projects
              </span>
              {activeCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reset Filters
                </button>
              )}
            </div>

            {/* Gig Cards Grid */}
            {filteredGigs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredGigs.map((gig) => (
                  <GigCard key={gig.id} gig={gig} />
                ))}
              </div>
            ) : (
              /* No Results State */
              <div className="glass-card rounded-2xl p-12 text-center border border-slate-800 my-4">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No matching projects found</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                  Try adjusting your search criteria, clearing selected skills, or widening your budget range.
                </p>
                <button
                  onClick={handleClearAll}
                  className="btn-primary px-5 py-2.5 rounded-xl text-xs"
                >
                  <span>Clear All Filters</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
