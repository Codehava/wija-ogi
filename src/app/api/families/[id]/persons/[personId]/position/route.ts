// PATCH /api/families/[id]/persons/[personId]/position — updatePersonPosition (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { updatePersonPosition } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { PositionSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(PositionSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await updatePersonPosition(id, personId, validated.data);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update position');
    }
}
