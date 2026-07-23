// ========== USER TYPES ==========
export type UserRole = 'client' | 'freelancer' | 'admin';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerProfile {
  _id: string;
  user: User | string;
  title: string;
  bio: string;
  skills: Skill[];
  hourlyRate: number;
  availability: 'available' | 'busy' | 'unavailable';
  portfolio: PortfolioItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  languages: Language[];
  location: {
    country: string;
    city: string;
    timezone: string;
  };
  socialLinks: {
    website?: string;
    github?: string;
    linkedin?: string;
    twitter?: string;
  };
  stats: {
    totalEarnings: number;
    completedProjects: number;
    avgRating: number;
    totalReviews: number;
    responseTime: number;
    profileViews: number;
  };
  coverImage?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  _id: string;
  user: User | string;
  company?: string;
  industry?: string;
  description?: string;
  location: {
    country: string;
    city: string;
  };
  stats: {
    totalSpent: number;
    activeGigs: number;
    completedGigs: number;
    avgRating: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface PortfolioItem {
  _id?: string;
  title: string;
  description: string;
  images: string[];
  link?: string;
  tags: string[];
}

export interface ExperienceItem {
  _id?: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
}

export interface EducationItem {
  _id?: string;
  degree: string;
  institution: string;
  year: number;
}

export interface Language {
  name: string;
  proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
}

// ========== GIG TYPES ==========
export type GigStatus = 'draft' | 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type GigBudgetType = 'fixed' | 'hourly';

export interface Gig {
  _id: string;
  title: string;
  description: string;
  client: User | string;
  category: Category | string;
  subcategory?: string;
  skills: string[];
  budgetType: GigBudgetType;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  duration: {
    estimated: number;
    unit: 'hours' | 'days' | 'weeks' | 'months';
  };
  milestones: Milestone[];
  attachments: Attachment[];
  status: GigStatus;
  assignedFreelancer?: User | string;
  proposals: Proposal[] | string[];
  proposalCount: number;
  views: number;
  featured: boolean;
  tags: string[];
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  _id?: string;
  title: string;
  description: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'revision' | 'completed';
  order: number;
}

export interface Attachment {
  _id?: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  subcategories: string[];
  gigCount: number;
}

// ========== PROPOSAL TYPES ==========
export type ProposalStatus = 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';

export interface Proposal {
  _id: string;
  gig: Gig | string;
  freelancer: User | string;
  freelancerProfile?: FreelancerProfile;
  coverLetter: string;
  bidAmount: number;
  estimatedDuration: {
    value: number;
    unit: 'hours' | 'days' | 'weeks' | 'months';
  };
  milestones: ProposalMilestone[];
  attachments: Attachment[];
  status: ProposalStatus;
  clientNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalMilestone {
  title: string;
  description: string;
  amount: number;
  duration: number;
}

// ========== CHAT TYPES ==========
export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  gig?: Gig | string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: User | string;
  content: string;
  messageType: 'text' | 'file' | 'image' | 'system';
  attachments: Attachment[];
  readBy: string[];
  createdAt: string;
}

// ========== PAYMENT TYPES ==========
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type TransactionType = 'payment' | 'payout' | 'refund' | 'fee' | 'escrow';

export interface Payment {
  _id: string;
  gig: Gig | string;
  milestone?: string;
  payer: User | string;
  payee: User | string;
  amount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: PaymentStatus;
  transactionType: TransactionType;
  paymentMethod: string;
  transactionId?: string;
  description?: string;
  createdAt: string;
}

// ========== REVIEW TYPES ==========
export interface Review {
  _id: string;
  gig: Gig | string;
  reviewer: User | string;
  reviewee: User | string;
  rating: number;
  title: string;
  comment: string;
  categories: {
    communication: number;
    quality: number;
    timeliness: number;
    value: number;
  };
  response?: {
    comment: string;
    createdAt: string;
  };
  helpful: number;
  createdAt: string;
}

// ========== NOTIFICATION TYPES ==========
export type NotificationType = 
  | 'proposal_received' | 'proposal_accepted' | 'proposal_rejected'
  | 'milestone_completed' | 'milestone_approved'
  | 'payment_received' | 'payment_sent'
  | 'message_received'
  | 'review_received'
  | 'gig_approved' | 'gig_rejected'
  | 'dispute_opened' | 'dispute_resolved'
  | 'system';

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ========== DISPUTE TYPES ==========
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';

export interface Dispute {
  _id: string;
  gig: Gig | string;
  raisedBy: User | string;
  against: User | string;
  reason: string;
  description: string;
  evidence: Attachment[];
  status: DisputeStatus;
  resolution?: {
    decision: string;
    resolvedBy: User | string;
    resolvedAt: string;
  };
  messages: DisputeMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface DisputeMessage {
  _id: string;
  sender: User | string;
  content: string;
  attachments: Attachment[];
  createdAt: string;
}

// ========== ANALYTICS TYPES ==========
export interface PlatformStats {
  totalUsers: number;
  totalFreelancers: number;
  totalClients: number;
  totalGigs: number;
  activeGigs: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalTransactions: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ========== API RESPONSE TYPES ==========
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

// ========== FORM TYPES ==========
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export interface GigFormData {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  skills: string[];
  budgetType: GigBudgetType;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  estimatedDuration: number;
  durationUnit: 'hours' | 'days' | 'weeks' | 'months';
  duration?: string;
  experienceLevel?: string;
  milestones: Milestone[];
  tags: string[];
  deadline?: string;
}

export interface ProposalFormData {
  coverLetter: string;
  bidAmount: number;
  estimatedDuration: number;
  durationUnit: 'hours' | 'days' | 'weeks' | 'months';
  milestones: ProposalMilestone[];
}

// ========== SEARCH / FILTER TYPES ==========
export interface GigFilters {
  search?: string;
  category?: string;
  budgetType?: GigBudgetType;
  budgetMin?: number;
  budgetMax?: number;
  skills?: string[];
  status?: GigStatus;
  sortBy?: 'newest' | 'oldest' | 'budget_high' | 'budget_low' | 'most_proposals';
  page?: number;
  limit?: number;
}

export interface FreelancerFilters {
  search?: string;
  skills?: string[];
  minRate?: number;
  maxRate?: number;
  availability?: string;
  rating?: number;
  sortBy?: 'rating' | 'rate_low' | 'rate_high' | 'newest';
  page?: number;
  limit?: number;
}
