import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { safeErrorResponse } from '@/lib/apiHelpers';

export async function GET(_req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const email = session.user.email?.toLowerCase().trim();
        const superAdminEmails = (process.env.SUPERADMIN_EMAILS || '')
            .split(',')
            .map((item) => item.toLowerCase().trim())
            .filter(Boolean);

        const isSuperAdmin = !!email && superAdminEmails.includes(email);
        return NextResponse.json({ isSuperAdmin });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to check superadmin role');
    }
}
