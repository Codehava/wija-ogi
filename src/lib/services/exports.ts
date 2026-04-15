// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Export Service (PostgreSQL / Drizzle)
// Handles family tree export to SVG/PDF and other formats
// ═══════════════════════════════════════════════════════════════════════════════

import { ExportOptions, Person, Relationship, Family } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT RECORD TYPE (no longer in Firestore — tracked in-memory or via DB later)
// ─────────────────────────────────────────────────────────────────────────────────

export interface ExportRecord {
    exportId: string;
    familyId: string;
    options: ExportOptions;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    requestedBy: string;
    createdAt: Date;
    completedAt?: Date;
    error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATE TREE DATA FOR EXPORT
// ─────────────────────────────────────────────────────────────────────────────────

export interface ExportTreeData {
    family: Family;
    persons: Person[];
    relationships: Relationship[];
    generationsMap: Map<string, number>;
    rootAncestor?: Person;
}

export function prepareExportData(
    family: Family,
    persons: Person[],
    relationships: Relationship[],
    generationsMap: Map<string, number>,
    options: ExportOptions
): ExportTreeData {
    let filteredPersons = [...persons];
    let filteredRelationships = [...relationships];

    // Filter by scope
    if (options.scope === 'from_ancestor' && options.rootPersonId) {
        // Get descendants from specific ancestor
        const descendantIds = getDescendantIds(options.rootPersonId, persons);
        filteredPersons = persons.filter(p => descendantIds.has(p.personId));
        filteredRelationships = relationships.filter(r =>
            descendantIds.has(r.person1Id) && descendantIds.has(r.person2Id)
        );
    } else if (options.scope === 'subtree' && options.rootPersonId) {
        // Get subtree (ancestors + descendants)
        const subtreeIds = getSubtreeIds(options.rootPersonId, persons);
        filteredPersons = persons.filter(p => subtreeIds.has(p.personId));
        filteredRelationships = relationships.filter(r =>
            subtreeIds.has(r.person1Id) && subtreeIds.has(r.person2Id)
        );
    }

    const rootAncestor = persons.find(p => p.isRootAncestor);

    return {
        family,
        persons: filteredPersons,
        relationships: filteredRelationships,
        generationsMap,
        rootAncestor
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Get all descendant IDs from a person
// ─────────────────────────────────────────────────────────────────────────────────

function getDescendantIds(rootId: string, persons: Person[]): Set<string> {
    const personsMap = new Map(persons.map(p => [p.personId, p]));
    const descendants = new Set<string>([rootId]);
    const queue = [rootId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const current = personsMap.get(currentId);

        if (current) {
            // Add children
            for (const childId of current.relationships.childIds) {
                if (!descendants.has(childId)) {
                    descendants.add(childId);
                    queue.push(childId);
                }
            }

            // Add spouses (they're part of the tree visualization)
            for (const spouseId of current.relationships.spouseIds) {
                descendants.add(spouseId);
            }
        }
    }

    return descendants;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Get subtree IDs (ancestors + descendants)
// ─────────────────────────────────────────────────────────────────────────────────

function getSubtreeIds(centerId: string, persons: Person[]): Set<string> {
    const personsMap = new Map(persons.map(p => [p.personId, p]));
    const subtree = new Set<string>([centerId]);

    // Get ancestors
    const ancestorQueue = [centerId];
    while (ancestorQueue.length > 0) {
        const currentId = ancestorQueue.shift()!;
        const current = personsMap.get(currentId);

        if (current) {
            for (const parentId of current.relationships.parentIds) {
                if (!subtree.has(parentId)) {
                    subtree.add(parentId);
                    ancestorQueue.push(parentId);
                }
            }
        }
    }

    // Get descendants
    const descendantQueue = [centerId];
    while (descendantQueue.length > 0) {
        const currentId = descendantQueue.shift()!;
        const current = personsMap.get(currentId);

        if (current) {
            for (const childId of current.relationships.childIds) {
                if (!subtree.has(childId)) {
                    subtree.add(childId);
                    descendantQueue.push(childId);
                }
            }

            for (const spouseId of current.relationships.spouseIds) {
                subtree.add(spouseId);
            }
        }
    }

    return subtree;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATE SVG FOR TREE (Client-side rendering)
// ─────────────────────────────────────────────────────────────────────────────────

export interface TreeSVGOptions {
    width: number;
    height: number;
    scriptMode: 'latin' | 'lontara' | 'both';
    nodeWidth: number;
    nodeHeight: number;
    horizontalGap: number;
    verticalGap: number;
}

export function generateTreeSVG(
    data: ExportTreeData,
    options: TreeSVGOptions
): string {
    const { persons, relationships, generationsMap } = data;
    const { width, height, nodeWidth, nodeHeight, horizontalGap, verticalGap, scriptMode } = options;

    // Group by generation
    const byGeneration = new Map<number, Person[]>();
    persons.forEach(p => {
        const gen = generationsMap.get(p.personId) ?? 0;
        if (!byGeneration.has(gen)) byGeneration.set(gen, []);
        byGeneration.get(gen)!.push(p);
    });

    // Calculate positions
    const positions = new Map<string, { x: number; y: number }>();
    const sortedGens = Array.from(byGeneration.keys()).sort((a, b) => a - b);

    sortedGens.forEach((gen, genIndex) => {
        const personsInGen = byGeneration.get(gen) || [];
        const rowWidth = personsInGen.length * (nodeWidth + horizontalGap);
        const startX = (width - rowWidth) / 2 + nodeWidth / 2;

        personsInGen.forEach((person, index) => {
            positions.set(person.personId, {
                x: startX + index * (nodeWidth + horizontalGap),
                y: 50 + genIndex * (nodeHeight + verticalGap)
            });
        });
    });

    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Styles
    svg += `
    <style>
      .node-rect { fill: white; stroke: #d1d5db; stroke-width: 2; rx: 8; }
      .node-male { stroke: #3b82f6; }
      .node-female { stroke: #ec4899; }
      .node-name { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; fill: #1f2937; }
      .node-lontara { font-family: 'Noto Sans Buginese', serif; font-size: 10px; fill: #92400e; }
      .rel-line { stroke: #9ca3af; stroke-width: 1.5; fill: none; }
      .rel-spouse { stroke: #ec4899; stroke-dasharray: 5,3; }
    </style>
  `;

    // Draw relationship lines
    relationships.forEach(rel => {
        const pos1 = positions.get(rel.person1Id);
        const pos2 = positions.get(rel.person2Id);

        if (pos1 && pos2) {
            const lineClass = rel.type === 'spouse' ? 'rel-line rel-spouse' : 'rel-line';
            svg += `<path class="${lineClass}" d="M ${pos1.x} ${pos1.y + nodeHeight / 2} L ${pos2.x} ${pos2.y + nodeHeight / 2}" />`;
        }
    });

    // Draw person nodes
    persons.forEach(person => {
        const pos = positions.get(person.personId);
        if (!pos) return;

        const genderClass = person.gender === 'male' ? 'node-male' : person.gender === 'female' ? 'node-female' : '';

        // Build full Latin name
        const fullLatinName = [person.firstName, person.middleName, person.lastName]
            .filter(Boolean)
            .join(' ') || person.fullName || person.firstName;

        // Build full Lontara name
        const fullLontaraName = [
            person.lontaraName?.first,
            person.lontaraName?.middle,
            person.lontaraName?.last
        ].filter(Boolean).join(' ');

        svg += `
      <g transform="translate(${pos.x - nodeWidth / 2}, ${pos.y})">
        <rect class="node-rect ${genderClass}" width="${nodeWidth}" height="${nodeHeight}" />
        <text class="node-name" x="${nodeWidth / 2}" y="20" text-anchor="middle">${escapeXml(fullLatinName)}</text>
    `;

        if (scriptMode === 'lontara' || scriptMode === 'both') {
            svg += `<text class="node-lontara" x="${nodeWidth / 2}" y="35" text-anchor="middle">${escapeXml(fullLontaraName)}</text>`;
        }

        svg += `</g>`;
    });

    svg += '</svg>';

    return svg;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export function getDefaultExportOptions(): ExportOptions {
    return {
        scope: 'full',
        scriptOptions: {
            script: 'both',
            lontaraPosition: 'below'
        },
        content: {
            includePhotos: true,
            includeDates: true,
            includeBiographies: false
        },
        format: {
            paperSize: 'A4',
            orientation: 'landscape',
            quality: 'high'
        }
    };
}

const exportService = {
    prepareExportData,
    generateTreeSVG,
    getDefaultExportOptions
};

export default exportService;
