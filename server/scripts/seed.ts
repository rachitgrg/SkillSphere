/**
 * Non-destructive demo seed: `npm run seed` (from server/).
 *
 *   MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev npm run seed
 *
 * - Refuses to run unless MONGO_URI points at localhost, or `--force` is passed.
 * - Upserts by natural keys (user email, gig owner+title, …); never deletes anything.
 * - Credentials come from env with documented demo defaults:
 *     SEED_ADMIN_EMAIL (admin@skillsphere.dev), SEED_ADMIN_PASSWORD (Admin@12345),
 *     SEED_DEMO_PASSWORD (Demo@12345) for every client and freelancer.
 */
import { env } from '../src/config/env';
import mongoose, { Types } from 'mongoose';
import User from '../src/models/User';
import ClientProfile from '../src/models/ClientProfile';
import FreelancerProfile from '../src/models/FreelancerProfile';
import Gig from '../src/models/Gig';
import Proposal from '../src/models/Proposal';
import Payment from '../src/models/Payment';
import Review from '../src/models/Review';
import Dispute from '../src/models/Dispute';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import reputationService from '../src/services/reputationService';
import { syncSchemaIndexes } from './lib/indexes';
import {
  DisputeStatus,
  GigStatus,
  IGeoLocation,
  IUser,
  MilestoneStatus,
  PaymentStatus,
  ProficiencyLevel,
  ProposalStatus,
  UserRole,
} from '../src/types';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@skillsphere.dev';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo@12345';

/** Only the documented demo defaults are printed; custom passwords from env stay hidden. */
const shown = (password: string, envVar: string) => (process.env[envVar] ? `(from ${envVar})` : password);

// ───────────────────────── Reference data ─────────────────────────

const CITIES: Record<string, { coordinates: [number, number]; state: string }> = {
  Bengaluru: { coordinates: [77.5946, 12.9716], state: 'Karnataka' },
  Mumbai: { coordinates: [72.8777, 19.076], state: 'Maharashtra' },
  Delhi: { coordinates: [77.209, 28.6139], state: 'Delhi' },
  Pune: { coordinates: [73.8567, 18.5204], state: 'Maharashtra' },
  Hyderabad: { coordinates: [78.4867, 17.385], state: 'Telangana' },
  Chennai: { coordinates: [80.2707, 13.0827], state: 'Tamil Nadu' },
};

const point = (city: string): IGeoLocation => ({ type: 'Point', coordinates: CITIES[city].coordinates });
const address = (city: string) => ({ city, state: CITIES[city].state, country: 'India' });

const CLIENTS = [
  { firstName: 'Ananya', lastName: 'Iyer', email: 'ananya@client.demo', city: 'Bengaluru', company: 'TechSphere Labs', industry: 'SaaS', size: '11-50' },
  { firstName: 'Rohan', lastName: 'Mehta', email: 'rohan@client.demo', city: 'Mumbai', company: 'AppForge Studio', industry: 'Mobile Apps', size: '1-10' },
  { firstName: 'Kavya', lastName: 'Reddy', email: 'kavya@client.demo', city: 'Hyderabad', company: 'NeuralMetrics AI', industry: 'Artificial Intelligence', size: '51-200' },
] as const;

type SkillSeed = [name: string, proficiency: ProficiencyLevel, years: number];
const P = ProficiencyLevel;

const FREELANCERS: {
  firstName: string; lastName: string; email: string; city: string; title: string; headline: string;
  hourlyRate: number; skills: SkillSeed[];
}[] = [
  { firstName: 'Arjun', lastName: 'Sharma', email: 'arjun@freelancer.demo', city: 'Bengaluru', title: 'Senior React & Node.js Developer', headline: 'I build fast, accessible SaaS dashboards.', hourlyRate: 1800,
    skills: [['React', P.EXPERT, 6], ['Next.js', P.ADVANCED, 4], ['TypeScript', P.EXPERT, 5], ['Node.js', P.ADVANCED, 5], ['TailwindCSS', P.ADVANCED, 3]] },
  { firstName: 'Priya', lastName: 'Nair', email: 'priya@freelancer.demo', city: 'Bengaluru', title: 'Product Designer (UI/UX)', headline: 'Design systems and prototypes in Figma.', hourlyRate: 1500,
    skills: [['Figma', P.EXPERT, 6], ['UI/UX', P.EXPERT, 6], ['Prototyping', P.ADVANCED, 5], ['Design Systems', P.ADVANCED, 4], ['Webflow', P.INTERMEDIATE, 2]] },
  { firstName: 'Vikram', lastName: 'Patel', email: 'vikram@freelancer.demo', city: 'Mumbai', title: 'Flutter & React Native Engineer', headline: 'Cross-platform apps that feel native.', hourlyRate: 1600,
    skills: [['Flutter', P.EXPERT, 5], ['Dart', P.EXPERT, 5], ['React Native', P.ADVANCED, 3], ['Firebase', P.ADVANCED, 4], ['Kotlin', P.INTERMEDIATE, 2]] },
  { firstName: 'Sneha', lastName: 'Kulkarni', email: 'sneha@freelancer.demo', city: 'Pune', title: 'Machine Learning Engineer', headline: 'From notebook to production ML services.', hourlyRate: 2500,
    skills: [['Python', P.EXPERT, 7], ['PyTorch', P.ADVANCED, 4], ['Machine Learning', P.EXPERT, 5], ['Pandas', P.EXPERT, 6], ['LangChain', P.INTERMEDIATE, 1]] },
  { firstName: 'Rahul', lastName: 'Verma', email: 'rahul@freelancer.demo', city: 'Delhi', title: 'DevOps & Cloud Architect', headline: 'AWS, Kubernetes and boringly reliable CI/CD.', hourlyRate: 2800,
    skills: [['AWS', P.EXPERT, 7], ['Docker', P.EXPERT, 6], ['Kubernetes', P.ADVANCED, 4], ['Terraform', P.ADVANCED, 4], ['CI/CD', P.EXPERT, 6]] },
  { firstName: 'Meera', lastName: 'Joshi', email: 'meera@freelancer.demo', city: 'Pune', title: 'Backend Developer (Python & Go)', headline: 'APIs that scale: Django, Go, PostgreSQL.', hourlyRate: 1700,
    skills: [['Python', P.ADVANCED, 5], ['Django', P.EXPERT, 5], ['Go', P.ADVANCED, 3], ['PostgreSQL', P.ADVANCED, 5], ['Redis', P.INTERMEDIATE, 3]] },
  { firstName: 'Karthik', lastName: 'Subramanian', email: 'karthik@freelancer.demo', city: 'Chennai', title: 'Security Engineer & Pentester', headline: 'OSCP-certified web and cloud pentesting.', hourlyRate: 3000,
    skills: [['Cyber Security', P.EXPERT, 8], ['Penetration Testing', P.EXPERT, 6], ['Python', P.ADVANCED, 5], ['Ethical Hacking', P.EXPERT, 6], ['C++', P.INTERMEDIATE, 3]] },
  { firstName: 'Aisha', lastName: 'Khan', email: 'aisha@freelancer.demo', city: 'Hyderabad', title: 'Full-Stack Developer (MERN)', headline: 'MERN apps with GraphQL and real-time features.', hourlyRate: 1200,
    skills: [['MongoDB', P.ADVANCED, 4], ['Express', P.ADVANCED, 4], ['React', P.ADVANCED, 4], ['Node.js', P.ADVANCED, 4], ['GraphQL', P.INTERMEDIATE, 2]] },
];

/** Former client-side INITIAL_GIGS. Budgets are INR; `owner` indexes CLIENTS. */
const GIGS: {
  title: string; description: string; category: string; skills: string[];
  budgetType: 'fixed' | 'hourly'; budgetMin: number; budgetMax: number; duration: string;
  experienceLevel: 'entry' | 'intermediate' | 'expert'; locationType: 'remote' | 'onsite' | 'hybrid'; owner: number;
}[] = [
  { title: 'Senior React & Next.js SaaS Platform Architect', description: 'Looking for an expert React/Next.js developer to construct a modern multi-tenant SaaS dashboard with TailwindCSS, Redux Toolkit, and real-time WebSocket updates.', category: 'Web Development', skills: ['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'Node.js'], budgetType: 'fixed', budgetMin: 250000, budgetMax: 350000, duration: '2 months', experienceLevel: 'expert', locationType: 'hybrid', owner: 0 },
  { title: 'Cross-Platform Flutter Mobile App for iOS & Android', description: 'We require a skilled Flutter developer to build a high-performance ecommerce mobile application integrated with a Firebase backend and Razorpay payments.', category: 'Mobile Development', skills: ['Flutter', 'Dart', 'Mobile Dev', 'Firebase', 'REST API'], budgetType: 'fixed', budgetMin: 350000, budgetMax: 500000, duration: '3 months', experienceLevel: 'expert', locationType: 'remote', owner: 1 },
  { title: 'Enterprise Figma UI/UX Design System & Prototypes', description: 'Design a scalable dark-themed design system in Figma with 50+ component variants, mobile wireframes, and interactive prototype flows.', category: 'UI/UX Design', skills: ['UI/UX', 'Figma', 'Prototyping', 'Design Systems', 'User Research'], budgetType: 'fixed', budgetMin: 120000, budgetMax: 200000, duration: '1 month', experienceLevel: 'intermediate', locationType: 'onsite', owner: 0 },
  { title: 'Python Machine Learning Model Pipeline & Training', description: 'Looking for a Data Science engineer to build predictive ML algorithms using PyTorch and Pandas, deployed as a REST microservice via FastAPI.', category: 'Data Science & AI', skills: ['Python', 'PyTorch', 'Data Science', 'Pandas', 'Machine Learning'], budgetType: 'hourly', budgetMin: 1800, budgetMax: 2800, duration: '6 months', experienceLevel: 'expert', locationType: 'remote', owner: 2 },
  { title: 'AWS Kubernetes & Docker Infrastructure Automation', description: 'Automate containerized microservices deployment on AWS EKS using Terraform, Helm charts, and GitHub Actions CI/CD pipelines.', category: 'DevOps & Cloud', skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'], budgetType: 'hourly', budgetMin: 2200, budgetMax: 3200, duration: '3 months', experienceLevel: 'expert', locationType: 'remote', owner: 2 },
  { title: 'Ethereum Smart Contract Audit & DeFi DApp Development', description: 'Build secure ERC-20 token staking contracts in Solidity and connect them to a Web3 React frontend via Ethers.js and Hardhat.', category: 'Blockchain & Web3', skills: ['Solidity', 'Web3', 'Ethereum', 'React', 'Hardhat'], budgetType: 'fixed', budgetMin: 500000, budgetMax: 750000, duration: '2 months', experienceLevel: 'expert', locationType: 'remote', owner: 1 },
  { title: 'Full-Stack Node.js & GraphQL Microservices Developer', description: 'Refactor legacy REST backend into GraphQL microservices with Apollo Server, Node.js, TypeScript, and MongoDB Atlas.', category: 'Web Development', skills: ['Node.js', 'GraphQL', 'MongoDB', 'TypeScript', 'Express'], budgetType: 'fixed', budgetMin: 180000, budgetMax: 260000, duration: '6 weeks', experienceLevel: 'intermediate', locationType: 'hybrid', owner: 2 },
  { title: 'Penetration Testing & SOC 2 Cybersecurity Audit', description: 'Conduct a vulnerability assessment and penetration test on an enterprise cloud application. Provide detailed remediation reports for SOC 2 compliance.', category: 'Cyber Security', skills: ['Cyber Security', 'Penetration Testing', 'Python', 'Ethical Hacking', 'SOC 2'], budgetType: 'fixed', budgetMin: 300000, budgetMax: 400000, duration: '3 weeks', experienceLevel: 'expert', locationType: 'onsite', owner: 2 },
  { title: 'Django & PostgreSQL E-Commerce Backend Systems', description: 'Develop a robust e-commerce backend API using Django REST framework, PostgreSQL, Redis caching, and a Razorpay webhook handler.', category: 'Web Development', skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker'], budgetType: 'fixed', budgetMin: 150000, budgetMax: 230000, duration: '1 month', experienceLevel: 'intermediate', locationType: 'remote', owner: 1 },
  { title: 'Vue 3 & Vite Real-Time Financial Data Analytics', description: 'Create an ultra-fast real-time charting dashboard in Vue 3, Vite, Pinia, and TailwindCSS using a WebSocket feed.', category: 'Web Development', skills: ['Vue.js', 'Vite', 'TypeScript', 'Pinia', 'TailwindCSS'], budgetType: 'fixed', budgetMin: 100000, budgetMax: 150000, duration: '3 weeks', experienceLevel: 'intermediate', locationType: 'remote', owner: 0 },
  { title: 'Native Android Kotlin Banking App Development', description: 'Develop a native Android banking application using Kotlin, Jetpack Compose, Clean Architecture, and biometric security features.', category: 'Mobile Development', skills: ['Android', 'Kotlin', 'Mobile Dev', 'Jetpack Compose', 'REST API'], budgetType: 'hourly', budgetMin: 1500, budgetMax: 2200, duration: '4 months', experienceLevel: 'expert', locationType: 'hybrid', owner: 1 },
  { title: 'LLM & LangChain Chatbot Integration', description: 'Integrate a custom LLM agent using LangChain and a vector database into an existing React customer portal.', category: 'Data Science & AI', skills: ['Python', 'LangChain', 'LLM', 'Node.js', 'React'], budgetType: 'fixed', budgetMin: 200000, budgetMax: 280000, duration: '1 month', experienceLevel: 'expert', locationType: 'remote', owner: 2 },
  { title: 'React Native Telehealth Booking & Video Call App', description: 'Build a cross-platform React Native app for doctor consultations with WebRTC video calling, appointment booking, and encrypted chat.', category: 'Mobile Development', skills: ['React Native', 'TypeScript', 'Redux', 'Mobile Dev', 'Node.js'], budgetType: 'fixed', budgetMin: 300000, budgetMax: 380000, duration: '2 months', experienceLevel: 'intermediate', locationType: 'onsite', owner: 1 },
  { title: 'Golang High-Throughput Microservice API Service', description: 'Build a lightweight high-performance REST and gRPC API in Go with PostgreSQL that handles over 50,000 requests per second.', category: 'Web Development', skills: ['Go', 'Golang', 'gRPC', 'PostgreSQL', 'Docker'], budgetType: 'hourly', budgetMin: 2000, budgetMax: 3000, duration: '3 months', experienceLevel: 'expert', locationType: 'remote', owner: 0 },
  { title: 'Figma Brand Guidelines & Webflow Marketing Website', description: 'Craft fresh brand assets, a logo redesign and design system, and implement high-converting landing pages inside Webflow.', category: 'UI/UX Design', skills: ['UI/UX', 'Figma', 'Webflow', 'Graphic Design', 'Branding'], budgetType: 'fixed', budgetMin: 60000, budgetMax: 100000, duration: '2 weeks', experienceLevel: 'entry', locationType: 'hybrid', owner: 0 },
  { title: 'Angular 17 Enterprise ERP Dashboard Modules', description: 'Build an enterprise inventory management frontend using Angular 17, RxJS, NgRx state management, and AG-Grid data tables.', category: 'Web Development', skills: ['Angular', 'TypeScript', 'RxJS', 'NgRx', 'Bootstrap'], budgetType: 'hourly', budgetMin: 1000, budgetMax: 1600, duration: '5 months', experienceLevel: 'intermediate', locationType: 'remote', owner: 2 },
];

// ───────────────────────── Helpers ─────────────────────────

const DAY = 86_400_000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

const isLocalUri = (uri: string) => {
  try {
    const host = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://')).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return false;
  }
};

/** Creates the user or updates its profile fields. Existing passwords are only reset with --reset-passwords. */
const upsertUser = async (
  data: { firstName: string; lastName: string; email: string; role: UserRole; city?: string; bio?: string },
  password: string,
  resetPasswords: boolean
): Promise<IUser> => {
  let user = await User.findOne({ email: data.email });
  const fields = {
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    isVerified: true,
    isActive: true,
    isBanned: false,
    bio: data.bio,
    ...(data.city ? { location: point(data.city), address: address(data.city) } : {}),
  };
  if (!user) {
    user = new User({ email: data.email, password, ...fields });
  } else {
    user.set(fields);
    if (resetPasswords) user.password = password;
  }
  await user.save();
  return user;
};

const upsertGig = async (client: IUser, gig: (typeof GIGS)[number], extra: Record<string, unknown> = {}) => {
  const city = CLIENTS[gig.owner].city;
  const { owner: _owner, ...fields } = gig;
  const doc =
    (await Gig.findOne({ client: client._id, title: gig.title })) ?? new Gig({ client: client._id, title: gig.title });
  doc.set({
    ...fields,
    status: GigStatus.OPEN,
    visibility: 'public',
    tags: ['seed'],
    ...(gig.locationType === 'remote' ? {} : { location: point(city) }),
    ...extra,
  });
  await doc.save();
  return doc;
};

const upsertProposal = async (
  gigId: Types.ObjectId,
  freelancerId: Types.ObjectId,
  data: { coverLetter: string; proposedAmount: number; estimatedDuration: string; status: ProposalStatus }
) => {
  const proposal = await Proposal.findOneAndUpdate(
    { gig: gigId, freelancer: freelancerId },
    { $set: data },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  await Gig.updateOne({ _id: gigId }, { $addToSet: { proposals: proposal._id } });
  return proposal;
};

const upsertPayment = async (key: string, data: Record<string, unknown>) => {
  const payment = (await Payment.findOne({ razorpayOrderId: key })) ?? new Payment({ razorpayOrderId: key });
  payment.set(data);
  await payment.save();
  return payment;
};

const upsertReview = async (data: {
  gig: Types.ObjectId; reviewer: Types.ObjectId; reviewee: Types.ObjectId;
  categories: Record<'communication' | 'quality' | 'timeliness' | 'professionalism' | 'value', number>; comment: string;
}) => {
  const review = (await Review.findOne({ gig: data.gig, reviewer: data.reviewer })) ?? new Review(data);
  review.set(data);
  await review.save();
};

// ───────────────────────── Main ─────────────────────────

async function main() {
  const force = process.argv.includes('--force');
  const resetPasswords = process.argv.includes('--reset-passwords');

  if (!isLocalUri(env.MONGO_URI) && !force) {
    console.error(
      'Refusing to seed: MONGO_URI is not a localhost database.\n' +
        'Use MONGO_URI=mongodb://127.0.0.1:27017/skillsphere_dev npm run seed, or pass --force if you really mean it.'
    );
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);
  // Also migrates indexes whose definition changed (e.g. googleId became unique).
  for (const model of Object.values(mongoose.models)) await syncSchemaIndexes(model);
  console.log(`Seeding ${mongoose.connection.host}/${mongoose.connection.name} …`);

  // Users ------------------------------------------------------------------
  const admin = await upsertUser(
    { firstName: 'Platform', lastName: 'Admin', email: ADMIN_EMAIL, role: UserRole.ADMIN },
    ADMIN_PASSWORD,
    resetPasswords
  );

  const clients: IUser[] = [];
  for (const c of CLIENTS) {
    const user = await upsertUser(
      { firstName: c.firstName, lastName: c.lastName, email: c.email, role: UserRole.CLIENT, city: c.city, bio: `Founder at ${c.company}.` },
      DEMO_PASSWORD,
      resetPasswords
    );
    await ClientProfile.updateOne(
      { user: user._id },
      { $set: { companyName: c.company, industry: c.industry, companySize: c.size, paymentVerified: true } },
      { upsert: true }
    );
    clients.push(user);
  }

  const freelancers: IUser[] = [];
  for (const f of FREELANCERS) {
    const user = await upsertUser(
      { firstName: f.firstName, lastName: f.lastName, email: f.email, role: UserRole.FREELANCER, city: f.city, bio: f.headline },
      DEMO_PASSWORD,
      resetPasswords
    );
    await FreelancerProfile.updateOne(
      { user: user._id },
      {
        $set: {
          title: f.title,
          headline: f.headline,
          hourlyRate: f.hourlyRate,
          skills: f.skills.map(([name, proficiency, yearsOfExperience]) => ({ name, proficiency, yearsOfExperience })),
          languages: [{ language: 'English', proficiency: 'fluent' }, { language: 'Hindi', proficiency: 'fluent' }],
          availabilitySlots: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '10:00', endTime: '18:00' })),
        },
      },
      { upsert: true }
    );
    freelancers.push(user);
  }
  const [arjun, priya, vikram, sneha, rahul, meera, karthik, aisha] = freelancers;

  // Open marketplace gigs ---------------------------------------------------
  const gigs = [];
  for (const g of GIGS) gigs.push(await upsertGig(clients[g.owner], g));

  // Pending proposals on a few open gigs
  const pending: [number, IUser, number][] = [
    [0, arjun, 300000], [0, aisha, 260000], [2, priya, 180000], [3, sneha, 2500],
    [4, rahul, 3000], [7, karthik, 380000], [8, meera, 200000], [14, priya, 85000],
  ];
  for (const [gigIndex, freelancer, amount] of pending) {
    await upsertProposal(gigs[gigIndex]._id, freelancer._id, {
      coverLetter: `Hi! I'm ${freelancer.firstName}. I've shipped similar projects and can start this week.`,
      proposedAmount: amount,
      estimatedDuration: GIGS[gigIndex].duration,
      status: ProposalStatus.PENDING,
    });
  }
  for (const gig of gigs) {
    await Gig.updateOne({ _id: gig._id }, { totalProposals: await Proposal.countDocuments({ gig: gig._id }) });
  }

  // In-progress gig with milestones (escrow + pending payment) --------------
  const inProgress = await upsertGig(clients[0], {
    title: 'Customer Portal Revamp (React + Node)',
    description: 'Rebuild our customer portal with React, a Node.js API and role-based access. Two milestones: UI, then API + integration.',
    category: 'Web Development', skills: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
    budgetType: 'fixed', budgetMin: 150000, budgetMax: 200000, duration: '6 weeks', experienceLevel: 'intermediate',
    locationType: 'hybrid', owner: 0,
  }, { status: GigStatus.IN_PROGRESS, selectedFreelancer: arjun._id });
  if (inProgress.milestones.length === 0) {
    inProgress.milestones.push(
      { title: 'UI & design implementation', description: 'All screens built and responsive', amount: 80000, dueDate: daysFromNow(10), status: MilestoneStatus.IN_PROGRESS },
      { title: 'API & integration', description: 'Node API, auth and deployment', amount: 100000, dueDate: daysFromNow(30), status: MilestoneStatus.PENDING }
    );
    await inProgress.save();
  }
  await upsertProposal(inProgress._id, arjun._id, {
    coverLetter: 'Happy to take this on — I built a similar portal last year.', proposedAmount: 180000,
    estimatedDuration: '6 weeks', status: ProposalStatus.ACCEPTED,
  });
  await upsertPayment('seed_order_inprogress_m1', {
    gig: inProgress._id, milestone: inProgress.milestones[0]._id, client: clients[0]._id, freelancer: arjun._id,
    amount: 80000, status: PaymentStatus.ESCROW, razorpayPaymentId: 'seed_pay_inprogress_m1', escrowedAt: daysFromNow(-3),
    description: 'Milestone 1 escrow',
  });
  await upsertPayment('seed_order_inprogress_m2', {
    gig: inProgress._id, milestone: inProgress.milestones[1]._id, client: clients[0]._id, freelancer: arjun._id,
    amount: 100000, status: PaymentStatus.PENDING, description: 'Milestone 2 (checkout not completed)',
  });

  // Completed gig with reviews and a released payment -----------------------
  const completed = await upsertGig(clients[1], {
    title: 'Restaurant Ordering App (Flutter)',
    description: 'A Flutter ordering app for our restaurant chain with menu, cart, Razorpay checkout and order tracking.',
    category: 'Mobile Development', skills: ['Flutter', 'Dart', 'Firebase'],
    budgetType: 'fixed', budgetMin: 90000, budgetMax: 120000, duration: '1 month', experienceLevel: 'intermediate',
    locationType: 'remote', owner: 1,
  }, { status: GigStatus.COMPLETED, selectedFreelancer: vikram._id, completedAt: daysFromNow(-5) });
  if (completed.milestones.length === 0) {
    completed.milestones.push({
      title: 'Complete app', description: 'App delivered to Play Store and App Store', amount: 110000,
      dueDate: daysFromNow(-7), status: MilestoneStatus.APPROVED, completedAt: daysFromNow(-6),
    });
    await completed.save();
  }
  await upsertProposal(completed._id, vikram._id, {
    coverLetter: 'Flutter is my main stack; I can deliver in 4 weeks.', proposedAmount: 110000,
    estimatedDuration: '4 weeks', status: ProposalStatus.ACCEPTED,
  });
  await upsertPayment('seed_order_completed', {
    gig: completed._id, milestone: completed.milestones[0]._id, client: clients[1]._id, freelancer: vikram._id,
    amount: 110000, status: PaymentStatus.RELEASED, razorpayPaymentId: 'seed_pay_completed',
    escrowedAt: daysFromNow(-25), releasedAt: daysFromNow(-6), description: 'Full project payment',
  });
  await upsertReview({
    gig: completed._id, reviewer: clients[1]._id, reviewee: vikram._id,
    categories: { quality: 5, communication: 5, timeliness: 4, professionalism: 5, value: 5 },
    comment: 'Vikram delivered a polished app ahead of schedule and was great to work with.',
  });
  await upsertReview({
    gig: completed._id, reviewer: vikram._id, reviewee: clients[1]._id,
    categories: { quality: 5, communication: 4, timeliness: 5, professionalism: 5, value: 4 },
    comment: 'Clear requirements and quick feedback. Would work with Rohan again.',
  });

  // A refunded and a disputed payment ---------------------------------------
  const cancelled = await upsertGig(clients[2], {
    title: 'Data Labelling Pipeline (cancelled)',
    description: 'Short engagement to set up a data labelling pipeline. Cancelled before work started.',
    category: 'Data Science & AI', skills: ['Python', 'Pandas'],
    budgetType: 'fixed', budgetMin: 30000, budgetMax: 40000, duration: '1 week', experienceLevel: 'entry',
    locationType: 'remote', owner: 2,
  }, { status: GigStatus.CANCELLED, selectedFreelancer: sneha._id });
  await upsertPayment('seed_order_refunded', {
    gig: cancelled._id, client: clients[2]._id, freelancer: sneha._id, amount: 35000,
    status: PaymentStatus.REFUNDED, razorpayPaymentId: 'seed_pay_refunded', escrowedAt: daysFromNow(-12),
    refundedAt: daysFromNow(-10), refundReason: 'Project cancelled before work started',
  });

  const disputedGig = await upsertGig(clients[2], {
    title: 'Kubernetes Cost Optimisation Audit',
    description: 'Audit our EKS clusters and reduce monthly cloud spend by right-sizing workloads.',
    category: 'DevOps & Cloud', skills: ['AWS', 'Kubernetes', 'Terraform'],
    budgetType: 'fixed', budgetMin: 70000, budgetMax: 90000, duration: '2 weeks', experienceLevel: 'expert',
    locationType: 'remote', owner: 2,
  }, { status: GigStatus.IN_PROGRESS, selectedFreelancer: rahul._id });
  await upsertProposal(disputedGig._id, rahul._id, {
    coverLetter: 'I have cut EKS bills by 40% for two startups.', proposedAmount: 80000,
    estimatedDuration: '2 weeks', status: ProposalStatus.ACCEPTED,
  });
  const disputedPayment = await upsertPayment('seed_order_disputed', {
    gig: disputedGig._id, client: clients[2]._id, freelancer: rahul._id, amount: 80000,
    status: PaymentStatus.DISPUTED, razorpayPaymentId: 'seed_pay_disputed', escrowedAt: daysFromNow(-8),
  });
  if (!(await Dispute.exists({ gig: disputedGig._id }))) {
    await Dispute.create({
      gig: disputedGig._id, payment: disputedPayment._id, raisedBy: clients[2]._id, against: rahul._id,
      title: 'Audit report incomplete',
      description: 'The delivered report covers only one of the three clusters agreed in the proposal.',
      status: DisputeStatus.OPEN,
    });
  }

  // A conversation so the chat page has history ------------------------------
  const participants = [clients[0]._id, arjun._id];
  let conversation = await Conversation.findOne({ participants: { $all: participants, $size: 2 }, gig: inProgress._id });
  if (!conversation) {
    conversation = await Conversation.create({ participants, gig: inProgress._id });
    const lines: [IUser, string][] = [
      [clients[0], 'Hi Arjun, milestone 1 is funded. Let me know if anything is unclear.'],
      [arjun, 'Thanks Ananya! Starting today. I will share the first screens by Friday.'],
      [clients[0], 'Sounds good 👍'],
    ];
    for (const [sender, content] of lines) {
      const message = await Message.create({
        conversation: conversation._id, sender: sender._id, content,
        readBy: participants.map((user) => ({ user, readAt: new Date() })),
      });
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;
    }
    await conversation.save();
  }

  // Derived counters ----------------------------------------------------------
  await FreelancerProfile.updateOne({ user: vikram._id }, { $set: { completedGigs: 1, totalEarnings: 99000 } });
  await ClientProfile.updateOne({ user: clients[1]._id }, { $set: { totalSpent: 110000, completedGigs: 1 } });
  for (const client of clients) {
    const [posted, active] = await Promise.all([
      Gig.countDocuments({ client: client._id }),
      Gig.countDocuments({ client: client._id, status: GigStatus.IN_PROGRESS }),
    ]);
    await ClientProfile.updateOne({ user: client._id }, { $set: { postedGigs: posted, activeGigs: active } });
  }
  for (const user of [vikram, clients[1]]) await reputationService.updateUserReputation(user._id.toString());

  console.log('\n✅ Seed complete');
  console.table([
    { role: 'admin', email: admin.email, password: shown(ADMIN_PASSWORD, 'SEED_ADMIN_PASSWORD') },
    ...clients.map((c) => ({ role: 'client', email: c.email, password: shown(DEMO_PASSWORD, 'SEED_DEMO_PASSWORD') })),
    ...freelancers.map((f) => ({ role: 'freelancer', email: f.email, password: shown(DEMO_PASSWORD, 'SEED_DEMO_PASSWORD') })),
  ]);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
