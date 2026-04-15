import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { safeErrorResponse } from '@/lib/apiHelpers';
import { UpdateUserProfileSchema, validateInput } from '@/lib/validation';

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const raw = await request.json();
        const validated = validateInput(UpdateUserProfileSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }

        const updateData: Partial<typeof users.$inferInsert> = {
            updatedAt: new Date(),
        };
        if (validated.data.displayName !== undefined) {
            updateData.name = validated.data.displayName;
        }
        if (validated.data.photoURL !== undefined) {
            updateData.image = validated.data.photoURL;
        }

        const [updated] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, session.user.id))
            .returning({ name: users.name, image: users.image });

        if (!updated) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            displayName: updated.name || '',
            photoURL: updated.image || '',
        });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update profile');
    }
}
