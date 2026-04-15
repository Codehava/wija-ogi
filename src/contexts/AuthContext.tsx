// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Auth Context Provider (NextAuth.js)
// Replaces Firebase Auth context with NextAuth session
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { createContext, useContext, useCallback, useState } from 'react';
import { SessionProvider, useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import type { UserProfile, MemberRole } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

interface AuthContextValue {
    // State
    user: AuthUser | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;

    // Auth methods
    signIn: (email: string, password: string) => Promise<void>;
    signInGoogle: () => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signOut: () => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;

    // Helper methods
    isAuthenticated: boolean;
    hasRole: (familyId: string, roles: MemberRole[]) => Promise<boolean>;
    clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthProviderProps {
    children: React.ReactNode;
}

function AuthProviderInner({ children }: AuthProviderProps) {
    const { data: session, status, update } = useSession();
    const [error, setError] = useState<string | null>(null);

    const loading = status === 'loading';

    // Map NextAuth session to AuthUser
    const user: AuthUser | null = session?.user
        ? {
            uid: session.user.id || '',
            email: session.user.email || null,
            displayName: session.user.name || null,
            photoURL: session.user.image || null,
        }
        : null;

    // Build user profile from session
    const userProfile: UserProfile | null = session?.user
        ? {
            userId: session.user.id || '',
            email: session.user.email || '',
            displayName: session.user.name || '',
            photoUrl: session.user.image || undefined,
            preferredScript: 'both',
            preferredTheme: 'klasik',
            preferredLanguage: 'id',
            familyIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        : null;

    // Auth methods
    const signIn = useCallback(async (email: string, password: string) => {
        try {
            setError(null);
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                action: 'login',
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
                throw new Error(result.error);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to sign in';
            setError(message);
            throw err;
        }
    }, []);

    const signInGoogle = useCallback(async () => {
        try {
            setError(null);
            await nextAuthSignIn('google', { callbackUrl: '/' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
            setError(message);
            throw err;
        }
    }, []);

    const signUp = useCallback(async (email: string, password: string, displayName: string) => {
        try {
            setError(null);
            const result = await nextAuthSignIn('credentials', {
                email,
                password,
                name: displayName,
                action: 'register',
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
                throw new Error(result.error);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to sign up';
            setError(message);
            throw err;
        }
    }, []);

    const handleSignOut = useCallback(async () => {
        try {
            setError(null);
            await nextAuthSignOut({ redirect: false });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to sign out';
            setError(message);
            throw err;
        }
    }, []);

    const forgotPassword = useCallback(async (email: string) => {
        try {
            setError(null);
            const response = await fetch('/api/user/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({ error: 'Failed to request password reset' }));
                throw new Error(body.error || 'Failed to request password reset');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to request password reset';
            setError(message);
            throw err;
        }
    }, []);

    const handleUpdateProfile = useCallback(async (updates: { displayName?: string; photoURL?: string }) => {
        try {
            if (!user?.uid) {
                throw new Error('Unauthorized');
            }
            setError(null);

            const response = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({ error: 'Failed to update profile' }));
                throw new Error(body.error || 'Failed to update profile');
            }

            const result = await response.json();
            await update({
                user: {
                    ...session?.user,
                    name: result.displayName ?? session?.user?.name,
                    image: result.photoURL ?? session?.user?.image,
                },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update profile';
            setError(message);
            throw err;
        }
    }, [session?.user, update, user?.uid]);

    const hasRole = useCallback(async (familyId: string, roles: MemberRole[]): Promise<boolean> => {
        if (!user?.uid) return false;

        try {
            const response = await fetch(`/api/families/${familyId}/role`);
            if (!response.ok) return false;
            const data = await response.json();
            return roles.includes(data.role);
        } catch {
            return false;
        }
    }, [user?.uid]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value: AuthContextValue = {
        user,
        userProfile,
        loading,
        error,
        signIn,
        signInGoogle,
        signUp,
        signOut: handleSignOut,
        forgotPassword,
        updateProfile: handleUpdateProfile,
        isAuthenticated: user !== null,
        hasRole,
        clearError,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: AuthProviderProps) {
    return (
        <SessionProvider>
            <AuthProviderInner>{children}</AuthProviderInner>
        </SessionProvider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────────

export function useAuth() {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}

export default AuthContext;
