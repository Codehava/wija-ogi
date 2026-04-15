import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { applyRateLimit, safeErrorResponse } from '@/lib/apiHelpers';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { ForgotPasswordSchema, validateInput } from '@/lib/validation';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
    try {
        const rateLimited = applyRateLimit(request, RATE_LIMITS.AUTH);
        if (rateLimited) return rateLimited;

        const raw = await request.json();
        const validated = validateInput(ForgotPasswordSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const email = validated.data.email.toLowerCase().trim();
        const [user] = await db
            .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (user?.passwordHash) {
            const token = randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

            await db
                .delete(verificationTokens)
                .where(eq(verificationTokens.identifier, email));

            await db
                .insert(verificationTokens)
                .values({
                    identifier: email,
                    token,
                    expires,
                });

            if (process.env.NODE_ENV !== 'production') {
                console.info(`[forgot-password] reset token generated for ${email}: ${token}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'If the account exists, password reset instructions have been generated.',
        });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to process password reset request');
    }
}
