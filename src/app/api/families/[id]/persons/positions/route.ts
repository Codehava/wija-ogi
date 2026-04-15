// PUT /api/families/[id]/persons/positions — updateAllPersonPositions

import { NextRequest, NextResponse } from 'next/server';
import { updateAllPersonPositions } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';
import { BatchPositionsSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(BatchPositionsSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        // Convert plain object to Map
        const posMap = new Map<string, { x: number; y: number }>(
            Object.entries(validated.data.positions)
        );
        await updateAllPersonPositions(id, posMap);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update positions');
    }
}
