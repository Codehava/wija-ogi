// POST /api/invitations — createInvitation (admin+ of the target family)

import { NextRequest, NextResponse } from 'next/server';
import { createInvitation } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { getFamily } from '@/lib/services/families';
import { CreateInvitationSchema, validateInput } from '@/lib/validation';

export async function POST(request: NextRequest) {
    try {
        const raw = await request.json();
        const validated = validateInput(CreateInvitationSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        // C2 FIX: Caller must be admin+ of the target family
        const authResult = await requireRole(validated.data.familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        const family = await getFamily(validated.data.familyId);
        if (!family) {
            return NextResponse.json({ error: 'Family not found' }, { status: 404 });
        }

        const invitation = await createInvitation({
            familyId: validated.data.familyId,
            familyName: family.displayName || family.name,
            email: validated.data.email,
            role: validated.data.role,
            invitedBy: authResult.userId,
            invitedByName: authResult.userName,
        });
        return NextResponse.json(invitation, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create invitation');
    }
}
