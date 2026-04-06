import { Person } from '@/types';

export interface NodePosition {
    x: number;
    y: number;
    isClone?: boolean;
    cloneOf?: string;
}

export interface LayoutResult {
    positions: Map<string, NodePosition>;
    clones: Map<string, string>;
}

export interface ViewportInfo {
    pan: { x: number; y: number };
    zoom: number;
    containerWidth: number;
    containerHeight: number;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 100;

/**
 * Calculate a simple position for a new person without running full layout.
 * This is O(1) and should be used when adding new persons to avoid delays.
 */
export function calculateSimplePosition(
    newPerson: Person,
    existingPositions: Map<string, NodePosition>,
    personsMap: Map<string, Person>,
    viewport?: ViewportInfo
): NodePosition {
    // 1. If it's a child, place them below parents
    for (const parentId of newPerson.relationships.parentIds) {
        const parentPos = existingPositions.get(parentId);
        if (parentPos) {
            const siblingCount = personsMap.get(parentId)?.relationships.childIds?.length || 1;
            const offsetX = (Math.random() - 0.5) * (siblingCount * 50);
            return {
                x: parentPos.x + offsetX,
                y: parentPos.y + NODE_HEIGHT + 100 + Math.random() * 20
            };
        }
    }

    // 2. If it's a parent, place them above children
    if (newPerson.relationships.childIds) {
        for (const childId of newPerson.relationships.childIds) {
            const childPos = existingPositions.get(childId);
            if (childPos) {
                return {
                    x: childPos.x + (Math.random() - 0.5) * 50,
                    y: childPos.y - NODE_HEIGHT - 100 - Math.random() * 20
                };
            }
        }
    }

    // 3. If it's a spouse, place them next to their partner
    for (const spouseId of newPerson.relationships.spouseIds) {
        const spousePos = existingPositions.get(spouseId);
        if (spousePos) {
            return {
                x: spousePos.x + NODE_WIDTH + 60,
                y: spousePos.y
            };
        }
    }

    // 4. Fallbacks: Wait to see if we can find them as a child/parent/spouse of SOME OTHER person in the map
    for (const [existingId, existingPerson] of personsMap.entries()) {
        if (!existingPositions.has(existingId)) continue;
        
        // If the new person is a parent of this existing person
        if (existingPerson.relationships.parentIds.includes(newPerson.personId)) {
            const childPos = existingPositions.get(existingId)!;
             return {
                x: childPos.x + (Math.random() - 0.5) * 50,
                y: childPos.y - NODE_HEIGHT - 100 - Math.random() * 20
            };
        }
        
        // If the new person is a child of this existing person
        if (existingPerson.relationships.childIds.includes(newPerson.personId)) {
            const parentPos = existingPositions.get(existingId)!;
             return {
                x: parentPos.x + (Math.random() - 0.5) * 50,
                y: parentPos.y + NODE_HEIGHT + 100 + Math.random() * 20
            };
        }
        
        // If the new person is a spouse of this existing person
        if (existingPerson.relationships.spouseIds.includes(newPerson.personId)) {
            const spousePos = existingPositions.get(existingId)!;
             return {
                x: spousePos.x + NODE_WIDTH + 60,
                y: spousePos.y
            };
        }
    }

    // 5. Still disconnected. Try to use viewport center if provided
    if (viewport && viewport.zoom !== undefined) {
        const centerX = (viewport.containerWidth / 2 - viewport.pan.x) / viewport.zoom;
        const centerY = (viewport.containerHeight / 2 - viewport.pan.y) / viewport.zoom;
        return {
            x: centerX - NODE_WIDTH / 2 + (Math.random() * 40 - 20),
            y: centerY - NODE_HEIGHT / 2 + (Math.random() * 40 - 20)
        };
    }

    // 6. Absolute last fallback: near the bottom or center of bounds
    if (existingPositions.size > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        existingPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });
        
        return {
            x: (minX + maxX) / 2 + (Math.random() * 100 - 50),
            y: maxY + NODE_HEIGHT + 100 + (Math.random() * 50)
        };
    }

    return {
        x: 100 + Math.random() * 50,
        y: 100 + Math.random() * 50
    };
}

export interface EdgeSettings {
    parentChildColor: string;
    parentChildWidth: number;
    parentChildOpacity: number;
    spouseColor: string;
    spouseWidth: number;
    edgeType: 'default' | 'straight' | 'step' | 'smoothstep';
    connectorStyle: 'individual' | 'fork' | 'elbow' | 'busbar';
    edgeBundling: boolean;
}

export const DEFAULT_EDGE_SETTINGS: EdgeSettings = {
    parentChildColor: '#0d9488',
    parentChildWidth: 1.8,
    parentChildOpacity: 0.65,
    spouseColor: '#dc2626',
    spouseWidth: 2,
    edgeType: 'default',
    connectorStyle: 'individual',
    edgeBundling: false,
};
