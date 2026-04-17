// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Next.js Middleware
// Route Protection & Rate limiting for auth endpoints and write operations
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rateLimit';

const protectedPaths = ['/api/user', '/api/families', '/api/invitations', '/api/gedcom', '/family', '/tree'];

export default auth((request) => {
    const { pathname } = request.nextUrl;

    // ─── Route Protection ────────────────────────────────────────────────
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    if (isProtectedPath && !request.auth) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/api/auth/signin', request.url));
    }

    // ─── Rate limit auth endpoints (login/register): 10 per minute ───────
    // EXCLUDE callback routes — these are OAuth return flows, not login attempts
    if (pathname.startsWith('/api/auth') && !pathname.startsWith('/api/auth/callback')) {
        const key = getRateLimitKey(request as any);
        const result = checkRateLimit(key, RATE_LIMITS.AUTH);

        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(result.resetIn),
                        'X-RateLimit-Limit': String(RATE_LIMITS.AUTH.limit),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(result.resetIn),
                    },
                }
            );
        }
    }

    // ─── Rate limit write endpoints (POST/PUT/PATCH/DELETE): 30 per minute
    if (
        pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/auth') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
        const key = getRateLimitKey(request as any);
        const result = checkRateLimit(key, RATE_LIMITS.WRITE);

        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(result.resetIn),
                    },
                }
            );
        }
    }

    return NextResponse.next();
});

export const config = {
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - images (public directory assets)
    matcher: ['/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
