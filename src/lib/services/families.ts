// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Families (Trees) Service (Drizzle ORM / PostgreSQL)
// Replaces Firestore CRUD for Family/Tree documents
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db';
import { trees, treeMembers } from '@/db/schema';
import type { Family, CreateFamilyInput, FamilyMember, MemberRole } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Map DB row → Family type
// ─────────────────────────────────────────────────────────────────────────────────

function dbToFamily(row: typeof trees.$inferSelect): Family {
    return {
        familyId: row.id,
        name: row.name,
        displayName: row.displayName || row.name,
        slug: row.slug || '',
        ownerId: row.ownerId || '',
        rootAncestorId: row.rootAncestorId ?? undefined,
        subscription: {
            plan: (row.plan as Family['subscription']['plan']) ?? 'free',
            status: (row.planStatus as Family['subscription']['status']) ?? 'active',
        },
        settings: {
            script: (row.scriptMode as Family['settings']['script']) ?? 'both',
            theme: (row.theme as Family['settings']['theme']) ?? 'klasik',
            language: (row.language as Family['settings']['language']) ?? 'id',
        },
        stats: {
            memberCount: row.memberCount ?? 0,
            personCount: row.personCount ?? 0,
            relationshipCount: row.relationshipCount ?? 0,
        },
        createdAt: row.createdAt ?? new Date(),
        updatedAt: row.updatedAt ?? new Date(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new family tree
 */
export async function createFamily(
    input: CreateFamilyInput,
    userId: string
): Promise<Family> {
    const baseSlug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    // Append random suffix to ensure uniqueness
    const suffix = Math.random().toString(36).substring(2, 7);
    const slug = `${baseSlug}-${suffix}`;

    const [row] = await db
        .insert(trees)
        .values({
            name: input.name,
            displayName: input.displayName || input.name,
            slug,
            ownerId: userId,
            scriptMode: input.settings?.script || 'both',
            theme: input.settings?.theme || 'klasik',
            language: input.settings?.language || 'id',
        })
        .returning();

    // Auto-add creator as owner member
    await db.insert(treeMembers).values({
        treeId: row.id,
        userId,
        role: 'owner',
    });

    // Update member count
    await db
        .update(trees)
        .set({ memberCount: 1 })
        .where(eq(trees.id, row.id));

    return dbToFamily(row);
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get a family by ID
 */
export async function getFamily(familyId: string): Promise<Family | null> {
    const [row] = await db.select().from(trees).where(eq(trees.id, familyId)).limit(1);
    return row ? dbToFamily(row) : null;
}

/**
 * Get a family by slug
 */
export async function getFamilyBySlug(slug: string): Promise<Family | null> {
    const [row] = await db.select().from(trees).where(eq(trees.slug, slug)).limit(1);
    return row ? dbToFamily(row) : null;
}

/**
 * Get all families for a user
 */
export async function getUserFamilies(userId: string): Promise<Family[]> {
    const rows = await db
        .select({ tree: trees })
        .from(treeMembers)
        .innerJoin(trees, eq(treeMembers.treeId, trees.id))
        .where(eq(treeMembers.userId, userId));

    return rows.map((r) => dbToFamily(r.tree));
}

/**
 * Get family members
 */
export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    const rows = await db
        .select()
        .from(treeMembers)
        .where(eq(treeMembers.treeId, familyId));

    return rows.map((row) => ({
        memberId: row.id,
        userId: row.userId,
        familyId: row.treeId,
        role: row.role as MemberRole,
        displayName: row.displayName || '',
        email: '', // Populated via join if needed
        linkedPersonId: row.linkedPersonId ?? undefined,
        joinedAt: row.joinedAt ?? new Date(),
        invitedBy: row.invitedBy || '',
        lastActiveAt: row.lastActiveAt ?? new Date(),
    }));
}

/**
 * Check if user is a member of a family
 */
export async function isFamilyMember(
    familyId: string,
    userId: string
): Promise<boolean> {
    const [row] = await db
        .select()
        .from(treeMembers)
        .where(and(eq(treeMembers.treeId, familyId), eq(treeMembers.userId, userId)))
        .limit(1);

    return !!row;
}

/**
 * Get user's role in a family
 */
export async function getUserRole(
    familyId: string,
    userId: string
): Promise<MemberRole | null> {
    const [row] = await db
        .select()
        .from(treeMembers)
        .where(and(eq(treeMembers.treeId, familyId), eq(treeMembers.userId, userId)))
        .limit(1);

    return row ? (row.role as MemberRole) : null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update family settings
 */
export async function updateFamily(
    familyId: string,
    updates: Partial<Pick<Family, 'name' | 'displayName'>> & { settings?: Partial<Family['settings']> }
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { updatedAt: new Date() };

    if (updates.name) data.name = updates.name;
    if (updates.displayName) data.displayName = updates.displayName;
    if (updates.settings?.script) data.scriptMode = updates.settings.script;
    if (updates.settings?.theme) data.theme = updates.settings.theme;
    if (updates.settings?.language) data.language = updates.settings.language;

    await db.update(trees).set(data).where(eq(trees.id, familyId));
}

/**
 * Update family stats (cached counters)
 */
export async function updateFamilyStats(
    familyId: string,
    stats: Partial<Family['stats']>
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { updatedAt: new Date() };

    if (stats.memberCount !== undefined) data.memberCount = stats.memberCount;
    if (stats.personCount !== undefined) data.personCount = stats.personCount;
    if (stats.relationshipCount !== undefined) data.relationshipCount = stats.relationshipCount;

    await db.update(trees).set(data).where(eq(trees.id, familyId));
}

/**
 * Add a member to a family
 */
export async function addFamilyMember(
    familyId: string,
    userId: string,
    role: MemberRole = 'viewer',
    invitedBy?: string
): Promise<void> {
    await db.insert(treeMembers).values({
        treeId: familyId,
        userId,
        role,
        invitedBy: invitedBy || null,
    });

    await db
        .update(trees)
        .set({
            memberCount: sql`${trees.memberCount} + 1`,
            updatedAt: new Date(),
        })
        .where(eq(trees.id, familyId));
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
    familyId: string,
    userId: string,
    newRole: MemberRole
): Promise<void> {
    const updated = await db
        .update(treeMembers)
        .set({ role: newRole })
        .where(and(eq(treeMembers.treeId, familyId), eq(treeMembers.userId, userId)))
        .returning({ id: treeMembers.id });

    if (updated.length === 0) {
        throw new Error('Member not found');
    }
}

/**
 * Remove a member from a family
 */
export async function removeFamilyMember(
    familyId: string,
    userId: string
): Promise<void> {
    const deleted = await db
        .delete(treeMembers)
        .where(and(eq(treeMembers.treeId, familyId), eq(treeMembers.userId, userId)))
        .returning({ id: treeMembers.id });

    if (deleted.length === 0) {
        throw new Error('Member not found');
    }

    await db
        .update(trees)
        .set({
            memberCount: sql`GREATEST(${trees.memberCount} - 1, 0)`,
            updatedAt: new Date(),
        })
        .where(eq(trees.id, familyId));
}

// ─────────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Delete a family and all associated data (cascade via FK)
 */
export async function deleteFamily(familyId: string): Promise<void> {
    await db.delete(trees).where(eq(trees.id, familyId));
}
