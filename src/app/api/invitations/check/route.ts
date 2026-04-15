// POST /api/invitations/check — isEmailAlreadyInvited (admin+ on family)

import { NextRequest, NextResponse } from 'next/server';
import { isEmailAlreadyInvited } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { CheckInvitationSchema, validateInput } from '@/lib/validation';

export async function POST(request: NextRequest) {
    try {
        const raw = await request.json();
        const validated = validateInput(CheckInvitationSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const authResult = await requireRole(validated.data.familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        const isInvited = await isEmailAlreadyInvited(validated.data.familyId, validated.data.email);
        return NextResponse.json({ isInvited });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to check invitation');
    }
}
