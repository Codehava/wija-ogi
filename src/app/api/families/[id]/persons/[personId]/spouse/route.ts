// POST /api/families/[id]/persons/[personId]/spouse — addSpouse (editor+)
// DELETE /api/families/[id]/persons/[personId]/spouse — removeSpouse (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { addSpouse, removeSpouse } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { SpouseLinkSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(SpouseLinkSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await addSpouse(id, personId, validated.data.person2Id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to add spouse');
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(SpouseLinkSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await removeSpouse(id, personId, validated.data.person2Id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to remove spouse');
    }
}
