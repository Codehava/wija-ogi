// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Relationships Service (Drizzle ORM / PostgreSQL)
// Replaces Firestore CRUD for Relationship documents
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { relationships, trees, persons } from '@/db/schema';
import type { Relationship, CreateRelationshipInput, MarriageDetails } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Map DB row → Relationship type
// ─────────────────────────────────────────────────────────────────────────────────

function dbToRelationship(row: typeof relationships.$inferSelect): Relationship {
    const result: Relationship = {
        relationshipId: row.id,
        familyId: row.treeId,
        type: row.type as Relationship['type'],
        person1Id: row.person1Id,
        person2Id: row.person2Id,
        createdAt: row.createdAt ?? new Date(),
        updatedAt: row.updatedAt ?? new Date(),
    };

    if (row.type === 'spouse') {
        result.marriage = {
            date: row.marriageDate ?? undefined,
            place: row.marriagePlace ?? undefined,
            placeLontara: row.marriagePlaceLontara ?? undefined,
            status: (row.marriageStatus as MarriageDetails['status']) ?? 'married',
            marriageOrder: row.marriageOrder ?? undefined,
        };
    }

    if (row.type === 'parent-child') {
        result.parentChild = {
            biologicalParent: row.biologicalParent ?? true,
        };
    }

    return result;
}

function ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new relationship
 */
export async function createRelationship(
    familyId: string,
    input: CreateRelationshipInput
): Promise<Relationship> {
    return db.transaction(async (tx) => {
        // Guard against duplicate/conflicting links for the same pair.
        const [existing] = await tx
            .select({
                id: relationships.id,
                type: relationships.type,
            })
            .from(relationships)
            .where(
                and(
                    eq(relationships.treeId, familyId),
                    or(
                        and(
                            eq(relationships.person1Id, input.person1Id),
                            eq(relationships.person2Id, input.person2Id)
                        ),
                        and(
                            eq(relationships.person1Id, input.person2Id),
                            eq(relationships.person2Id, input.person1Id)
                        )
                    )
                )
            )
            .limit(1);

        if (existing) {
            if (existing.type === input.type) {
                throw new Error('Hubungan ini sudah ada');
            }
            throw new Error('Hubungan tidak valid: pasangan yang sama tidak bisa juga parent-child');
        }

        if (input.type === 'parent-child') {
            const [child] = await tx
                .select({
                    parentIds: persons.parentIds,
                })
                .from(persons)
                .where(and(eq(persons.treeId, familyId), eq(persons.id, input.person2Id)))
                .limit(1);

            if (!child) {
                throw new Error('Person not found');
            }

            const parentIds = ensureStringArray(child.parentIds);
            if (!parentIds.includes(input.person1Id) && parentIds.length >= 2) {
                throw new Error('Hubungan tidak valid: anak sudah memiliki 2 orang tua');
            }
        }

        const [row] = await tx
            .insert(relationships)
            .values({
                treeId: familyId,
                type: input.type,
                person1Id: input.person1Id,
                person2Id: input.person2Id,
                marriageDate: input.marriage?.date || null,
                marriagePlace: input.marriage?.place || null,
                marriagePlaceLontara: input.marriage?.placeLontara || null,
                marriageStatus: input.marriage?.status || null,
                marriageOrder: input.marriage?.marriageOrder || null,
                biologicalParent: input.parentChild?.biologicalParent ?? true,
            })
            .returning();

        // Update tree stats
        await tx
            .update(trees)
            .set({
                relationshipCount: sql`${trees.relationshipCount} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(trees.id, familyId));

        if (input.type === 'spouse') {
            const relatedPersons = await tx
                .select({
                    id: persons.id,
                    spouseIds: persons.spouseIds,
                })
                .from(persons)
                .where(
                    and(
                        eq(persons.treeId, familyId),
                        or(
                            eq(persons.id, input.person1Id),
                            eq(persons.id, input.person2Id)
                        )
                    )
                );

            const person1 = relatedPersons.find((p) => p.id === input.person1Id);
            const person2 = relatedPersons.find((p) => p.id === input.person2Id);

            if (person1) {
                const spouseIds = ensureStringArray(person1.spouseIds);
                if (!spouseIds.includes(input.person2Id)) {
                    await tx
                        .update(persons)
                        .set({ spouseIds: [...spouseIds, input.person2Id], updatedAt: new Date() })
                        .where(and(eq(persons.treeId, familyId), eq(persons.id, input.person1Id)));
                }
            }

            if (person2) {
                const spouseIds = ensureStringArray(person2.spouseIds);
                if (!spouseIds.includes(input.person1Id)) {
                    await tx
                        .update(persons)
                        .set({ spouseIds: [...spouseIds, input.person1Id], updatedAt: new Date() })
                        .where(and(eq(persons.treeId, familyId), eq(persons.id, input.person2Id)));
                }
            }
        } else {
            const relatedPersons = await tx
                .select({
                    id: persons.id,
                    parentIds: persons.parentIds,
                    childIds: persons.childIds,
                })
                .from(persons)
                .where(
                    and(
                        eq(persons.treeId, familyId),
                        or(
                            eq(persons.id, input.person1Id),
                            eq(persons.id, input.person2Id)
                        )
                    )
                );

            const parent = relatedPersons.find((p) => p.id === input.person1Id);
            const child = relatedPersons.find((p) => p.id === input.person2Id);

            if (parent) {
                const childIds = ensureStringArray(parent.childIds);
                if (!childIds.includes(input.person2Id)) {
                    await tx
                        .update(persons)
                        .set({ childIds: [...childIds, input.person2Id], updatedAt: new Date() })
                        .where(and(eq(persons.treeId, familyId), eq(persons.id, input.person1Id)));
                }
            }

            if (child) {
                const parentIds = ensureStringArray(child.parentIds);
                if (!parentIds.includes(input.person1Id) && parentIds.length < 2) {
                    await tx
                        .update(persons)
                        .set({ parentIds: [...parentIds, input.person1Id], updatedAt: new Date() })
                        .where(and(eq(persons.treeId, familyId), eq(persons.id, input.person2Id)));
                }
            }
        }

        return dbToRelationship(row);
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get a relationship by ID
 */
export async function getRelationship(
    familyId: string,
    relationshipId: string
): Promise<Relationship | null> {
    const [row] = await db
        .select()
        .from(relationships)
        .where(and(eq(relationships.treeId, familyId), eq(relationships.id, relationshipId)))
        .limit(1);

    return row ? dbToRelationship(row) : null;
}

/**
 * Get all relationships in a family
 */
export async function getAllRelationships(familyId: string): Promise<Relationship[]> {
    const rows = await db
        .select()
        .from(relationships)
        .where(eq(relationships.treeId, familyId));

    return rows.map(dbToRelationship);
}

/**
 * Get relationships for a specific person
 */
export async function getPersonRelationships(
    familyId: string,
    personId: string
): Promise<Relationship[]> {
    const rows = await db
        .select()
        .from(relationships)
        .where(
            and(
                eq(relationships.treeId, familyId),
                or(
                    eq(relationships.person1Id, personId),
                    eq(relationships.person2Id, personId)
                )
            )
        );

    return rows.map(dbToRelationship);
}

/**
 * Get spouse relationships for a person
 */
export async function getSpouseRelationships(
    familyId: string,
    personId: string
): Promise<Relationship[]> {
    const rows = await db
        .select()
        .from(relationships)
        .where(
            and(
                eq(relationships.treeId, familyId),
                eq(relationships.type, 'spouse'),
                or(
                    eq(relationships.person1Id, personId),
                    eq(relationships.person2Id, personId)
                )
            )
        );

    return rows.map(dbToRelationship);
}

/**
 * Get parent-child relationships for a person
 */
export async function getParentChildRelationships(
    familyId: string,
    personId: string
): Promise<Relationship[]> {
    const rows = await db
        .select()
        .from(relationships)
        .where(
            and(
                eq(relationships.treeId, familyId),
                eq(relationships.type, 'parent-child'),
                or(
                    eq(relationships.person1Id, personId),
                    eq(relationships.person2Id, personId)
                )
            )
        );

    return rows.map(dbToRelationship);
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update marriage details
 */
export async function updateMarriageDetails(
    familyId: string,
    relationshipId: string,
    marriage: Partial<MarriageDetails>
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { updatedAt: new Date() };

    if (marriage.date !== undefined) data.marriageDate = marriage.date || null;
    if (marriage.place !== undefined) data.marriagePlace = marriage.place || null;
    if (marriage.placeLontara !== undefined) data.marriagePlaceLontara = marriage.placeLontara || null;
    if (marriage.status !== undefined) data.marriageStatus = marriage.status;
    if (marriage.marriageOrder !== undefined) data.marriageOrder = marriage.marriageOrder;

    await db
        .update(relationships)
        .set(data)
        .where(and(eq(relationships.treeId, familyId), eq(relationships.id, relationshipId)));
}

// ─────────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Delete a relationship
 */
export async function deleteRelationship(
    familyId: string,
    relationshipId: string
): Promise<void> {
    await db.transaction(async (tx) => {
        const [relationship] = await tx
            .select()
            .from(relationships)
            .where(and(eq(relationships.treeId, familyId), eq(relationships.id, relationshipId)))
            .limit(1);

        if (!relationship) return;

        await tx
            .delete(relationships)
            .where(and(eq(relationships.treeId, familyId), eq(relationships.id, relationshipId)));

        // Update tree stats
        await tx
            .update(trees)
            .set({
                relationshipCount: sql`GREATEST(${trees.relationshipCount} - 1, 0)`,
                updatedAt: new Date(),
            })
            .where(eq(trees.id, familyId));

        if (relationship.type === 'spouse') {
            const relatedPersons = await tx
                .select({
                    id: persons.id,
                    spouseIds: persons.spouseIds,
                })
                .from(persons)
                .where(
                    and(
                        eq(persons.treeId, familyId),
                        or(
                            eq(persons.id, relationship.person1Id),
                            eq(persons.id, relationship.person2Id)
                        )
                    )
                );

            const person1 = relatedPersons.find((p) => p.id === relationship.person1Id);
            const person2 = relatedPersons.find((p) => p.id === relationship.person2Id);

            if (person1) {
                await tx
                    .update(persons)
                    .set({
                        spouseIds: ensureStringArray(person1.spouseIds).filter((id) => id !== relationship.person2Id),
                        updatedAt: new Date(),
                    })
                    .where(and(eq(persons.treeId, familyId), eq(persons.id, relationship.person1Id)));
            }

            if (person2) {
                await tx
                    .update(persons)
                    .set({
                        spouseIds: ensureStringArray(person2.spouseIds).filter((id) => id !== relationship.person1Id),
                        updatedAt: new Date(),
                    })
                    .where(and(eq(persons.treeId, familyId), eq(persons.id, relationship.person2Id)));
            }
        } else if (relationship.type === 'parent-child') {
            const relatedPersons = await tx
                .select({
                    id: persons.id,
                    parentIds: persons.parentIds,
                    childIds: persons.childIds,
                })
                .from(persons)
                .where(
                    and(
                        eq(persons.treeId, familyId),
                        or(
                            eq(persons.id, relationship.person1Id),
                            eq(persons.id, relationship.person2Id)
                        )
                    )
                );

            const parent = relatedPersons.find((p) => p.id === relationship.person1Id);
            const child = relatedPersons.find((p) => p.id === relationship.person2Id);

            if (parent) {
                await tx
                    .update(persons)
                    .set({
                        childIds: ensureStringArray(parent.childIds).filter((id) => id !== relationship.person2Id),
                        updatedAt: new Date(),
                    })
                    .where(and(eq(persons.treeId, familyId), eq(persons.id, relationship.person1Id)));
            }

            if (child) {
                await tx
                    .update(persons)
                    .set({
                        parentIds: ensureStringArray(child.parentIds).filter((id) => id !== relationship.person1Id),
                        updatedAt: new Date(),
                    })
                    .where(and(eq(persons.treeId, familyId), eq(persons.id, relationship.person2Id)));
            }
        }
    });
}

/**
 * Delete all relationships for a person
 */
export async function deletePersonRelationships(
    familyId: string,
    personId: string
): Promise<void> {
    const existing = await getPersonRelationships(familyId, personId);

    if (existing.length > 0) {
        await db
            .delete(relationships)
            .where(
                and(
                    eq(relationships.treeId, familyId),
                    or(
                        eq(relationships.person1Id, personId),
                        eq(relationships.person2Id, personId)
                    )
                )
            );

        // Update tree stats
        await db
            .update(trees)
            .set({
                relationshipCount: sql`GREATEST(${trees.relationshipCount} - ${existing.length}, 0)`,
                updatedAt: new Date(),
            })
            .where(eq(trees.id, familyId));
    }
}
