// POST   /api/families/[id]/persons/[personId]/children — addParentChild (editor+)
// DELETE /api/families/[id]/persons/[personId]/children — removeParentChild (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { addParentChild, removeParentChild } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { ParentChildLinkSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(ParentChildLinkSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await addParentChild(id, personId, validated.data.childId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to add parent-child relationship');
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(ParentChildLinkSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        await removeParentChild(id, personId, validated.data.childId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to remove parent-child relationship');
    }
}
