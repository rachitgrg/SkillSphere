/**
 * seed-admin.js
 * -------------
 * Drops ALL existing users from the database and creates one admin user.
 * Run with:  node scripts/seed-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/skillsphere';

// ─── Admin credentials (change as needed) ───────────────────────────────────
const ADMIN = {
  firstName: 'Rachit',
  lastName: 'Garg',
  email: 'admin@skillsphere.com',
  password: 'Admin@1234',   // min 8 chars – change after first login
  role: 'admin',
  isVerified: true,
  isActive: true,
  isBanned: false,
};
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    firstName:  { type: String, required: true, trim: true },
    lastName:   { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:   { type: String, select: false },
    avatar:     { type: String, default: '' },
    role:       { type: String, enum: ['client', 'freelancer', 'admin'], default: 'freelancer' },
    isVerified: { type: Boolean, default: false },
    isActive:   { type: Boolean, default: true },
    isBanned:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

async function run() {
  try {
    console.log('🔗  Connecting to MongoDB…');
    await mongoose.connect(MONGO_URI);
    console.log(`✅  Connected: ${mongoose.connection.host}`);

    // 1. Delete every user
    const { deletedCount } = await User.deleteMany({});
    console.log(`🗑️   Deleted ${deletedCount} existing user(s).`);

    // 2. Hash password manually (no pre-save hook needed)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(ADMIN.password, salt);

    // 3. Insert admin directly
    await User.create({
      ...ADMIN,
      password: hashedPassword,
    });

    console.log('\n🎉  Admin user created successfully!');
    console.log('─────────────────────────────────────');
    console.log(`   Email    : ${ADMIN.email}`);
    console.log(`   Password : ${ADMIN.password}`);
    console.log(`   Role     : ${ADMIN.role}`);
    console.log('─────────────────────────────────────\n');
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB.');
    process.exit(0);
  }
}

run();
