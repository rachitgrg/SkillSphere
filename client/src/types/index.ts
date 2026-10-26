// Shapes returned by the SkillSphere API (server/src/models). Dates are ISO strings.

// ========== COMMON ==========
export type ID = string;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Every response: `{ success, message, data?, pagination? }`. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: Pagination;
}

export interface Paginated<T> {
  items: T;
  pagination: Pagination;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

// ========== USERS ==========
export type UserRole = 'client' | 'freelancer' | 'admin';

export interface User {
  _id: ID;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  bio?: string;
  location?: GeoPoint;
  address?: Address;
  isVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  suspendedUntil?: string;
  twoFactorEnabled: boolean;
  needsRoleSelection?: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public subset embedded in other documents (populate). */
export type UserSummary = Pick<User, '_id' | 'firstName' | 'lastName' | 'avatar'> & Partial<Pick<User, 'email' | 'address' | 'role'>>;

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type AvailabilityStatus = 'available' | 'busy' | 'unavailable';

export interface Skill {
  name: string;
  proficiency: ProficiencyLevel;
  yearsOfExperience?: number;
}

export interface PortfolioItem {
  _id?: ID;
  title: string;
  description: string;
  url?: string;
  images: string[];
  technologies: string[];
  completedAt?: string;
}

export interface Certification {
  _id?: ID;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialUrl?: string;
}

export interface WorkExperience {
  _id?: ID;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string;
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // HH:mm
  endTime: string;
}

export interface MilestonePackage {
  title: string;
  description?: string;
  price: number;
  deliveryDays: number;
}

export interface StoredResume {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface FreelancerVerification {
  status: VerificationStatus;
  /** Admin queue only. */
  documents?: { url: string; name: string; mimeType: string }[];
  message?: string;
  requestedAt?: string;
  reviewedAt?: string;
  /** Rejection reason. */
  note?: string;
}

/** GET /admin/verifications */
export type VerificationRequest = FreelancerProfile & {
  user: UserSummary & Pick<User, 'email' | 'createdAt' | 'isVerified'>;
  verification: FreelancerVerification;
};

/** POST /chat/conversations/:id/files */
export interface ChatUpload {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  type: 'image' | 'file';
}

/** GET /config */
export interface PlatformConfig {
  uploads: boolean;
  payments: boolean;
  ai: boolean;
  google: boolean;
  emailVerification: boolean;
  platformFeePercentage: number;
}

export interface FreelancerProfile {
  _id: ID;
  user: UserSummary | ID;
  title: string;
  headline: string;
  skills: Skill[];
  portfolio: PortfolioItem[];
  certifications: Certification[];
  workExperience: WorkExperience[];
  education: Education[];
  hourlyRate: number;
  availability: AvailabilityStatus;
  availabilitySlots: AvailabilitySlot[];
  milestonePricing?: MilestonePackage[];
  resume?: StoredResume;
  verification?: FreelancerVerification;
  totalEarnings: number;
  completedGigs: number;
  averageRating: number;
  totalReviews: number;
  responseTime: number;
  languages: { language: string; proficiency: string }[];
  socialLinks: { github?: string; linkedin?: string; website?: string; twitter?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  _id: ID;
  user: UserSummary | ID;
  companyName?: string;
  companyWebsite?: string;
  companySize?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  industry?: string;
  description?: string;
  totalSpent: number;
  postedGigs: number;
  activeGigs: number;
  completedGigs: number;
  averageRating: number;
  totalReviews: number;
  paymentVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /users/me */
export interface MeResponse {
  user: User;
  profile: FreelancerProfile | ClientProfile | null;
}

/** GET /users/freelancers/:id and /users/clients/:id return the profile with `user` populated. */
export type PublicFreelancerProfile = FreelancerProfile & { user: UserSummary & Pick<User, 'bio' | 'isVerified' | 'createdAt'> };
export type PublicClientProfile = ClientProfile & { user: UserSummary & Pick<User, 'bio' | 'isVerified' | 'createdAt'> };

// ========== GIGS ==========
export type GigStatus =
  | 'draft'
  | 'pending_approval'
  | 'rejected'
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type GigBudgetType = 'fixed' | 'hourly';
export type ExperienceLevel = 'entry' | 'intermediate' | 'expert';
export type LocationType = 'remote' | 'onsite' | 'hybrid';
export type GigVisibility = 'public' | 'private' | 'invite_only';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'approved';

export interface Milestone {
  _id?: ID;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: MilestoneStatus;
  completedAt?: string;
}

export interface Gig {
  _id: ID;
  client: UserSummary | ID;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  skills: string[];
  budgetType: GigBudgetType;
  budgetMin: number;
  budgetMax: number;
  duration: string;
  experienceLevel: ExperienceLevel;
  milestones: Milestone[];
  attachments: Attachment[];
  /** Owner/admin see every invitation; an invitee sees only their own. */
  invitations?: GigInvitation[];
  location?: GeoPoint;
  locationType: LocationType;
  status: GigStatus;
  visibility: GigVisibility;
  proposals: ID[];
  selectedFreelancer?: UserSummary | ID;
  totalProposals: number;
  views: number;
  tags: string[];
  deadline?: string;
  completedAt?: string;
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id: ID;
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
}

export interface GigInvitation {
  freelancer: ID;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'declined';
  respondedAt?: string;
}

/** GET /gigs/invitations */
export interface MyInvitation {
  gig: Gig;
  invitation: GigInvitation;
}

export interface MilestoneInput {
  title: string;
  description: string;
  amount: number;
  dueDate: string;
}

/** POST /gigs, PUT /gigs/:id */
export interface GigInput {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  skills: string[];
  budgetType: GigBudgetType;
  budgetMin: number;
  budgetMax: number;
  duration: string;
  experienceLevel: ExperienceLevel;
  milestones?: MilestoneInput[];
  location?: GeoPoint;
  locationType?: LocationType;
  visibility?: GigVisibility;
  tags?: string[];
  deadline?: string;
}

export type GigSort = 'newest' | 'oldest' | 'budget_high' | 'budget_low' | 'popular';

/** GET /gigs and GET /search/gigs */
export interface GigFilters {
  q?: string;
  category?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: GigBudgetType;
  experienceLevel?: ExperienceLevel;
  locationType?: LocationType;
  sort?: GigSort;
  page?: number;
  limit?: number;
}

// ========== PROPOSALS ==========
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'negotiating';

export interface NegotiationEntry {
  _id?: ID;
  proposedBy: ID;
  amount: number;
  message: string;
  createdAt: string;
}

export interface Proposal {
  _id: ID;
  gig: Gig | ID;
  freelancer: UserSummary | ID;
  coverLetter: string;
  proposedAmount: number;
  finalAmount?: number;
  estimatedDuration: string;
  milestones: Milestone[];
  attachments: string[];
  status: ProposalStatus;
  negotiationHistory: NegotiationEntry[];
  clientNotes?: string;
  submittedAt: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /proposals/gig/:gigId rows: proposal + the applicant's headline stats. */
export type GigProposal = Proposal & {
  freelancer: UserSummary;
  freelancerProfile: Pick<FreelancerProfile, 'title' | 'averageRating' | 'totalReviews' | 'completedGigs' | 'hourlyRate' | 'skills'> | null;
};

/** POST /proposals */
export interface ProposalInput {
  gigId: ID;
  coverLetter: string;
  proposedAmount: number;
  estimatedDuration: string;
  milestones?: MilestoneInput[];
  attachments?: string[];
}

// ========== CHAT ==========
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface Message {
  _id: ID;
  conversation: ID;
  sender: UserSummary;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  readBy: { user: ID; readAt: string }[];
  createdAt: string;
}

export interface Conversation {
  _id: ID;
  participants: UserSummary[];
  gig?: Pick<Gig, '_id' | 'title' | 'status'>;
  lastMessage?: Pick<Message, '_id' | 'content' | 'type' | 'createdAt'> & { sender: ID };
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}

// ========== PAYMENTS ==========
export type PaymentStatus = 'pending' | 'escrow' | 'released' | 'refunded' | 'disputed';

export interface Payment {
  _id: ID;
  gig: Pick<Gig, '_id' | 'title'> | ID;
  milestone?: ID;
  client: UserSummary | ID;
  freelancer: UserSummary | ID;
  amount: number;
  platformFee: number;
  freelancerAmount: number;
  currency: string;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  escrowedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  refundReason?: string;
  refundedAmount?: number;
  description?: string;
  createdAt: string;
}

export interface PaymentSummary {
  inEscrow: number;
  released: number;
  refunded: number;
  pending: number;
  fees: number;
  byStatus: Partial<Record<PaymentStatus, { total: number; count: number }>>;
}

export interface PaymentConfig {
  enabled: boolean;
  keyId: string | null;
  currency: 'INR';
}

/** POST /payments/orders */
export interface CreateOrderInput {
  gigId: ID;
  milestoneId?: ID;
  amount?: number;
  description?: string;
}

export interface OrderResult {
  payment: Payment;
  order: { id: string; amount: number; currency: string };
  keyId: string;
}

/** Razorpay Checkout success handler payload → POST /payments/verify */
export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ========== REVIEWS ==========
export interface ReviewCategories {
  communication: number;
  quality: number;
  timeliness: number;
  professionalism: number;
  value: number;
}

export interface Review {
  _id: ID;
  gig: Pick<Gig, '_id' | 'title'> | ID;
  reviewer: UserSummary | ID;
  reviewee: UserSummary | ID;
  rating: number;
  categories: ReviewCategories;
  comment: string;
  response?: string;
  responseAt?: string;
  isFlagged: boolean;
  flagReason?: string;
  isVisible: boolean;
  createdAt: string;
}

export interface ReviewBreakdown {
  overall: number;
  categories: ReviewCategories;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

// ========== NOTIFICATIONS ==========
export type NotificationType =
  | 'proposal_received'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'gig_awarded'
  | 'gig_approved'
  | 'gig_rejected'
  | 'proposal_countered'
  | 'payment_received'
  | 'payment_released'
  | 'payment_escrow'
  | 'review_received'
  | 'message_received'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'gig_completed'
  | 'milestone_completed'
  | 'system';

export interface Notification {
  _id: ID;
  recipient: ID;
  sender?: ID;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
}

export interface NotificationPage {
  notifications: Notification[];
  unreadCount: number;
}

// ========== DISPUTES ==========
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputePaymentAction = 'refund' | 'release' | 'split';

export interface Evidence {
  _id?: ID;
  uploadedBy: ID;
  fileUrl: string;
  description: string;
  uploadedAt: string;
}

export interface Dispute {
  _id: ID;
  gig: Pick<Gig, '_id' | 'title'> | ID;
  payment?: Payment | ID;
  raisedBy: UserSummary | ID;
  against: UserSummary | ID;
  title: string;
  description: string;
  evidence: Evidence[];
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: ID;
  resolvedAt?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface CreateDisputeInput {
  gigId: ID;
  paymentId?: ID;
  title: string;
  description: string;
}

export interface ResolveDisputeInput {
  resolution: string;
  adminNotes?: string;
  paymentAction?: DisputePaymentAction;
  refundAmount?: number;
}

// ========== SEARCH / AI ==========
export type FreelancerSort = 'rating' | 'rate_low' | 'rate_high' | 'experience' | 'newest';

export interface FreelancerFilters {
  q?: string;
  skills?: string[];
  minRate?: number;
  maxRate?: number;
  minRating?: number;
  experience?: ExperienceLevel | number;
  sort?: FreelancerSort;
  verified?: boolean;
  page?: number;
  limit?: number;
}

/** Freelancer search rows: profile with the public user joined in. */
export type FreelancerSearchResult = FreelancerProfile & { user: UserSummary & Pick<User, 'bio' | 'address' | 'isVerified'> };

export interface TrendingSkill {
  skill: string;
  count: number;
  previousCount: number;
  growth: number;
}

export interface SearchSuggestions {
  titles: string[];
  skills: string[];
}

export type AiSource = 'ai' | 'fallback';

/** Each component is 0–1; see MATCH_WEIGHTS on the server. */
export interface MatchBreakdown {
  skill: number;
  rating: number;
  proximity: number;
  experience: number;
  budget: number;
  availability: number;
}

interface MatchFields {
  /** 0–100 */
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  distanceKm?: number;
  reasons: string[];
  source: AiSource;
}

export interface MatchScore extends MatchFields {
  freelancerId: UserSummary & { address?: { city?: string; state?: string }; isVerified?: boolean };
  profile: Pick<
    FreelancerProfile,
    'title' | 'headline' | 'skills' | 'averageRating' | 'totalReviews' | 'completedGigs' | 'hourlyRate' | 'availability'
  > & { verification?: { status?: string } };
}

export interface GigRecommendation extends MatchFields {
  gig: Gig;
}

export interface CareerReport {
  targetRoles: string[];
  strengths: string[];
  weaknesses: string[];
  summary: string;
  source: AiSource;
}

// ========== ANALYTICS ==========
export type AnalyticsPeriod = '30d' | '90d' | '12m';

export interface MonthlyTotal {
  month: string; // YYYY-MM
  total: number;
  count: number;
}

export interface FreelancerAnalytics {
  period: AnalyticsPeriod;
  proposals: { sent: number; accepted: number; byStatus: Partial<Record<ProposalStatus, number>>; acceptanceRate: number };
  earnings: { total: number; pending: number; released: number };
  monthlyRevenue: MonthlyTotal[];
  feedback: ReviewBreakdown;
  topSkills: { skill: string; count: number }[];
  activeProjects: number;
  completedProjects: number;
  profile: Pick<FreelancerProfile, 'averageRating' | 'totalReviews' | 'completedGigs' | 'totalEarnings'> | null;
}

export interface ClientAnalytics {
  period: AnalyticsPeriod;
  spending: { total: number; inEscrow: number; refunded: number };
  monthlySpending: MonthlyTotal[];
  gigs: { byStatus: Partial<Record<GigStatus, number>>; total: number; active: number; completed: number };
  hires: number;
  proposalsReceived: number;
}

// ========== ADMIN ==========
export interface AdminStats {
  users: { total: number; newThisMonth: number } & Partial<Record<UserRole, number>>;
  gigs: { total: number; pendingApproval: number } & Partial<Record<GigStatus, number>>;
  revenue: number;
  gmv: number;
  inEscrow: number;
  activeDisputes: number;
  flaggedReviews: number;
}

export interface AdminAnalytics {
  period: AnalyticsPeriod;
  revenueByMonth: { month: string; revenue: number; gmv: number; transactions: number }[];
  totalRevenue: number;
  activeFreelancers: number;
  topCategories: { category: string; gigs: number; gmv: number }[];
  jobSuccessRate: number;
  jobOutcomes: { completed: number; cancelled: number; disputed: number };
  userGrowth: { month: string; total: number; freelancers: number; clients: number }[];
}

export interface AdminUserDetails {
  user: User;
  gigs: Pick<Gig, '_id' | 'title' | 'status' | 'createdAt'>[];
  payments: Pick<Payment, '_id' | 'amount' | 'status' | 'gig' | 'createdAt'>[];
  reviews: Review[];
  disputes: Pick<Dispute, '_id' | 'title' | 'status' | 'createdAt'>[];
}

export interface AdminPayments {
  payments: Payment[];
  totals: { _id: PaymentStatus; amount: number; fees: number; count: number }[];
  revenue: { totalRevenue: number; totalTransactions: number };
}

export interface FraudReport {
  flaggedReviews: Review[];
  disputedUsers: { _id: ID; disputes: number; user: UserSummary & { email: string; isBanned: boolean } }[];
  refundHeavyClients: { _id: ID; refunds: number; amount: number; user: UserSummary & { email: string; isBanned: boolean } }[];
}

export interface AdminLog {
  _id: ID;
  admin: UserSummary;
  action: string;
  targetType: 'user' | 'gig' | 'payment' | 'review' | 'dispute';
  targetId: ID;
  details: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// ========== AUTH ==========
/** `data` of login/register/refresh responses. The refresh token is an httpOnly cookie. */
export interface AuthResponse {
  token: string;
  user: User;
}

/** POST /auth/login: a session, or a 2FA challenge. */
export type LoginResult = AuthResponse | { twoFactorRequired: true; tempToken: string };

export interface TwoFactorSetup {
  qrCode: string;
  secret: string;
  otpauthUrl: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'admin'>;
}

// ========== LEGACY FORM TYPES (pages rewritten in Phase 3) ==========
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
  milestones: MilestoneInput[];
  tags: string[];
  deadline?: string;
}

export interface ProposalFormData {
  coverLetter: string;
  bidAmount: number;
  estimatedDuration: number;
  durationUnit: 'hours' | 'days' | 'weeks' | 'months';
  milestones: MilestoneInput[];
}
