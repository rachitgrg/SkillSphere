import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ───────────────────────── Enums ─────────────────────────

export enum UserRole {
  FREELANCER = 'freelancer',
  CLIENT = 'client',
  ADMIN = 'admin',
}

export enum GigStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  REJECTED = 'rejected',
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ProposalStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  NEGOTIATING = 'negotiating',
}

export enum PaymentStatus {
  PENDING = 'pending',
  ESCROW = 'escrow',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum NotificationType {
  PROPOSAL_RECEIVED = 'proposal_received',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  GIG_AWARDED = 'gig_awarded',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_RELEASED = 'payment_released',
  PAYMENT_ESCROW = 'payment_escrow',
  REVIEW_RECEIVED = 'review_received',
  MESSAGE_RECEIVED = 'message_received',
  DISPUTE_OPENED = 'dispute_opened',
  DISPUTE_RESOLVED = 'dispute_resolved',
  GIG_COMPLETED = 'gig_completed',
  MILESTONE_COMPLETED = 'milestone_completed',
  GIG_APPROVED = 'gig_approved',
  GIG_REJECTED = 'gig_rejected',
  PROPOSAL_COUNTERED = 'proposal_countered',
  SYSTEM = 'system',
}

export enum ProficiencyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  UNAVAILABLE = 'unavailable',
}

export enum MilestoneStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  APPROVED = 'approved',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system',
}

export enum AdminAction {
  USER_BAN = 'user_ban',
  USER_UNBAN = 'user_unban',
  GIG_REMOVE = 'gig_remove',
  DISPUTE_RESOLVE = 'dispute_resolve',
  GIG_APPROVE = 'gig_approve',
  GIG_REJECT = 'gig_reject',
  FREELANCER_VERIFY = 'freelancer_verify',
  FREELANCER_REJECT_VERIFICATION = 'freelancer_reject_verification',
  REVIEW_VISIBILITY = 'review_visibility',
  PAYMENT_REFUND = 'payment_refund',
  REVIEW_REMOVE = 'review_remove',
  SETTINGS_UPDATE = 'settings_update',
}

// ───────────────────────── GeoJSON ─────────────────────────

export interface IGeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// ───────────────────────── Sub-document Interfaces ─────────────────────────

export interface ISkill {
  name: string;
  proficiency: ProficiencyLevel;
  yearsOfExperience: number;
}

export interface IPortfolioItem {
  title: string;
  description: string;
  url?: string;
  images: string[];
  technologies: string[];
  completedAt?: Date;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialUrl?: string;
}

export interface IWorkExperience {
  title: string;
  company: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string;
}

export interface IAvailabilitySlot {
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface IMilestone {
  _id?: Types.ObjectId;
  title: string;
  description: string;
  amount: number;
  dueDate: Date;
  status: MilestoneStatus;
  completedAt?: Date;
}

export interface INegotiationEntry {
  proposedBy: Types.ObjectId;
  amount: number;
  message: string;
  createdAt: Date;
}

export interface IEvidence {
  uploadedBy: Types.ObjectId;
  fileUrl: string;
  description: string;
  uploadedAt: Date;
}

export interface IReviewCategory {
  communication: number;
  quality: number;
  timeliness: number;
  professionalism: number;
  value: number;
}

// ───────────────────────── Document Interfaces ─────────────────────────

export interface IUser extends Document {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  avatar?: string;
  role: UserRole;
  phone?: string;
  bio?: string;
  location?: IGeoLocation;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  isVerified: boolean;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  suspendedUntil?: Date;
  googleId?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
}

export interface IFreelancerProfile extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  headline: string;
  skills: ISkill[];
  portfolio: IPortfolioItem[];
  certifications: ICertification[];
  workExperience: IWorkExperience[];
  education: {
    degree: string;
    institution: string;
    year: number;
  }[];
  hourlyRate: number;
  availability: AvailabilityStatus;
  availabilitySlots: IAvailabilitySlot[];
  totalEarnings: number;
  completedGigs: number;
  averageRating: number;
  totalReviews: number;
  responseTime: number; // in hours
  milestonePricing: { title: string; description?: string; price: number; deliveryDays: number }[];
  location?: IGeoLocation;
  languages: { language: string; proficiency: string }[];
  socialLinks: {
    github?: string;
    linkedin?: string;
    website?: string;
    twitter?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IClientProfile extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  companyName?: string;
  companyWebsite?: string;
  companySize?: string;
  industry?: string;
  description?: string;
  totalSpent: number;
  postedGigs: number;
  activeGigs: number;
  completedGigs: number;
  averageRating: number;
  totalReviews: number;
  paymentVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGig extends Document {
  _id: Types.ObjectId;
  client: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  skills: string[];
  budgetType: 'fixed' | 'hourly';
  budgetMin: number;
  budgetMax: number;
  duration: string;
  experienceLevel: 'entry' | 'intermediate' | 'expert';
  milestones: IMilestone[];
  attachments: string[];
  location?: IGeoLocation;
  locationType: 'remote' | 'onsite' | 'hybrid';
  status: GigStatus;
  visibility: 'public' | 'private' | 'invite_only';
  proposals: Types.ObjectId[];
  selectedFreelancer?: Types.ObjectId;
  totalProposals: number;
  views: number;
  tags: string[];
  deadline?: Date;
  completedAt?: Date;
  rejectionReason?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProposal extends Document {
  _id: Types.ObjectId;
  gig: Types.ObjectId;
  freelancer: Types.ObjectId;
  coverLetter: string;
  proposedAmount: number;
  finalAmount?: number;
  estimatedDuration: string;
  milestones: IMilestone[];
  attachments: string[];
  status: ProposalStatus;
  negotiationHistory: INegotiationEntry[];
  clientNotes?: string;
  isBookmarked: boolean;
  submittedAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  gig?: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: MessageType;
  fileUrl?: string;
  fileName?: string;
  readBy: { user: Types.ObjectId; readAt: Date }[];
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment extends Document {
  _id: Types.ObjectId;
  gig: Types.ObjectId;
  milestone?: Types.ObjectId;
  client: Types.ObjectId;
  freelancer: Types.ObjectId;
  amount: number;
  platformFee: number;
  freelancerAmount: number;
  currency: string;
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  escrowedAt?: Date;
  releasedAt?: Date;
  refundedAt?: Date;
  refundReason?: string;
  refundedAmount?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReview extends Document {
  _id: Types.ObjectId;
  gig: Types.ObjectId;
  reviewer: Types.ObjectId;
  reviewee: Types.ObjectId;
  rating: number;
  categories: IReviewCategory;
  comment: string;
  response?: string;
  responseAt?: Date;
  isFlagged: boolean;
  flagReason?: string;
  isVisible: boolean;
  reports: { user: Types.ObjectId; reason: string; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  sender?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDispute extends Document {
  _id: Types.ObjectId;
  gig: Types.ObjectId;
  payment?: Types.ObjectId;
  raisedBy: Types.ObjectId;
  against: Types.ObjectId;
  title: string;
  description: string;
  evidence: IEvidence[];
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminLog extends Document {
  _id: Types.ObjectId;
  admin: Types.ObjectId;
  action: AdminAction;
  targetType: 'user' | 'gig' | 'payment' | 'review' | 'dispute';
  targetId: Types.ObjectId;
  details: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

// ───────────────────────── Request Extensions ─────────────────────────

// `req.user` is declared globally in ./express.d.ts; kept as an alias for existing handlers.
export type AuthRequest = Request;

// ───────────────────────── API Response ─────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ───────────────────────── Token Payloads ─────────────────────────

export interface JwtPayload {
  id: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  id: string;
  iat?: number;
  exp?: number;
}

// ───────────────────────── Service Types ─────────────────────────

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: string;
  locationType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MatchScore {
  freelancerId: Types.ObjectId;
  score: number;
  reasons: string[];
}

export interface DashboardStats {
  totalUsers: number;
  totalGigs: number;
  totalPayments: number;
  totalRevenue: number;
  activeDisputes: number;
  newUsersThisMonth: number;
  completedGigsThisMonth: number;
  revenueThisMonth: number;
}
