import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, verificationTokens } from '@/db/schema';
import { applyRateLimit, safeErrorResponse } from '@/lib/apiHelpers';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { ResetPasswordSchema, validateInput } from '@/lib/validation';

const BCRYPT_ROUNDS = 12;

export async function POST(request: NextRequest) {
    try {
        const rateLimited = applyRateLimit(request, RATE_LIMITS.AUTH);
        if (rateLimited) return rateLimited;

        const raw = await request.json();
        const validated = validateInput(ResetPasswordSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const [tokenRow] = await db
            .select()
            .from(verificationTokens)
            .where(eq(verificationTokens.token, validated.data.token))
            .limit(1);

        if (!tokenRow || (tokenRow.expires && tokenRow.expires < new Date())) {
            return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(validated.data.newPassword, BCRYPT_ROUNDS);

        const updated = await db
            .update(users)
            .set({ passwordHash, updatedAt: new Date() })
            .where(eq(users.email, tokenRow.identifier))
            .returning({ id: users.id });

        await db
            .delete(verificationTokens)
            .where(
                and(
                    eq(verificationTokens.identifier, tokenRow.identifier),
                    eq(verificationTokens.token, tokenRow.token)
                )
            );

        if (updated.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to reset password');
    }
}
