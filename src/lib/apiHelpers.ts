// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - API Error, Rate Limit & RBAC Helpers
// Centralized utilities for safe error responses, rate limiting, and role checks
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, type RateLimitConfig } from '@/lib/rateLimit';
import { auth } from '@/auth';
import { getUserRole } from '@/lib/services/families';
import type { MemberRole } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// RBAC — Role hierarchy and enforcement
// ─────────────────────────────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<MemberRole, number> = {
    superadmin: 5,
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1,
};

type AuthResult =
    | { ok: true; userId: string; role: MemberRole; userName: string; userEmail: string | null }
    | { ok: false; response: NextResponse };

/**
 * Check session + family membership + minimum role.
 * Returns { ok: true, userId, role } or { ok: false, response } (401/403).
 */
export async function requireRole(
    familyId: string,
    minimumRole: MemberRole = 'viewer'
): Promise<AuthResult> {
    const session = await auth();
    if (!session?.user?.id) {
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const role = await getUserRole(familyId, session.user.id);
    if (!role) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minimumRole]) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: `Requires ${minimumRole} role or higher` },
                { status: 403 }
            ),
        };
    }

    return {
        ok: true,
        userId: session.user.id,
        role,
        userName: session.user.name || session.user.email || session.user.id,
        userEmail: session.user.email || null,
    };
}

/**
 * Shortcut: require at least viewer (i.e. any family member).
 */
export async function requireMember(familyId: string): Promise<AuthResult> {
    return requireRole(familyId, 'viewer');
}

/**
 * M4 FIX: Return a safe error response that never leaks internal details.
 * In development, includes the full error message for debugging.
 */
export function safeErrorResponse(
    error: unknown,
    fallbackMessage: string = 'Internal server error',
    status: number = 500
): NextResponse {
    const isDev = process.env.NODE_ENV === 'development';
    const message = isDev && error instanceof Error ? error.message : fallbackMessage;

    // Always log the full error server-side
    if (error instanceof Error) {
        console.error(`[API Error] ${fallbackMessage}:`, error.message);
    }

    return NextResponse.json({ error: message }, { status });
}

/**
 * Apply rate limiting to a request. Returns a 429 response if limit exceeded.
 * Returns null if the request is within limits (proceed normally).
 */
export function applyRateLimit(
    request: Request,
    config: RateLimitConfig,
    identifier?: string
): NextResponse | null {
    const key = getRateLimitKey(request, identifier);
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.resetIn),
                    'X-RateLimit-Limit': String(config.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(result.resetIn),
                },
            }
        );
    }

    return null;
}
