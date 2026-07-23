import { z } from 'zod';

// ───────────────────────── Auth Schemas ─────────────────────────

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    role: z.enum(['freelancer', 'client']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    twoFactorCode: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
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
    location: z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    }).optional(),
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
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
    })).optional(),
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
    milestones: z.array(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      amount: z.number().min(0),
      dueDate: z.string(),
    })).optional(),
    locationType: z.enum(['remote', 'onsite', 'hybrid']).optional(),
    visibility: z.enum(['public', 'private', 'invite_only']).optional(),
    tags: z.array(z.string()).optional(),
    deadline: z.string().optional(),
    location: z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()]),
    }).optional(),
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
    milestones: z.array(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      amount: z.number().min(0),
      dueDate: z.string(),
    })).optional(),
    locationType: z.enum(['remote', 'onsite', 'hybrid']).optional(),
    visibility: z.enum(['public', 'private', 'invite_only']).optional(),
    tags: z.array(z.string()).optional(),
    deadline: z.string().optional(),
    status: z.enum(['draft', 'open', 'in_progress', 'completed', 'cancelled']).optional(),
  }),
});

// ───────────────────────── Proposal Schemas ─────────────────────────

export const createProposalSchema = z.object({
  body: z.object({
    coverLetter: z.string().min(1, 'Cover letter is required').max(3000),
    proposedAmount: z.number().min(0, 'Amount must be positive'),
    estimatedDuration: z.string().min(1, 'Duration is required'),
    milestones: z.array(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      amount: z.number().min(0),
      dueDate: z.string(),
    })).optional(),
  }),
  params: z.object({
    gigId: z.string().min(1),
  }),
});

export const negotiateProposalSchema = z.object({
  body: z.object({
    amount: z.number().min(0),
    message: z.string().min(1, 'Message is required'),
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
    amount: z.number().min(1, 'Amount must be at least 1'),
    description: z.string().optional(),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
});

// ───────────────────────── Review Schemas ─────────────────────────

export const createReviewSchema = z.object({
  body: z.object({
    rating: z.number().min(1).max(5),
    categories: z.object({
      communication: z.number().min(1).max(5),
      quality: z.number().min(1).max(5),
      timeliness: z.number().min(1).max(5),
      professionalism: z.number().min(1).max(5),
      value: z.number().min(1).max(5),
    }),
    comment: z.string().min(1, 'Comment is required').max(2000),
  }),
  params: z.object({
    gigId: z.string().min(1),
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
  body: z.object({
    resolution: z.string().min(1, 'Resolution is required'),
    adminNotes: z.string().optional(),
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

export const banUserSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Ban reason is required'),
  }),
  params: z.object({
    userId: z.string().min(1),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
