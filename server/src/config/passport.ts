import crypto from 'crypto';
import { Request } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/User';
import { IUser, UserRole } from '../types';
import { env, features } from './env';

const STATE_COOKIE = 'oauthState';
const STATE_COOKIE_PATH = '/api/v1/auth/google';

/**
 * OAuth `state` without server sessions: a random nonce goes to Google and into a short-lived
 * httpOnly cookie, and the callback must bring the same nonce back. This stops login CSRF (an
 * attacker completing the flow with their own Google account in the victim's browser).
 * SameSite=Lax is enough: Google returns with a top-level GET navigation.
 */
export const cookieStateStore = {
  store(req: Request, done: (err: Error | null, state?: string) => void): void {
    const state = crypto.randomBytes(24).toString('hex');
    req.res!.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60_000,
    });
    done(null, state);
  },
  verify(req: Request, state: string, done: (err: Error | null, ok: boolean, info?: { message: string }) => void): void {
    const expected: unknown = req.cookies?.[STATE_COOKIE];
    req.res!.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    const ok =
      typeof expected === 'string' &&
      typeof state === 'string' &&
      expected.length === state.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state));
    done(null, ok, ok ? undefined : { message: 'Google sign-in expired or was started elsewhere. Please try again.' });
  },
};

export type GoogleSignIn = { user: IUser } | { error: string };

/**
 * Finds the account for a Google profile: by googleId, else links an existing account with the
 * same email (only when Google has verified that email, so nobody can claim another person's
 * account with an unverified address), else creates one whose role is chosen on first login.
 */
export const findOrCreateGoogleUser = async (profile: Profile): Promise<GoogleSignIn> => {
  const linked = await User.findOne({ googleId: profile.id });
  if (linked) {
    linked.lastLogin = new Date();
    await linked.save();
    return { user: linked };
  }

  const email = profile.emails?.[0]?.value;
  const emailVerified = profile.emails?.[0]?.verified === true;
  if (!email) return { error: 'Your Google account has no email address' };

  const existing = await User.findOne({ email });
  if (existing) {
    if (!emailVerified) return { error: 'Verify your email with Google first, or sign in with your password' };
    existing.googleId = profile.id;
    if (!existing.avatar && profile.photos?.[0]?.value) existing.avatar = profile.photos[0].value;
    existing.isVerified = true;
    existing.lastLogin = new Date();
    await existing.save();
    return { user: existing };
  }

  // Role is chosen on first login (POST /auth/choose-role); no profile until then.
  const created = await User.create({
    googleId: profile.id,
    firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
    lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || 'Google',
    email,
    avatar: profile.photos?.[0]?.value,
    isVerified: emailVerified,
    role: UserRole.FREELANCER,
    needsRoleSelection: true,
    lastLogin: new Date(),
  });
  return { user: created };
};

/** Registers the Google strategy (stateless, JWT sessions). No-op when Google isn't configured. */
const configurePassport = (): void => {
  if (!features.google) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: env.GOOGLE_CALLBACK_URL,
        store: cookieStateStore as never,
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          const result = await findOrCreateGoogleUser(profile);
          if ('error' in result) return done(null, false, { message: result.error });
          return done(null, result.user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
};

export default configurePassport;
