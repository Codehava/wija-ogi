// PATCH  /api/families/[id]/members/[userId] — updateMemberRole (admin+)
// DELETE /api/families/[id]/members/[userId] — removeFamilyMember (admin+)

import { NextRequest, NextResponse } from 'next/server';
import { updateMemberRole, removeFamilyMember, getUserRole } from '@/lib/services/families';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { UpdateMemberRoleSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, userId } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(UpdateMemberRoleSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const targetRole = await getUserRole(id, userId);
        if (!targetRole) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        if (targetRole === 'owner' || targetRole === 'superadmin') {
            return NextResponse.json({ error: 'Owner role cannot be changed from this endpoint' }, { status: 403 });
        }

        await updateMemberRole(id, userId, validated.data.role);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === 'Member not found') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return safeErrorResponse(error, 'Failed to update member role');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, userId } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        if (userId === authResult.userId) {
            return NextResponse.json({ error: 'Cannot remove your own account from family' }, { status: 403 });
        }

        const targetRole = await getUserRole(id, userId);
        if (!targetRole) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        if (targetRole === 'owner' || targetRole === 'superadmin') {
            return NextResponse.json({ error: 'Owner account cannot be removed from this endpoint' }, { status: 403 });
        }

        await removeFamilyMember(id, userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === 'Member not found') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return safeErrorResponse(error, 'Failed to remove member');
    }
}
