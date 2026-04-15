// PATCH  /api/families/[id]/persons/[personId]  — updatePerson (editor+)
// DELETE /api/families/[id]/persons/[personId]  — deletePerson (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { updatePerson, deletePerson } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { UpdatePersonSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(UpdatePersonSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await updatePerson(id, personId, validated.data, authResult.userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update person');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        await deletePerson(id, personId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete person');
    }
}
