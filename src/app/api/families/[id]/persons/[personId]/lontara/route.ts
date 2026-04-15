// PATCH /api/families/[id]/persons/[personId]/lontara — setCustomLontaraName (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { setCustomLontaraName } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { UpdateLontaraNameSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(UpdateLontaraNameSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await setCustomLontaraName(id, personId, validated.data);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update Lontara name');
    }
}
