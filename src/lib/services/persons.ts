// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Persons Service (Drizzle ORM / PostgreSQL)
// Replaces Firestore CRUD — all same function signatures preserved
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { persons, trees, relationships } from '@/db/schema';
import type { Person, CreatePersonInput, LatinName, LontaraName } from '@/types';
import { transliterateName } from '@/lib/transliteration/engine';

function ensureStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Map DB row → Person type
// ─────────────────────────────────────────────────────────────────────────────────

function dbToPerson(row: typeof persons.$inferSelect): Person {
    return {
        personId: row.id,
        familyId: row.treeId,
        firstName: row.firstName,
        middleName: row.middleName ?? undefined,
        lastName: row.lastName,
        fullName: row.fullName ?? [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
        latinName: {
            first: row.firstName,
            middle: row.middleName ?? '',
            last: row.lastName,
        },
        lontaraName: {
            first: row.lontaraFirstName ?? '',
            middle: row.lontaraMiddleName ?? '',
            last: row.lontaraLastName ?? '',
        },
        lontaraNameCustom: (row.lontaraFirstNameCustom || row.lontaraMiddleNameCustom || row.lontaraLastNameCustom)
            ? {
                first: row.lontaraFirstNameCustom ?? undefined,
                middle: row.lontaraMiddleNameCustom ?? undefined,
                last: row.lontaraLastNameCustom ?? undefined,
            }
            : undefined,
        gender: row.gender as Person['gender'],
        birthDate: row.birthDate ?? undefined,
        birthPlace: row.birthPlace ?? undefined,
        birthOrder: row.birthOrder ?? undefined,
        deathDate: row.deathDate ?? undefined,
        deathPlace: row.deathPlace ?? undefined,
        isLiving: row.isLiving ?? true,
        occupation: row.occupation ?? undefined,
        title: (row.title as Person['title']) ?? undefined,
        reignTitle: row.reignTitle ?? undefined,
        biography: row.biography ?? undefined,
        relationships: {
            spouseIds: ensureStringArray(row.spouseIds),
            parentIds: ensureStringArray(row.parentIds),
            childIds: ensureStringArray(row.childIds),
            siblingIds: ensureStringArray(row.siblingIds),
        },
        isRootAncestor: row.isRootAncestor ?? false,
        position: {
            x: row.positionX ?? 0,
            y: row.positionY ?? 0,
            fixed: row.positionFixed ?? false,
        },
        photoUrl: row.photoUrl ?? undefined,
        thumbnailUrl: row.thumbnailUrl ?? undefined,
        gedcomId: row.gedcomId ?? undefined,
        createdBy: row.createdBy ?? '',
        createdAt: row.createdAt ?? new Date(),
        updatedBy: row.updatedBy ?? '',
        updatedAt: row.updatedAt ?? new Date(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new person with auto-transliteration
 */
export async function createPerson(
    familyId: string,
    input: CreatePersonInput,
    userId: string
): Promise<Person> {
    const latinName: LatinName = {
        first: input.firstName,
        middle: input.middleName || '',
        last: input.lastName || '',
    };

    const lontaraName = transliterateName(latinName);
    const fullName = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(' ');

    const [row] = await db
        .insert(persons)
        .values({
            treeId: familyId,
            firstName: input.firstName,
            middleName: input.middleName || null,
            lastName: input.lastName || '',
            fullName,
            lontaraFirstName: lontaraName.first,
            lontaraMiddleName: lontaraName.middle || null,
            lontaraLastName: lontaraName.last,
            gender: input.gender,
            birthDate: input.birthDate || null,
            birthPlace: input.birthPlace || null,
            birthOrder: input.birthOrder || null,
            deathDate: input.deathDate || null,
            deathPlace: input.deathPlace || null,
            isLiving: input.isLiving ?? true,
            occupation: input.occupation || null,
            title: input.title || null,
            reignTitle: input.reignTitle || null,
            biography: input.biography || null,
            isRootAncestor: input.isRootAncestor || false,
            spouseIds: [],
            parentIds: [],
            childIds: [],
            siblingIds: [],
            createdBy: userId,
            updatedBy: userId,
        })
        .returning();

    // Update tree stats
    await db
        .update(trees)
        .set({
            personCount: sql`${trees.personCount} + 1`,
            updatedAt: new Date(),
        })
        .where(eq(trees.id, familyId));

    // Set as root ancestor if explicitly marked
    if (input.isRootAncestor) {
        await db
            .update(trees)
            .set({ rootAncestorId: row.id })
            .where(eq(trees.id, familyId));
    }

    return dbToPerson(row);
}

// ─────────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get a person by ID
 */
export async function getPerson(
    familyId: string,
    personId: string
): Promise<Person | null> {
    const [row] = await db
        .select()
        .from(persons)
        .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)))
        .limit(1);

    return row ? dbToPerson(row) : null;
}

/**
 * Get all persons in a family
 */
export async function getAllPersons(familyId: string): Promise<Person[]> {
    const rows = await db
        .select()
        .from(persons)
        .where(eq(persons.treeId, familyId));

    return rows.map(dbToPerson);
}

/**
 * Get persons with pagination
 */
export async function getPersonsPaginated(
    familyId: string,
    pageSize: number = 100,
    offset: number = 0
): Promise<{ persons: Person[]; hasMore: boolean }> {
    const rows = await db
        .select()
        .from(persons)
        .where(eq(persons.treeId, familyId))
        .limit(pageSize + 1)
        .offset(offset);

    const hasMore = rows.length > pageSize;
    const result = hasMore ? rows.slice(0, pageSize) : rows;

    return { persons: result.map(dbToPerson), hasMore };
}

/**
 * Get persons as a Map for efficient lookups
 */
export async function getPersonsMap(familyId: string): Promise<Map<string, Person>> {
    const list = await getAllPersons(familyId);
    const map = new Map<string, Person>();
    list.forEach((p) => map.set(p.personId, p));
    return map;
}

/**
 * Get root ancestor
 */
export async function getRootAncestor(familyId: string): Promise<Person | null> {
    const [row] = await db
        .select()
        .from(persons)
        .where(and(eq(persons.treeId, familyId), eq(persons.isRootAncestor, true)))
        .limit(1);

    return row ? dbToPerson(row) : null;
}

/**
 * Search persons by name
 */
export async function searchPersonsByName(
    familyId: string,
    searchTerm: string
): Promise<Person[]> {
    const term = `%${searchTerm}%`;
    const rows = await db
        .select()
        .from(persons)
        .where(
            and(
                eq(persons.treeId, familyId),
                or(
                    ilike(persons.fullName, term),
                    ilike(persons.firstName, term),
                    ilike(persons.lastName, term)
                )
            )
        );

    return rows.map(dbToPerson);
}

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update a person
 */
export async function updatePerson(
    familyId: string,
    personId: string,
    updates: Partial<CreatePersonInput>,
    userId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
        updatedBy: userId,
        updatedAt: new Date(),
    };

    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.middleName !== undefined) updateData.middleName = updates.middleName || null;
    if (updates.gender !== undefined) updateData.gender = updates.gender;
    if (updates.birthDate !== undefined) updateData.birthDate = updates.birthDate || null;
    if (updates.birthPlace !== undefined) updateData.birthPlace = updates.birthPlace || null;
    if (updates.birthOrder !== undefined) updateData.birthOrder = updates.birthOrder || null;
    if (updates.deathDate !== undefined) updateData.deathDate = updates.deathDate || null;
    if (updates.deathPlace !== undefined) updateData.deathPlace = updates.deathPlace || null;
    if (updates.isLiving !== undefined) updateData.isLiving = updates.isLiving;
    if (updates.occupation !== undefined) updateData.occupation = updates.occupation || null;
    if (updates.title !== undefined) updateData.title = updates.title || null;
    if (updates.reignTitle !== undefined) updateData.reignTitle = updates.reignTitle || null;
    if (updates.biography !== undefined) updateData.biography = updates.biography || null;
    if (updates.isRootAncestor !== undefined) updateData.isRootAncestor = updates.isRootAncestor;

    // Re-transliterate if name changed
    if (updates.firstName || updates.middleName || updates.lastName) {
        const person = await getPerson(familyId, personId);
        if (person) {
            const latinName: LatinName = {
                first: updates.firstName ?? person.firstName,
                middle: updates.middleName ?? person.middleName ?? '',
                last: updates.lastName ?? person.lastName ?? '',
            };

            updateData.lontaraFirstName = transliterateName(latinName).first;
            updateData.lontaraMiddleName = transliterateName(latinName).middle || null;
            updateData.lontaraLastName = transliterateName(latinName).last;
            updateData.fullName = [latinName.first, latinName.middle, latinName.last]
                .filter(Boolean)
                .join(' ');
        }
    }

    await db
        .update(persons)
        .set(updateData)
        .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));
}

/**
 * Update person position
 */
export async function updatePersonPosition(
    familyId: string,
    personId: string,
    position: { x: number; y: number; fixed?: boolean }
): Promise<void> {
    await db
        .update(persons)
        .set({
            positionX: position.x,
            positionY: position.y,
            positionFixed: position.fixed ?? false,
            updatedAt: new Date(),
        })
        .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));
}

/**
 * P5 FIX: Update ALL person positions in batch using a single SQL statement
 * Uses CASE/WHEN for bulk update instead of N separate UPDATE queries
 */
export async function updateAllPersonPositions(
    familyId: string,
    positions: Map<string, { x: number; y: number }>
): Promise<void> {
    if (positions.size === 0) return;

    const CHUNK_SIZE = 500;
    const entries = Array.from(positions.entries());

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE);
        const ids = chunk.map(([id]) => id);

        // Build CASE/WHEN expressions for positionX and positionY
        const xCases = chunk.map(([id, pos]) =>
            sql`WHEN id = ${id} THEN ${pos.x}`
        );
        const yCases = chunk.map(([id, pos]) =>
            sql`WHEN id = ${id} THEN ${pos.y}`
        );

        await db.execute(sql`
            UPDATE persons SET
                position_x = CASE ${sql.join(xCases, sql` `)} ELSE position_x END,
                position_y = CASE ${sql.join(yCases, sql` `)} ELSE position_y END,
                position_fixed = true,
                updated_at = NOW()
            WHERE tree_id = ${familyId}
                AND id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        `);
    }
}

/**
 * Update person relationships (denormalized JSONB arrays)
 */
export async function updatePersonRelationships(
    familyId: string,
    personId: string,
    relationships: Partial<Person['relationships']>
): Promise<void> {
    const person = await getPerson(familyId, personId);
    if (!person) throw new Error('Person not found');

    const merged = { ...person.relationships, ...relationships };

    await db
        .update(persons)
        .set({
            spouseIds: merged.spouseIds,
            parentIds: merged.parentIds,
            childIds: merged.childIds,
            siblingIds: merged.siblingIds,
            updatedAt: new Date(),
        })
        .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));
}

/**
 * Set custom Lontara name (manual override)
 */
export async function setCustomLontaraName(
    familyId: string,
    personId: string,
    customName: Partial<LontaraName>
): Promise<void> {
    await db
        .update(persons)
        .set({
            lontaraFirstNameCustom: customName.first ?? null,
            lontaraMiddleNameCustom: customName.middle ?? null,
            lontaraLastNameCustom: customName.last ?? null,
            updatedAt: new Date(),
        })
        .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));
}

/**
 * Set person as root ancestor
 */
export async function setAsRootAncestor(
    familyId: string,
    personId: string
): Promise<void> {
    await db.transaction(async (tx) => {
        // Unset current root
        await tx
            .update(persons)
            .set({ isRootAncestor: false })
            .where(and(eq(persons.treeId, familyId), eq(persons.isRootAncestor, true)));

        // Set new root
        await tx
            .update(persons)
            .set({ isRootAncestor: true })
            .where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));

        // Update tree
        await tx
            .update(trees)
            .set({ rootAncestorId: personId })
            .where(eq(trees.id, familyId));
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Delete a person and clean up denormalized relationship JSON arrays.
 */
export async function deletePerson(
    familyId: string,
    personId: string
): Promise<void> {
    const person = await getPerson(familyId, personId);
    if (!person) return;

    await db.transaction(async (tx) => {
        const [{ relationshipCount }] = await tx
            .select({
                relationshipCount: sql<number>`count(*)`.mapWith(Number),
            })
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

        // Relationship arrays are JSONB, so cleanup must use JS filtering (not SQL array_remove).
        const relatedRows = await tx
            .select({
                id: persons.id,
                spouseIds: persons.spouseIds,
                parentIds: persons.parentIds,
                childIds: persons.childIds,
                siblingIds: persons.siblingIds,
            })
            .from(persons)
            .where(and(eq(persons.treeId, familyId), sql`${persons.id} <> ${personId}`));

        for (const row of relatedRows) {
            const spouseIds = ensureStringArray(row.spouseIds);
            const parentIds = ensureStringArray(row.parentIds);
            const childIds = ensureStringArray(row.childIds);
            const siblingIds = ensureStringArray(row.siblingIds);

            const nextSpouseIds = spouseIds.filter(id => id !== personId);
            const nextParentIds = parentIds.filter(id => id !== personId);
            const nextChildIds = childIds.filter(id => id !== personId);
            const nextSiblingIds = siblingIds.filter(id => id !== personId);

            const changed =
                nextSpouseIds.length !== spouseIds.length ||
                nextParentIds.length !== parentIds.length ||
                nextChildIds.length !== childIds.length ||
                nextSiblingIds.length !== siblingIds.length;

            if (changed) {
                await tx
                    .update(persons)
                    .set({
                        spouseIds: nextSpouseIds,
                        parentIds: nextParentIds,
                        childIds: nextChildIds,
                        siblingIds: nextSiblingIds,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(persons.treeId, familyId), eq(persons.id, row.id)));
            }
        }

        // If root ancestor is deleted, clear pointer (user can set a new root later).
        if (person.isRootAncestor) {
            await tx
                .update(trees)
                .set({
                    rootAncestorId: null,
                    updatedAt: new Date(),
                })
                .where(eq(trees.id, familyId));
        }

        // Delete the person
        await tx.delete(persons).where(and(eq(persons.treeId, familyId), eq(persons.id, personId)));

        // Update tree stats
        await tx
            .update(trees)
            .set({
                personCount: sql`GREATEST(${trees.personCount} - 1, 0)`,
                relationshipCount: sql`GREATEST(${trees.relationshipCount} - ${relationshipCount}, 0)`,
                updatedAt: new Date(),
            })
            .where(eq(trees.id, familyId));
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Add spouse relationship (bidirectional)
 */
export async function addSpouse(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<void> {
    const person1 = await getPerson(familyId, person1Id);
    const person2 = await getPerson(familyId, person2Id);
    if (!person1 || !person2) throw new Error('Person not found');

    await db.transaction(async (tx) => {
        if (!person1.relationships.spouseIds.includes(person2Id)) {
            await tx
                .update(persons)
                .set({ spouseIds: [...person1.relationships.spouseIds, person2Id] })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, person1Id)));
        }
        if (!person2.relationships.spouseIds.includes(person1Id)) {
            await tx
                .update(persons)
                .set({ spouseIds: [...person2.relationships.spouseIds, person1Id] })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, person2Id)));
        }
    });
}

/**
 * Add parent-child relationship (bidirectional)
 */
export async function addParentChild(
    familyId: string,
    parentId: string,
    childId: string
): Promise<void> {
    const parent = await getPerson(familyId, parentId);
    const child = await getPerson(familyId, childId);
    if (!parent || !child) throw new Error('Person not found');

    await db.transaction(async (tx) => {
        if (!parent.relationships.childIds.includes(childId)) {
            await tx
                .update(persons)
                .set({ childIds: [...parent.relationships.childIds, childId] })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, parentId)));
        }
        if (!child.relationships.parentIds.includes(parentId) && child.relationships.parentIds.length < 2) {
            await tx
                .update(persons)
                .set({ parentIds: [...child.relationships.parentIds, parentId] })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, childId)));
        }
    });
}

/**
 * Remove spouse relationship
 */
export async function removeSpouse(
    familyId: string,
    person1Id: string,
    person2Id: string
): Promise<void> {
    const person1 = await getPerson(familyId, person1Id);
    const person2 = await getPerson(familyId, person2Id);

    await db.transaction(async (tx) => {
        const deletedRelationships = await tx
            .delete(relationships)
            .where(
                and(
                    eq(relationships.treeId, familyId),
                    eq(relationships.type, 'spouse'),
                    or(
                        and(
                            eq(relationships.person1Id, person1Id),
                            eq(relationships.person2Id, person2Id)
                        ),
                        and(
                            eq(relationships.person1Id, person2Id),
                            eq(relationships.person2Id, person1Id)
                        )
                    )
                )
            )
            .returning({ id: relationships.id });

        if (deletedRelationships.length > 0) {
            await tx
                .update(trees)
                .set({
                    relationshipCount: sql`GREATEST(${trees.relationshipCount} - ${deletedRelationships.length}, 0)`,
                    updatedAt: new Date(),
                })
                .where(eq(trees.id, familyId));
        }

        if (person1) {
            await tx
                .update(persons)
                .set({ spouseIds: person1.relationships.spouseIds.filter((id) => id !== person2Id) })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, person1Id)));
        }
        if (person2) {
            await tx
                .update(persons)
                .set({ spouseIds: person2.relationships.spouseIds.filter((id) => id !== person1Id) })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, person2Id)));
        }
    });
}

/**
 * Remove parent-child relationship
 */
export async function removeParentChild(
    familyId: string,
    parentId: string,
    childId: string
): Promise<void> {
    const parent = await getPerson(familyId, parentId);
    const child = await getPerson(familyId, childId);

    await db.transaction(async (tx) => {
        const deletedRelationships = await tx
            .delete(relationships)
            .where(
                and(
                    eq(relationships.treeId, familyId),
                    eq(relationships.type, 'parent-child'),
                    or(
                        and(
                            eq(relationships.person1Id, parentId),
                            eq(relationships.person2Id, childId)
                        ),
                        and(
                            eq(relationships.person1Id, childId),
                            eq(relationships.person2Id, parentId)
                        )
                    )
                )
            )
            .returning({ id: relationships.id });

        if (deletedRelationships.length > 0) {
            await tx
                .update(trees)
                .set({
                    relationshipCount: sql`GREATEST(${trees.relationshipCount} - ${deletedRelationships.length}, 0)`,
                    updatedAt: new Date(),
                })
                .where(eq(trees.id, familyId));
        }

        if (parent) {
            await tx
                .update(persons)
                .set({ childIds: parent.relationships.childIds.filter((id) => id !== childId) })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, parentId)));
        }
        if (child) {
            await tx
                .update(persons)
                .set({ parentIds: child.relationships.parentIds.filter((id) => id !== parentId) })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, childId)));
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATE LONTARA NAMES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Regenerate Lontara names for all persons in a family
 */
export async function regenerateAllLontaraNames(familyId: string): Promise<number> {
    const allPersons = await getAllPersons(familyId);
    let count = 0;

    await db.transaction(async (tx) => {
        for (const person of allPersons) {
            const latinName: LatinName = {
                first: person.latinName?.first || person.firstName || '',
                middle: person.latinName?.middle || '',
                last: person.latinName?.last || '',
            };

            const newLontara = transliterateName(latinName);

            await tx
                .update(persons)
                .set({
                    lontaraFirstName: newLontara.first,
                    lontaraMiddleName: newLontara.middle || null,
                    lontaraLastName: newLontara.last,
                    updatedAt: new Date(),
                })
                .where(and(eq(persons.treeId, familyId), eq(persons.id, person.personId)));

            count++;
        }
    });

    return count;
}
