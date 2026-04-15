// POST /api/invitations/[id]/accept — acceptInvitation
// M2 FIX: Verifies invitee email matches authenticated user's email

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { acceptInvitation, getInvitation } from '@/lib/services/invitations';
import { applyRateLimit, safeErrorResponse } from '@/lib/apiHelpers';
import { RATE_LIMITS } from '@/lib/rateLimit';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const rateLimited = applyRateLimit(request, RATE_LIMITS.AUTH);
        if (rateLimited) return rateLimited;

        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;

        // M2 FIX: Verify the invitation email matches the accepting user
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
            return NextResponse.json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
        }

        await acceptInvitation(
            id,
            session.user.id,
            session.user.name || '',
            session.user.email || '',
            session.user.image || ''
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message === 'Invitation not found') {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            if (
                error.message === 'Invitation has expired' ||
                error.message === 'Invitation is no longer valid' ||
                error.message === 'Invitation role is invalid'
            ) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
            if (error.message === 'Invitation email does not match authenticated user') {
                return NextResponse.json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
            }
        }
        return safeErrorResponse(error, 'Failed to accept invitation');
    }
}
