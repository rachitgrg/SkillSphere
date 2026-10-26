import { z } from 'zod';

// ───────────────────────── Shared pieces ─────────────────────────

/** GeoJSON point: [longitude, latitude]. */
export const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

const optionalUrl = z.string().url().optional().or(z.literal(''));
/** Optional date; empty strings from HTML inputs count as unset. */
const optionalDate = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional());
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const milestoneInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  amount: z.number().min(0),
  dueDate: z.coerce.date(),
});

// ───────────────────────── Auth Schemas ─────────────────────────

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    role: z.enum(['freelancer', 'client']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    twoFactorCode: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({ token: z.string().min(1, 'Token is required') }),
  body: z.object({
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

const otpCode = z.string().trim().min(6, 'Enter the 6-digit code').max(20);

export const twoFactorCodeSchema = z.object({ body: z.object({ code: otpCode }) });

export const twoFactorDisableSchema = z.object({
  body: z.object({ password: z.string().optional().default(''), code: otpCode }),
});

export const twoFactorVerifySchema = z.object({
  body: z.object({ tempToken: z.string().min(1), code: otpCode }),
});

export const chooseRoleSchema = z.object({
  body: z.object({ role: z.enum(['freelancer', 'client']) }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

// ───────────────────────── User Schemas ─────────────────────────

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().optional(),
    bio: z.string().max(500).optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
    }).optional(),
    location: geoPointSchema.optional(),
  }),
});

export const updateFreelancerProfileSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(100).optional(),
    headline: z.string().max(200).optional(),
    skills: z.array(z.object({
      name: z.string().min(1),
      proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
      yearsOfExperience: z.number().min(0).optional(),
    })).max(50).optional(),
    hourlyRate: z.number().min(0).optional(),
    availability: z.enum(['available', 'busy', 'unavailable']).optional(),
    languages: z.array(z.object({
      language: z.string().min(1),
      proficiency: z.string().min(1),
    })).optional(),
    socialLinks: z.object({
      github: z.string().url().optional().or(z.literal('')),
      linkedin: z.string().url().optional().or(z.literal('')),
      website: z.string().url().optional().or(z.literal('')),
      twitter: z.string().url().optional().or(z.literal('')),
    }).optional(),
    education: z.array(z.object({
      degree: z.string().min(1),
      institution: z.string().min(1),
      year: z.number().min(1900).max(2100),
    })).optional(),
    availabilitySlots: z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(HH_MM, 'Use HH:mm'),
      endTime: z.string().regex(HH_MM, 'Use HH:mm'),
    })).max(50).optional(),
    certifications: z.array(z.object({
      name: z.string().trim().min(1).max(200),
      issuer: z.string().trim().min(1).max(200),
      issueDate: z.coerce.date(),
      expiryDate: optionalDate,
      credentialUrl: optionalUrl,
    })).max(30).optional(),
    workExperience: z.array(z.object({
      title: z.string().trim().min(1).max(200),
      company: z.string().trim().min(1).max(200),
      startDate: z.coerce.date(),
      endDate: optionalDate,
      current: z.boolean().optional(),
      description: z.string().trim().min(1).max(2000),
    })).max(30).optional(),
    milestonePricing: z.array(z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(1000).optional(),
      price: z.number().min(0),
      deliveryDays: z.number().int().min(1).max(365),
    })).max(10).optional(),
    location: geoPointSchema.optional(),
  }),
});

export const updateClientProfileSchema = z.object({
  body: z.object({
    companyName: z.string().max(100).optional(),
    companyWebsite: z.string().url().optional().or(z.literal('')),
    companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']).optional(),
    industry: z.string().optional(),
    description: z.string().max(1000).optional(),
  }),
});

// ───────────────────────── Gig Schemas ─────────────────────────

export const createGigSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(5000),
    category: z.string().min(1, 'Category is required'),
    subCategory: z.string().optional(),
    skills: z.array(z.string()).min(1, 'At least one skill is required').max(20),
    budgetType: z.enum(['fixed', 'hourly']),
    budgetMin: z.number().min(0),
    budgetMax: z.number().min(0),
    duration: z.string().min(1),
    experienceLevel: z.enum(['entry', 'intermediate', 'expert']),
    milestones: z.array(milestoneInput).max(20).optional(),
    locationType: z.enum(['remote', 'onsite', 'hybrid']).optional(),
    visibility: z.enum(['public', 'private', 'invite_only']).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    deadline: optionalDate,
    location: geoPointSchema.optional(),
  }),
});

export const updateGigSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
    skills: z.array(z.string()).min(1).max(20).optional(),
    budgetType: z.enum(['fixed', 'hourly']).optional(),
    budgetMin: z.number().min(0).optional(),
    budgetMax: z.number().min(0).optional(),
    duration: z.string().optional(),
    experienceLevel: z.enum(['entry', 'intermediate', 'expert']).optional(),
    milestones: z.array(milestoneInput).max(20).optional(),
    locationType: z.enum(['remote', 'onsite', 'hybrid']).optional(),
    visibility: z.enum(['public', 'private', 'invite_only']).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    deadline: optionalDate,
    location: geoPointSchema.optional(),
    // status, views, client and selectedFreelancer are server-controlled.
  }),
});

export const inviteFreelancerSchema = z.object({
  body: z.object({
    freelancerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid freelancer id'),
    message: z.string().trim().max(500).optional(),
  }),
});

export const respondInvitationSchema = z.object({
  body: z.object({
    status: z.enum(['declined']),
  }),
});

export const progressLogSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1, 'Write an update').max(2000),
    milestoneId: z.union([z.string().regex(/^[a-f\d]{24}$/i), z.literal('')]).optional(),
  }),
});

export const milestonePercentSchema = z.object({
  body: z.object({ percent: z.coerce.number().int().min(0).max(100) }),
});

export const submitMilestoneSchema = z.object({
  body: z.object({ note: z.string().trim().max(2000).optional() }),
});

export const requestChangesSchema = z.object({
  body: z.object({ note: z.string().trim().min(3, 'Say what needs to change').max(2000) }),
});

// ───────────────────────── Proposal Schemas ─────────────────────────

export const createProposalSchema = z.object({
  body: z.object({
    gigId: z.string().min(1, 'Gig is required'),
    coverLetter: z.string().trim().min(1, 'Cover letter is required').max(3000),
    proposedAmount: z.number().positive('Amount must be positive'),
    estimatedDuration: z.string().trim().min(1, 'Duration is required').max(100),
    milestones: z.array(milestoneInput).max(20).optional(),
    attachments: z.array(z.string().url()).max(10).optional(),
  }),
});

export const updateProposalStatusSchema = z.object({
  body: z.object({
    status: z.enum(['accepted', 'rejected', 'negotiating']),
    clientNotes: z.string().max(2000).optional(),
  }),
});

export const negotiateProposalSchema = z.object({
  body: z.object({
    amount: z.number().positive('Amount must be positive'),
    message: z.string().trim().min(1, 'Message is required').max(1000),
  }),
});

// ───────────────────────── Chat Schemas ─────────────────────────

export const createConversationSchema = z.object({
  body: z.object({
    participantId: z.string().min(1, 'Participant is required'),
    gigId: z.string().optional(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Message content is required').max(5000),
    type: z.enum(['text', 'image', 'file', 'system']).optional(),
  }),
  params: z.object({
    conversationId: z.string().min(1),
  }),
});

// ───────────────────────── Payment Schemas ─────────────────────────

export const createPaymentSchema = z.object({
  body: z.object({
    gigId: z.string().min(1),
    milestoneId: z.string().optional(),
    freelancerId: z.string().optional(),
    // Required when no milestoneId is given; otherwise taken from the milestone.
    amount: z.number().min(1, 'Amount must be at least 1').optional(),
    description: z.string().max(500).optional(),
  }),
});

// Field names match what Razorpay Checkout passes to its success handler.
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
});

// ───────────────────────── Review Schemas ─────────────────────────

export const createReviewSchema = z.object({
  body: z.object({
    gigId: z.string().min(1, 'Gig is required'),
    // The overall rating is computed from these (see models/Review.ts); the reviewee is derived from the gig.
    categories: z.object({
      communication: z.number().int().min(1).max(5),
      quality: z.number().int().min(1).max(5),
      timeliness: z.number().int().min(1).max(5),
      professionalism: z.number().int().min(1).max(5),
      value: z.number().int().min(1).max(5),
    }),
    comment: z.string().trim().min(1, 'Comment is required').max(2000),
  }),
});

export const respondReviewSchema = z.object({
  body: z.object({
    response: z.string().min(1, 'Response is required').max(1000),
  }),
});

// ───────────────────────── Dispute Schemas ─────────────────────────

export const createDisputeSchema = z.object({
  body: z.object({
    gigId: z.string().min(1),
    paymentId: z.string().optional(),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(3000),
  }),
});

export const resolveDisputeSchema = z.object({
  body: z
    .object({
      resolution: z.string().trim().min(1, 'Resolution is required').max(2000),
      adminNotes: z.string().max(2000).optional(),
      paymentAction: z.enum(['refund', 'release', 'split']).optional(),
      // Amount refunded to the client when paymentAction is 'split'; the rest is released.
      refundAmount: z.number().positive().optional(),
    })
    .refine((b) => b.paymentAction !== 'split' || b.refundAmount !== undefined, {
      message: 'refundAmount is required for a split',
      path: ['refundAmount'],
    }),
});

// ───────────────────────── Search Schemas ─────────────────────────

export const searchSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    skills: z.string().optional(),
    budgetMin: z.string().optional(),
    budgetMax: z.string().optional(),
    experienceLevel: z.string().optional(),
    locationType: z.string().optional(),
    status: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// ───────────────────────── Admin Schemas ─────────────────────────

export const suspendUserSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'A reason is required').max(500),
    // Omit for an indefinite suspension.
    durationDays: z.number().int().min(1).max(3650).optional(),
  }),
});

export const rejectGigSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Tell the client why').max(1000),
  }),
});

export const reviewVisibilitySchema = z.object({
  body: z.object({
    isVisible: z.boolean(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

// ───────────────────────── AI Schemas ─────────────────────────

/** Multipart text fields arrive as strings; technologies may be a comma list or JSON array. */
const channelPreferences = z
  .object({ proposals: z.boolean(), gigs: z.boolean(), payments: z.boolean(), reviews: z.boolean(), messages: z.boolean(), disputes: z.boolean(), projects: z.boolean() })
  .partial()
  .strict();

export const notificationPreferencesSchema = z.object({
  body: z.object({ email: channelPreferences.optional(), inApp: channelPreferences.optional() }).strict(),
});

export const portfolioItemSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: z.string().trim().min(1, 'Description is required').max(2000),
    url: z.union([z.string().trim().url('Enter a valid URL'), z.literal('')]).optional(),
    technologies: z
      .preprocess((v) => {
        if (typeof v !== 'string') return v;
        const t = v.trim();
        if (t.startsWith('[')) {
          try {
            return JSON.parse(t);
          } catch {
            return t;
          }
        }
        return t ? t.split(',').map((x) => x.trim()).filter(Boolean) : [];
      }, z.array(z.string().max(50)).max(20))
      .optional(),
    /** JSON requests only: images hosted elsewhere (used when uploads are not configured). */
    imageUrls: z.array(z.string().url()).max(6).optional(),
  }),
});

export const verificationRequestSchema = z.object({
  body: z.object({
    message: z.string().trim().max(1000).optional(),
  }),
});

export const rejectVerificationSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Tell the freelancer why').max(1000),
  }),
});

export const careerAnalysisSchema = z.object({
  body: z.object({
    resumeText: z.string().trim().min(50, 'Paste at least a few lines of your resume').max(20000),
  }),
});

export const refundPaymentSchema = z.object({
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const reportReviewSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(3, 'Tell us what is wrong with this review').max(500),
  }),
});
