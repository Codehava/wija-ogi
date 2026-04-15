// GET    /api/families/[id]  — getFamily
// PATCH  /api/families/[id]  — updateFamily (admin+)
// DELETE /api/families/[id]  — deleteFamily (owner only)

import { NextRequest, NextResponse } from 'next/server';
import { getFamily, updateFamily, deleteFamily } from '@/lib/services/families';
import { safeErrorResponse, requireRole, requireMember } from '@/lib/apiHelpers';
import { UpdateFamilySchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireMember(id);
        if (!authResult.ok) return authResult.response;

        const family = await getFamily(id);
        if (!family) {
            return NextResponse.json({ error: 'Family not found' }, { status: 404 });
        }
        return NextResponse.json(family);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load family');
    }
}

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(UpdateFamilySchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await updateFamily(id, validated.data);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update family');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'owner');
        if (!authResult.ok) return authResult.response;

        await deleteFamily(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete family');
    }
}
