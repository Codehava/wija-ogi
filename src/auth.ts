// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - NextAuth.js v5 Configuration
// Supports: Google OAuth + Email/Password (Credentials)
// Uses JWT strategy — no database adapter needed for session management
// ═══════════════════════════════════════════════════════════════════════════════

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

// Password hashing using bcrypt (salted, slow-by-design)
async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    // bcrypt hashes start with "$2a$" or "$2b$"
    if (hash.startsWith('$2')) {
        return bcrypt.compare(password, hash);
    }
    // Legacy SHA-256 migration: verify old hash, then rehash with bcrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256Hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return sha256Hash === hash;
}

const credentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    action: z.enum(['login', 'register']).optional().default('login'),
    name: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
    // No adapter — we handle user creation manually in signIn callback
    // This avoids table name/column mismatches with DrizzleAdapter
    trustHost: true,
    session: {
        strategy: 'jwt',
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                action: { label: 'Action', type: 'text' },
                name: { label: 'Name', type: 'text' },
            },
            async authorize(credentials) {
                const parsed = credentialsSchema.safeParse(credentials);
                if (!parsed.success) return null;

                const { email, password, action, name } = parsed.data;

                if (action === 'register') {
                    // Check if user already exists
                    const existing = await db
                        .select()
                        .from(users)
                        .where(eq(users.email, email))
                        .limit(1);

                    if (existing.length > 0) {
                        throw new Error('Email sudah terdaftar');
                    }

                    const passwordHash = await hashPassword(password);
                    const [newUser] = await db
                        .insert(users)
                        .values({
                            email,
                            name: name || email.split('@')[0],
                            passwordHash,
                        })
                        .returning();

                    return {
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name,
                        image: newUser.image,
                    };
                }

                // Login
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email))
                    .limit(1);

                if (!user || !user.passwordHash) return null;

                const isValid = await verifyPassword(password, user.passwordHash);
                if (!isValid) return null;

                // Auto-migrate legacy SHA-256 hash to bcrypt on successful login
                if (!user.passwordHash.startsWith('$2')) {
                    const bcryptHash = await hashPassword(password);
                    await db.update(users).set({ passwordHash: bcryptHash }).where(eq(users.id, user.id));
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            // Handle Google OAuth: find or create user in our DB
            if (account?.provider === 'google' && user.email) {
                try {
                    const [existingUser] = await db
                        .select()
                        .from(users)
                        .where(eq(users.email, user.email))
                        .limit(1);

                    if (existingUser) {
                        // Update existing user with Google profile info
                        await db
                            .update(users)
                            .set({
                                name: user.name || existingUser.name,
                                image: user.image || existingUser.image,
                                updatedAt: new Date(),
                            })
                            .where(eq(users.id, existingUser.id));
                        // Overwrite the OAuth user.id with our DB user.id
                        user.id = existingUser.id;
                    } else {
                        // Create new user from Google profile
                        const [newUser] = await db
                            .insert(users)
                            .values({
                                email: user.email,
                                name: user.name || user.email.split('@')[0],
                                image: user.image,
                                emailVerified: new Date(),
                            })
                            .returning();
                        user.id = newUser.id;
                    }
                } catch (error) {
                    console.error('[auth] Error in Google signIn callback:', error);
                    console.error('[auth] DATABASE_URL set:', !!process.env.DATABASE_URL);
                    // Allow sign-in even if DB is unreachable — JWT session still works
                    // User will be created in DB on next successful connection
                    return true;
                }
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.picture = user.image;
            }

            if (trigger === 'update' && session?.user) {
                if (session.user.name !== undefined) {
                    token.name = session.user.name;
                }
                if (session.user.image !== undefined) {
                    token.picture = session.user.image;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
            }
            if (typeof token?.name === 'string') {
                session.user.name = token.name;
            }
            if (typeof token?.picture === 'string' || token?.picture === null) {
                session.user.image = token.picture as string | null;
            }
            return session;
        },
    },
});
