// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Invitation Service (Drizzle ORM / PostgreSQL)
// Replaces Firestore-based invitation system
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { invitations, treeMembers, trees } from '@/db/schema';
import { sql } from 'drizzle-orm';
import type { Invitation, MemberRole } from '@/types';

const ALLOWED_INVITATION_ROLES = ['admin', 'editor', 'viewer'] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────────

function dbToInvitation(row: typeof invitations.$inferSelect): Invitation {
    return {
        invitationId: row.id,
        familyId: row.treeId,
        familyName: row.treeName || '',
        email: row.email,
        role: row.role as MemberRole,
        invitedBy: row.invitedBy || '',
        invitedByName: row.invitedByName || '',
        status: row.status as Invitation['status'],
        expiresAt: row.expiresAt ?? new Date(),
        createdAt: row.createdAt ?? new Date(),
        respondedAt: row.respondedAt ?? undefined,
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE INVITATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface CreateInvitationInput {
    familyId: string;
    familyName: string;
    email: string;
    role: MemberRole;
    invitedBy: string;
    invitedByName: string;
    expiresInDays?: number;
}

export async function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
    if (!ALLOWED_INVITATION_ROLES.includes(input.role as typeof ALLOWED_INVITATION_ROLES[number])) {
        throw new Error('Invalid invitation role');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays || 7));

    const [row] = await db
        .insert(invitations)
        .values({
            treeId: input.familyId,
            treeName: input.familyName,
            email: input.email.toLowerCase().trim(),
            role: input.role,
            invitedBy: input.invitedBy,
            invitedByName: input.invitedByName,
            status: 'pending',
            expiresAt,
        })
        .returning();

    return dbToInvitation(row);
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

export async function getInvitation(invitationId: string): Promise<Invitation | null> {
    const [row] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, invitationId))
        .limit(1);

    return row ? dbToInvitation(row) : null;
}

export async function getPendingInvitationsForEmail(email: string): Promise<Invitation[]> {
    const rows = await db
        .select()
        .from(invitations)
        .where(
            and(
                eq(invitations.email, email.toLowerCase().trim()),
                eq(invitations.status, 'pending')
            )
        );

    return rows.map(dbToInvitation);
}

export async function getInvitationsForFamily(familyId: string): Promise<Invitation[]> {
    const rows = await db
        .select()
        .from(invitations)
        .where(eq(invitations.treeId, familyId));

    return rows.map(dbToInvitation);
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACCEPT / DECLINE / REVOKE
// ─────────────────────────────────────────────────────────────────────────────────

export async function acceptInvitation(
    invitationId: string,
    userId: string,
    userDisplayName: string,
    userEmail: string,
    _userPhotoUrl?: string
): Promise<void> {
    await db.transaction(async (tx) => {
        const [invitationRow] = await tx
            .select()
            .from(invitations)
            .where(eq(invitations.id, invitationId))
            .limit(1);

        if (!invitationRow) throw new Error('Invitation not found');
        const invitation = dbToInvitation(invitationRow);
        if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw new Error('Invitation email does not match authenticated user');
        }

        // Idempotent accept: if already accepted, treat as success.
        if (invitation.status === 'accepted') {
            return;
        }
        if (invitation.status !== 'pending') {
            throw new Error('Invitation is no longer valid');
        }

        const expiresDate = invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt);
        if (expiresDate < new Date()) {
            await tx
                .update(invitations)
                .set({ status: 'expired' })
                .where(eq(invitations.id, invitationId));
            throw new Error('Invitation has expired');
        }

        if (!ALLOWED_INVITATION_ROLES.includes(invitation.role as typeof ALLOWED_INVITATION_ROLES[number])) {
            throw new Error('Invitation role is invalid');
        }

        const inserted = await tx
            .insert(treeMembers)
            .values({
                treeId: invitation.familyId,
                userId,
                role: invitation.role,
                displayName: userDisplayName,
                invitedBy: invitation.invitedBy,
            })
            .onConflictDoNothing({
                target: [treeMembers.treeId, treeMembers.userId],
            })
            .returning({ id: treeMembers.id });

        // Only increment count for a new membership row.
        if (inserted.length > 0) {
            await tx
                .update(trees)
                .set({
                    memberCount: sql`${trees.memberCount} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(trees.id, invitation.familyId));
        }

        await tx
            .update(invitations)
            .set({ status: 'accepted', respondedAt: new Date() })
            .where(eq(invitations.id, invitationId));
    });
}

export async function declineInvitation(invitationId: string): Promise<void> {
    await db
        .update(invitations)
        .set({ status: 'declined', respondedAt: new Date() })
        .where(eq(invitations.id, invitationId));
}

export async function revokeInvitation(invitationId: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.id, invitationId));
}

export async function resendInvitation(invitationId: string): Promise<void> {
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    await db
        .update(invitations)
        .set({ status: 'pending', expiresAt: newExpiresAt })
        .where(eq(invitations.id, invitationId));
}

export async function isEmailAlreadyInvited(familyId: string, email: string): Promise<boolean> {
    const [row] = await db
        .select()
        .from(invitations)
        .where(
            and(
                eq(invitations.treeId, familyId),
                eq(invitations.email, email.toLowerCase().trim()),
                eq(invitations.status, 'pending')
            )
        )
        .limit(1);

    return !!row;
}

const invitationService = {
    createInvitation,
    getInvitation,
    getPendingInvitationsForEmail,
    getInvitationsForFamily,
    acceptInvitation,
    declineInvitation,
    revokeInvitation,
    resendInvitation,
    isEmailAlreadyInvited,
};

export default invitationService;
