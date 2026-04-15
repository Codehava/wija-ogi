// GET  /api/families/[id]/relationships — getAllRelationships (viewer+)
// POST /api/families/[id]/relationships — createRelationship (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { getAllRelationships, createRelationship } from '@/lib/services/relationships';
import { safeErrorResponse, requireRole, requireMember } from '@/lib/apiHelpers';
import { CreateRelationshipSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireMember(id);
        if (!authResult.ok) return authResult.response;

        const relationships = await getAllRelationships(id);
        return NextResponse.json(relationships);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load relationships');
    }
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const raw = await request.json();
        const validated = validateInput(CreateRelationshipSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const relationship = await createRelationship(id, validated.data);
        return NextResponse.json(relationship, { status: 201 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('sudah ada')) {
                return NextResponse.json({ error: error.message }, { status: 409 });
            }
            if (error.message.includes('tidak valid')) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }
        }
        return safeErrorResponse(error, 'Failed to create relationship');
    }
}
