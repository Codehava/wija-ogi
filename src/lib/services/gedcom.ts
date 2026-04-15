// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - GEDCOM 7.0 Import/Export Service
// Ported from WIJA-OGI, adapted for WIJA 3 schema (Drizzle ORM)
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/db';
import { persons, relationships, trees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { transliterateName } from '@/lib/transliteration/engine';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface GedcomRecord {
    tag: string;
    xref?: string;
    value?: string;
    children: GedcomRecord[];
}

interface ParsedPerson {
    xref: string;
    givenNames?: string;
    surname?: string;
    sex?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    occupation?: string;
    notes?: string;
    title?: string;
}

interface ParsedFamily {
    xref: string;
    husbandXref?: string;
    wifeXref?: string;
    childXrefs: string[];
    marriageDate?: string;
    marriagePlace?: string;
    divorceDate?: string;
}

export interface GedcomImportResult {
    treeId: string;
    personsCount: number;
    familiesCount: number;
    relationshipsCount: number;
}

export interface GedcomValidationResult {
    valid: boolean;
    summary: {
        totalRecords: number;
        persons: number;
        families: number;
        sources: number;
    };
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PARSER — Pure GEDCOM line/tree parser (no DB dependency)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse a single GEDCOM line
 * Format: LEVEL [XREF] TAG [VALUE]
 */
function parseGedcomLine(line: string): { level: number; xref?: string; tag: string; value?: string } | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^(\d+)\s+(@[\w]+@)?\s*(\w+)\s*(.*)$/);
    if (!match) return null;

    return {
        level: parseInt(match[1], 10),
        xref: match[2]?.replace(/@/g, ''),
        tag: match[3].toUpperCase(),
        value: match[4] || undefined,
    };
}

/**
 * Parse GEDCOM content string into structured records
 */
export function parseGedcom(content: string): GedcomRecord[] {
    const lines = content.split(/\r?\n/);
    const records: GedcomRecord[] = [];
    const stack: GedcomRecord[] = [];

    for (const line of lines) {
        const parsed = parseGedcomLine(line);
        if (!parsed) continue;

        const record: GedcomRecord = {
            tag: parsed.tag,
            xref: parsed.xref,
            value: parsed.value,
            children: [],
        };

        if (parsed.level === 0) {
            records.push(record);
            stack.length = 0;
            stack.push(record);
        } else {
            while (stack.length > parsed.level) {
                stack.pop();
            }
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(record);
            }
            stack.push(record);
        }
    }

    return records;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXTRACTORS — Pull structured data from GEDCOM records
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract person (INDI) data from a GEDCOM record
 */
function extractPerson(record: GedcomRecord): ParsedPerson {
    const person: ParsedPerson = {
        xref: record.xref || '',
    };

    for (const child of record.children) {
        switch (child.tag) {
            case 'NAME': {
                // Parse GEDCOM name format: "Given /Surname/"
                const nameMatch = child.value?.match(/([^\/]*)\s*\/([^\/]*)\//);
                if (nameMatch) {
                    person.givenNames = nameMatch[1]?.trim() || undefined;
                    person.surname = nameMatch[2]?.trim() || undefined;
                }
                break;
            }
            case 'SEX':
                person.sex = child.value?.charAt(0);
                break;
            case 'BIRT':
                for (const bc of child.children) {
                    if (bc.tag === 'DATE') person.birthDate = bc.value;
                    if (bc.tag === 'PLAC') person.birthPlace = bc.value;
                }
                break;
            case 'DEAT':
                for (const dc of child.children) {
                    if (dc.tag === 'DATE') person.deathDate = dc.value;
                    if (dc.tag === 'PLAC') person.deathPlace = dc.value;
                }
                break;
            case 'OCCU':
                person.occupation = child.value;
                break;
            case 'TITL':
                person.title = child.value;
                break;
            case 'NOTE':
                person.notes = child.value;
                break;
        }
    }

    return person;
}

/**
 * Extract family (FAM) data from a GEDCOM record
 */
function extractFamily(record: GedcomRecord): ParsedFamily {
    const family: ParsedFamily = {
        xref: record.xref || '',
        childXrefs: [],
    };

    for (const child of record.children) {
        switch (child.tag) {
            case 'HUSB':
                family.husbandXref = child.value?.replace(/@/g, '');
                break;
            case 'WIFE':
                family.wifeXref = child.value?.replace(/@/g, '');
                break;
            case 'CHIL':
                family.childXrefs.push(child.value?.replace(/@/g, '') || '');
                break;
            case 'MARR':
                for (const mc of child.children) {
                    if (mc.tag === 'DATE') family.marriageDate = mc.value;
                    if (mc.tag === 'PLAC') family.marriagePlace = mc.value;
                }
                break;
            case 'DIV':
                for (const dc of child.children) {
                    if (dc.tag === 'DATE') family.divorceDate = dc.value;
                }
                break;
        }
    }

    return family;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS — Map GEDCOM fields → WIJA 3 schema
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Split GEDCOM givenNames "Andi Muhammad" into firstName + middleName
 */
function splitGivenNames(givenNames?: string): { firstName: string; middleName?: string } {
    if (!givenNames) return { firstName: '' };

    const parts = givenNames.trim().split(/\s+/);
    if (parts.length <= 1) {
        return { firstName: parts[0] || '' };
    }

    return {
        firstName: parts[0],
        middleName: parts.slice(1).join(' '),
    };
}

/**
 * Map GEDCOM sex (M/F/U) to WIJA 3 gender
 */
function mapGender(sex?: string): 'male' | 'female' | 'unknown' {
    switch (sex?.toUpperCase()) {
        case 'M': return 'male';
        case 'F': return 'female';
        default: return 'unknown';
    }
}

/**
 * Map WIJA 3 gender to GEDCOM sex
 */
function mapGenderToSex(gender: string): string {
    switch (gender) {
        case 'male': return 'M';
        case 'female': return 'F';
        default: return 'U';
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// IMPORT — Parse GEDCOM content and insert into DB
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Import GEDCOM content into a tree.
 * Creates a new tree or imports into an existing one.
 */
export async function importGedcom(
    content: string,
    userId: string,
    treeName: string,
    existingTreeId?: string
): Promise<GedcomImportResult> {
    const records = parseGedcom(content);

    // Create or use existing tree
    let treeId: string;
    if (existingTreeId) {
        treeId = existingTreeId;
    } else {
        treeId = uuidv4();
        await db.insert(trees).values({
            id: treeId,
            name: treeName,
            displayName: treeName,
            ownerId: userId,
        });
    }

    // Map GEDCOM xref → UUID
    const xrefToId = new Map<string, string>();

    // ── Insert Persons ──
    const indiRecords = records.filter(r => r.tag === 'INDI');
    for (const rec of indiRecords) {
        const parsed = extractPerson(rec);
        const personId = uuidv4();
        xrefToId.set(parsed.xref, personId);

        const { firstName, middleName } = splitGivenNames(parsed.givenNames);
        const lastName = parsed.surname || '';

        // Auto-transliterate to Lontara
        const lontara = transliterateName({
            first: firstName,
            middle: middleName,
            last: lastName,
        });

        await db.insert(persons).values({
            id: personId,
            treeId,
            gedcomId: parsed.xref,
            firstName: firstName || 'Unknown',
            middleName: middleName || null,
            lastName: lastName || '',
            fullName: [firstName, middleName, lastName].filter(Boolean).join(' '),
            gender: mapGender(parsed.sex),
            birthDate: parsed.birthDate || null,
            birthPlace: parsed.birthPlace || null,
            deathDate: parsed.deathDate || null,
            deathPlace: parsed.deathPlace || null,
            isLiving: !parsed.deathDate,
            occupation: parsed.occupation || null,
            biography: parsed.notes || null,
            // Lontara auto-transliteration
            lontaraFirstName: lontara.first || null,
            lontaraMiddleName: lontara.middle || null,
            lontaraLastName: lontara.last || null,
            // Lontara places
            birthPlaceLontara: parsed.birthPlace ? transliterateName({ first: parsed.birthPlace, last: '' }).first : null,
            deathPlaceLontara: parsed.deathPlace ? transliterateName({ first: parsed.deathPlace, last: '' }).first : null,
            // Royal title from GEDCOM TITL tag
            reignTitle: parsed.title || null,
        });
    }

    // ── Insert Relationships from FAM records ──
    const famRecords = records.filter(r => r.tag === 'FAM');
    let relCount = 0;

    // Collect denormalized relationship IDs for batch update
    const spouseMap = new Map<string, Set<string>>();   // personId → Set of spouse IDs
    const parentMap = new Map<string, Set<string>>();    // childId → Set of parent IDs
    const childMap = new Map<string, Set<string>>();     // parentId → Set of child IDs

    for (const rec of famRecords) {
        const parsed = extractFamily(rec);
        const husbId = parsed.husbandXref ? xrefToId.get(parsed.husbandXref) : undefined;
        const wifeId = parsed.wifeXref ? xrefToId.get(parsed.wifeXref) : undefined;

        // Create spouse relationship
        if (husbId && wifeId) {
            await db.insert(relationships).values({
                id: uuidv4(),
                treeId,
                gedcomFamilyId: parsed.xref,
                type: 'spouse',
                person1Id: husbId,
                person2Id: wifeId,
                marriageDate: parsed.marriageDate || null,
                marriagePlace: parsed.marriagePlace || null,
                marriageStatus: parsed.divorceDate ? 'divorced' : 'married',
                divorceDate: parsed.divorceDate || null,
                marriagePlaceLontara: parsed.marriagePlace
                    ? transliterateName({ first: parsed.marriagePlace, last: '' }).first
                    : null,
            });
            relCount++;

            // Track spouse IDs for denormalization
            if (!spouseMap.has(husbId)) spouseMap.set(husbId, new Set());
            if (!spouseMap.has(wifeId)) spouseMap.set(wifeId, new Set());
            spouseMap.get(husbId)!.add(wifeId);
            spouseMap.get(wifeId)!.add(husbId);
        }

        // Create parent-child relationships
        for (let i = 0; i < parsed.childXrefs.length; i++) {
            const childXref = parsed.childXrefs[i];
            const childId = xrefToId.get(childXref);
            if (!childId) continue;

            // Father → child
            if (husbId) {
                await db.insert(relationships).values({
                    id: uuidv4(),
                    treeId,
                    gedcomFamilyId: parsed.xref,
                    type: 'parent-child',
                    person1Id: husbId,
                    person2Id: childId,
                });
                relCount++;

                // Track parent/child for denormalization
                if (!parentMap.has(childId)) parentMap.set(childId, new Set());
                parentMap.get(childId)!.add(husbId);
                if (!childMap.has(husbId)) childMap.set(husbId, new Set());
                childMap.get(husbId)!.add(childId);
            }

            // Mother → child
            if (wifeId) {
                await db.insert(relationships).values({
                    id: uuidv4(),
                    treeId,
                    gedcomFamilyId: parsed.xref,
                    type: 'parent-child',
                    person1Id: wifeId,
                    person2Id: childId,
                });
                relCount++;

                // Track parent/child for denormalization
                if (!parentMap.has(childId)) parentMap.set(childId, new Set());
                parentMap.get(childId)!.add(wifeId);
                if (!childMap.has(wifeId)) childMap.set(wifeId, new Set());
                childMap.get(wifeId)!.add(childId);
            }

            // Update child's birth order
            await db.update(persons)
                .set({ birthOrder: i + 1 })
                .where(eq(persons.id, childId));
        }
    }

    // ── Compute sibling IDs ──
    // Children of the same parent set are siblings
    const siblingMap = new Map<string, Set<string>>();
    for (const [, children] of childMap) {
        const childArray = Array.from(children);
        for (const child of childArray) {
            if (!siblingMap.has(child)) siblingMap.set(child, new Set());
            for (const sibling of childArray) {
                if (sibling !== child) {
                    siblingMap.get(child)!.add(sibling);
                }
            }
        }
    }

    // ── Batch update denormalized JSONB arrays on persons ──
    const allPersonIds = new Set([
        ...spouseMap.keys(),
        ...parentMap.keys(),
        ...childMap.keys(),
        ...siblingMap.keys(),
    ]);

    for (const personId of allPersonIds) {
        const updates: Record<string, string[]> = {};
        if (spouseMap.has(personId)) updates.spouseIds = Array.from(spouseMap.get(personId)!);
        if (parentMap.has(personId)) updates.parentIds = Array.from(parentMap.get(personId)!);
        if (childMap.has(personId)) updates.childIds = Array.from(childMap.get(personId)!);
        if (siblingMap.has(personId)) updates.siblingIds = Array.from(siblingMap.get(personId)!);

        await db.update(persons)
            .set(updates)
            .where(eq(persons.id, personId));
    }

    // ── Auto-detect root ancestor ──
    // Find the person with no parents who has the most descendants
    const personsWithNoParents = Array.from(xrefToId.values()).filter(
        pid => !parentMap.has(pid) || parentMap.get(pid)!.size === 0
    );

    if (personsWithNoParents.length > 0) {
        // Pick the one with most children (likely the oldest generation)
        let bestRootId = personsWithNoParents[0];
        let maxChildren = 0;

        for (const pid of personsWithNoParents) {
            const childCount = childMap.has(pid) ? childMap.get(pid)!.size : 0;
            if (childCount > maxChildren) {
                maxChildren = childCount;
                bestRootId = pid;
            }
        }

        // Set isRootAncestor flag
        await db.update(persons)
            .set({ isRootAncestor: true })
            .where(eq(persons.id, bestRootId));
    }

    // Update tree stats
    await db.update(trees)
        .set({
            personCount: indiRecords.length,
            relationshipCount: relCount,
            updatedAt: new Date(),
        })
        .where(eq(trees.id, treeId));

    return {
        treeId,
        personsCount: indiRecords.length,
        familiesCount: famRecords.length,
        relationshipsCount: relCount,
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT — Read from DB and generate GEDCOM 7.0 content
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Export a tree to GEDCOM 7.0 format
 */
export async function exportGedcom(treeId: string): Promise<string> {
    // Fetch tree
    const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
    if (!tree) throw new Error('Tree not found');

    // Fetch all persons and relationships for this tree
    const allPersons = await db.select().from(persons).where(eq(persons.treeId, treeId));
    const allRelationships = await db.select().from(relationships).where(eq(relationships.treeId, treeId));

    // Build UUID → GEDCOM XREF maps
    const personIdToXref = new Map<string, string>();
    allPersons.forEach((p, i) => {
        const xref = p.gedcomId || `I${(i + 1).toString().padStart(4, '0')}`;
        personIdToXref.set(p.id, xref);
    });

    // Group relationships by GEDCOM family ID to reconstruct FAM records
    const famMap = new Map<string, {
        id: string;
        husbId?: string;
        wifeId?: string;
        childIds: string[];
        marriageDate?: string | null;
        marriagePlace?: string | null;
        divorceDate?: string | null;
    }>();

    // Process spouse relationships first (they define the family)
    const spouseRels = allRelationships.filter(r => r.type === 'spouse');
    spouseRels.forEach((rel, i) => {
        const famXref = rel.gedcomFamilyId || `F${(i + 1).toString().padStart(4, '0')}`;
        famMap.set(famXref, {
            id: famXref,
            husbId: rel.person1Id,
            wifeId: rel.person2Id,
            childIds: [],
            marriageDate: rel.marriageDate,
            marriagePlace: rel.marriagePlace,
            divorceDate: rel.divorceDate,
        });
    });

    // Add children from parent-child relationships
    const parentChildRels = allRelationships.filter(r => r.type === 'parent-child');
    for (const rel of parentChildRels) {
        // Find which family this parent belongs to
        for (const [, fam] of famMap.entries()) {
            if (fam.husbId === rel.person1Id || fam.wifeId === rel.person1Id) {
                if (!fam.childIds.includes(rel.person2Id)) {
                    fam.childIds.push(rel.person2Id);
                }
                break;
            }
        }
    }

    // Build GEDCOM output
    const lines: string[] = [];

    // Header
    lines.push('0 HEAD');
    lines.push('1 GEDC');
    lines.push('2 VERS 7.0');
    lines.push('1 SOUR WIJA');
    lines.push('2 VERS 3.0');
    lines.push('2 NAME WIJA Family Tree Application');
    lines.push(`1 DATE ${formatGedcomDate(new Date())}`);
    lines.push('1 CHAR UTF-8');

    // Individual records
    for (const person of allPersons) {
        const xref = personIdToXref.get(person.id)!;
        lines.push(`0 @${xref}@ INDI`);

        // Name: rebuild as "Given /Surname/"
        const given = [person.firstName, person.middleName].filter(Boolean).join(' ');
        const surname = person.lastName || '';
        if (given || surname) {
            lines.push(`1 NAME ${given} /${surname}/`.trim());
        }

        // Sex
        if (person.gender && person.gender !== 'unknown') {
            lines.push(`1 SEX ${mapGenderToSex(person.gender)}`);
        }

        // Birth
        if (person.birthDate || person.birthPlace) {
            lines.push('1 BIRT');
            if (person.birthDate) lines.push(`2 DATE ${person.birthDate}`);
            if (person.birthPlace) lines.push(`2 PLAC ${person.birthPlace}`);
        }

        // Death
        if (person.deathDate || person.deathPlace) {
            lines.push('1 DEAT');
            if (person.deathDate) lines.push(`2 DATE ${person.deathDate}`);
            if (person.deathPlace) lines.push(`2 PLAC ${person.deathPlace}`);
        }

        // Occupation
        if (person.occupation) {
            lines.push(`1 OCCU ${person.occupation}`);
        }

        // Title (royal/reign title)
        if (person.reignTitle) {
            lines.push(`1 TITL ${person.reignTitle}`);
        }

        // Notes (biography)
        if (person.biography) {
            lines.push(`1 NOTE ${person.biography}`);
        }
    }

    // Family records
    for (const [famXref, fam] of famMap.entries()) {
        lines.push(`0 @${famXref}@ FAM`);

        if (fam.husbId && personIdToXref.has(fam.husbId)) {
            lines.push(`1 HUSB @${personIdToXref.get(fam.husbId)}@`);
        }

        if (fam.wifeId && personIdToXref.has(fam.wifeId)) {
            lines.push(`1 WIFE @${personIdToXref.get(fam.wifeId)}@`);
        }

        for (const childId of fam.childIds) {
            if (personIdToXref.has(childId)) {
                lines.push(`1 CHIL @${personIdToXref.get(childId)}@`);
            }
        }

        if (fam.marriageDate || fam.marriagePlace) {
            lines.push('1 MARR');
            if (fam.marriageDate) lines.push(`2 DATE ${fam.marriageDate}`);
            if (fam.marriagePlace) lines.push(`2 PLAC ${fam.marriagePlace}`);
        }

        if (fam.divorceDate) {
            lines.push('1 DIV');
            lines.push(`2 DATE ${fam.divorceDate}`);
        }
    }

    // Trailer
    lines.push('0 TRLR');

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATE — Parse and return summary without importing
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate GEDCOM content and return summary
 */
export function validateGedcom(content: string): GedcomValidationResult {
    try {
        const records = parseGedcom(content);

        return {
            valid: true,
            summary: {
                totalRecords: records.length,
                persons: records.filter(r => r.tag === 'INDI').length,
                families: records.filter(r => r.tag === 'FAM').length,
                sources: records.filter(r => r.tag === 'SOUR').length,
            },
        };
    } catch {
        return {
            valid: false,
            summary: { totalRecords: 0, persons: 0, families: 0, sources: 0 },
            error: 'Invalid GEDCOM format',
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format a JS Date as a GEDCOM date string (e.g. "10 FEB 2026")
 */
function formatGedcomDate(date: Date): string {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
