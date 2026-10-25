import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/User';
import { UserRole } from '../types';
import { env, features } from './env';

/** Registers the Google strategy (stateless, JWT sessions). No-op when Google isn't configured. */
const configurePassport = (): void => {
  if (!features.google) return;

  passport.serializeUser((user: Express.User, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done
      ) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            user.lastLogin = new Date();
            await user.save();
            return done(null, user);
          }

          user = await User.findOne({
            email: profile.emails?.[0]?.value,
          });

          if (user) {
            user.googleId = profile.id;
            if (!user.avatar && profile.photos?.[0]?.value) {
              user.avatar = profile.photos[0].value;
            }
            user.isVerified = true;
            user.lastLogin = new Date();
            await user.save();
            return done(null, user);
          }

          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('Google account has no email'), undefined);

          // Role is chosen on first login (POST /auth/choose-role); no profile until then.
          const newUser = await User.create({
            googleId: profile.id,
            firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
            lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || 'Google',
            email,
            avatar: profile.photos?.[0]?.value,
            isVerified: true,
            role: UserRole.FREELANCER,
            needsRoleSelection: true,
            lastLogin: new Date(),
          });

          return done(null, newUser);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
};

export default configurePassport;
