/**
 * seed-gigs.js
 * ------------
 * Seeds MongoDB with 16 diverse freelance gigs.
 * Run with: node scripts/seed-gigs.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/skillsphere';

const GIGS = [
  {
    title: 'Senior React & Next.js SaaS Platform Architect',
    description: 'Looking for an expert React/Next.js developer to construct a modern multi-tenant SaaS dashboard with TailwindCSS, Redux Toolkit, and real-time WebSocket updates.',
    category: 'Web Development',
    skills: ['React', 'Next.js', 'TypeScript', 'TailwindCSS', 'Node.js'],
    budget: 5500,
    budgetMin: 4000,
    budgetMax: 6000,
    type: 'fixed',
    duration: '2 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Cross-Platform Flutter Mobile App for iOS & Android',
    description: 'We require a skilled Flutter developer to build a high-performance ecommerce mobile application integrated with Firebase backend and Stripe payment gateway.',
    category: 'Mobile Development',
    skills: ['Flutter', 'Dart', 'Mobile Dev', 'Firebase', 'REST API'],
    budget: 7800,
    budgetMin: 6000,
    budgetMax: 9000,
    type: 'fixed',
    duration: '3 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Enterprise Figma UI/UX Design System & Prototypes',
    description: 'Design a scalable dark-themed design system in Figma with 50+ component variants, mobile wireframes, and interactive prototype flows.',
    category: 'UI/UX Design',
    skills: ['UI/UX', 'Figma', 'Prototyping', 'Design Systems', 'User Research'],
    budget: 3200,
    budgetMin: 2500,
    budgetMax: 4000,
    type: 'fixed',
    duration: '1 month',
    experienceLevel: 'intermediate',
    status: 'open',
  },
  {
    title: 'Python Machine Learning Model Pipeline & Training',
    description: 'Looking for a Data Science engineer to build predictive ML algorithms using PyTorch and Pandas, deployed as a REST microservice via FastAPI.',
    category: 'Data Science & AI',
    skills: ['Python', 'PyTorch', 'Data Science', 'Pandas', 'Machine Learning'],
    budget: 95,
    budgetMin: 80,
    budgetMax: 120,
    type: 'hourly',
    duration: '6 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'AWS Kubernetes & Docker Infrastructure Automation',
    description: 'Automate containerized microservices deployment on AWS EKS using Terraform, Helm charts, and GitHub Actions CI/CD pipelines.',
    category: 'DevOps & Cloud',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
    budget: 110,
    budgetMin: 90,
    budgetMax: 130,
    type: 'hourly',
    duration: '3 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Ethereum Smart Contract Audit & DeFi DApp Development',
    description: 'Build secure ERC-20 token staking contracts in Solidity and connect them to a Web3 React frontend via Ethers.js and Hardhat.',
    category: 'Blockchain & Web3',
    skills: ['Solidity', 'Web3', 'Ethereum', 'React', 'Hardhat'],
    budget: 12000,
    budgetMin: 10000,
    budgetMax: 15000,
    type: 'fixed',
    duration: '2 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Full-Stack Node.js & GraphQL Microservices Developer',
    description: 'Refactor legacy REST backend into GraphQL microservices with Apollo Server, Node.js, TypeScript, and MongoDB Atlas.',
    category: 'Web Development',
    skills: ['Node.js', 'GraphQL', 'MongoDB', 'TypeScript', 'Express'],
    budget: 4200,
    budgetMin: 3500,
    budgetMax: 5000,
    type: 'fixed',
    duration: '1.5 months',
    experienceLevel: 'intermediate',
    status: 'open',
  },
  {
    title: 'Penetration Testing & SOC 2 Cybersecurity Audit',
    description: 'Conduct vulnerability assessment and security penetration test on enterprise cloud application. Provide detailed remediation reports for SOC 2 compliance.',
    category: 'Cyber Security',
    skills: ['Cyber Security', 'Penetration Testing', 'Python', 'Ethical Hacking', 'SOC 2'],
    budget: 6500,
    budgetMin: 5000,
    budgetMax: 8000,
    type: 'fixed',
    duration: '3 weeks',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Django & PostgreSQL E-Commerce Backend Systems',
    description: 'Develop robust e-commerce backend API using Python Django REST framework, PostgreSQL database, Redis caching, and Stripe webhook handler.',
    category: 'Web Development',
    skills: ['Python', 'Django', 'PostgreSQL', 'Redis', 'Docker'],
    budget: 3800,
    budgetMin: 3000,
    budgetMax: 4500,
    type: 'fixed',
    duration: '1 month',
    experienceLevel: 'intermediate',
    status: 'open',
  },
  {
    title: 'Vue 3 & Vite Real-Time Financial Data Analytics',
    description: 'Create ultra-fast real-time crypto charting dashboard in Vue 3, Vite, Pinia, and TailwindCSS using WebSockets feed.',
    category: 'Web Development',
    skills: ['Vue.js', 'Vite', 'TypeScript', 'Pinia', 'TailwindCSS'],
    budget: 2400,
    budgetMin: 2000,
    budgetMax: 3000,
    type: 'fixed',
    duration: '3 weeks',
    experienceLevel: 'intermediate',
    status: 'open',
  },
  {
    title: 'Native Android Kotlin Banking App Development',
    description: 'Develop native Android mobile banking application utilizing Kotlin, Jetpack Compose, Clean Architecture, and biometric security features.',
    category: 'Mobile Development',
    skills: ['Android', 'Kotlin', 'Mobile Dev', 'Jetpack Compose', 'REST API'],
    budget: 85,
    budgetMin: 70,
    budgetMax: 100,
    type: 'hourly',
    duration: '4 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'OpenAI GPT-4 LLM & LangChain Chatbot Integration',
    description: 'Integrate custom LLM agent using LangChain, OpenAI API, and Vector Database (Pinecone) into an existing React customer portal.',
    category: 'Data Science & AI',
    skills: ['Python', 'LangChain', 'OpenAI API', 'Node.js', 'React'],
    budget: 4500,
    budgetMin: 3500,
    budgetMax: 5500,
    type: 'fixed',
    duration: '1 month',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'React Native Telehealth Booking & Video Call App',
    description: 'Build cross-platform React Native app for doctor consultations with WebRTC video calling, appointment booking, and encrypted chat.',
    category: 'Mobile Development',
    skills: ['React Native', 'TypeScript', 'Redux', 'Mobile Dev', 'Node.js'],
    budget: 6200,
    budgetMin: 5000,
    budgetMax: 7500,
    type: 'fixed',
    duration: '2 months',
    experienceLevel: 'intermediate',
    status: 'open',
  },
  {
    title: 'Golang High-Throughput Microservice API Service',
    description: 'Build lightweight high-performance REST and gRPC API in Go with PostgreSQL for handling over 50,000 requests per second.',
    category: 'Web Development',
    skills: ['Go', 'Golang', 'gRPC', 'PostgreSQL', 'Docker'],
    budget: 120,
    budgetMin: 100,
    budgetMax: 150,
    type: 'hourly',
    duration: '3 months',
    experienceLevel: 'expert',
    status: 'open',
  },
  {
    title: 'Figma Brand Guidelines & Webflow Marketing Website',
    description: 'Craft fresh brand assets, logo redesign, design system, and implement high-converting landing pages inside Webflow.',
    category: 'UI/UX Design',
    skills: ['UI/UX', 'Figma', 'Webflow', 'Graphic Design', 'Branding'],
    budget: 1800,
    budgetMin: 1500,
    budgetMax: 2500,
    type: 'fixed',
    duration: '2 weeks',
    experienceLevel: 'entry',
    status: 'open',
  },
  {
    title: 'Angular 17 Enterprise ERP Dashboard Modules',
    description: 'Build enterprise inventory management frontend using Angular 17, RxJS, NgRx state management, and AG-Grid data tables.',
    category: 'Web Development',
    skills: ['Angular', 'TypeScript', 'RxJS', 'NgRx', 'Bootstrap'],
    budget: 65,
    budgetMin: 50,
    budgetMax: 80,
    type: 'hourly',
    duration: '5 months',
    experienceLevel: 'intermediate',
    status: 'open',
  }
];

async function run() {
  try {
    console.log('🔗 Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log(`✅ Connected: ${mongoose.connection.host}`);

    const userSchema = new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: String,
      role: String,
    });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    const adminUser = await User.findOne({ role: 'admin' });

    const gigSchema = new mongoose.Schema(
      {
        title: String,
        description: String,
        category: String,
        skills: [String],
        budget: Number,
        budgetMin: Number,
        budgetMax: Number,
        type: String,
        duration: String,
        experienceLevel: String,
        status: String,
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      { timestamps: true }
    );

    const Gig = mongoose.models.Gig || mongoose.model('Gig', gigSchema);

    await Gig.deleteMany({});
    console.log('🗑️ Deleted existing gigs.');

    const gigsToInsert = GIGS.map(g => ({
      ...g,
      client: adminUser ? adminUser._id : new mongoose.Types.ObjectId(),
    }));

    await Gig.insertMany(gigsToInsert);
    console.log(`🎉 Successfully seeded ${gigsToInsert.length} gigs into MongoDB Atlas!`);
  } catch (err) {
    console.error('❌ Error seeding gigs:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
