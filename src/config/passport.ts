import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateUser } from '../services/authService.js';
import { requireEnv } from './env.js';
import { AuthProvider } from '@prisma/client';

export function registerPassportStrategies() {
    passport.use(new GoogleStrategy({
        clientID: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        callbackURL: requireEnv('GOOGLE_CALLBACK_URL')
    },
        async (_accessToken: any, _refreshToken: any, profile: any, done: any) => {
            try {
                const user = await findOrCreateUser({
                    provider: AuthProvider.GOOGLE,
                    providerId: profile.id,
                    email: profile.emails[0].value,
                    username: profile.displayName,
                    profileImageUrl: profile.photos?.[0]?.value ?? null
                });

                return done(null, { id: user.id });
            }
            catch (error) {
                return done(error, null);
            }
        }
    ));
}
