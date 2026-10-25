import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/User';
import { UserRole } from '../types';

const configurePassport = (): void => {
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
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
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

          const newUser = await User.create({
            googleId: profile.id,
            firstName: profile.name?.givenName || 'User',
            lastName: profile.name?.familyName || '',
            email: profile.emails?.[0]?.value,
            avatar: profile.photos?.[0]?.value,
            isVerified: true,
            role: UserRole.FREELANCER,
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
