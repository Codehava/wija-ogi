// PATCH  /api/families/[id]/relationships/[relId] — updateMarriageDetails (editor+)
// DELETE /api/families/[id]/relationships/[relId] — deleteRelationship (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { updateMarriageDetails, deleteRelationship } from '@/lib/services/relationships';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { UpdateMarriageDetailsSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; relId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, relId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(UpdateMarriageDetailsSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await updateMarriageDetails(id, relId, validated.data);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update relationship');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, relId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        await deleteRelationship(id, relId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete relationship');
    }
}
