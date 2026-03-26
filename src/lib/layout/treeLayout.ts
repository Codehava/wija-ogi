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
    for (const parentId of newPerson.relationships.parentIds) {
        const parentPos = existingPositions.get(parentId);
        if (parentPos) {
            const siblingCount = personsMap.get(parentId)?.relationships.childIds.length ?? 1;
            const offsetX = (Math.random() - 0.5) * (siblingCount * 50);
            return {
                x: parentPos.x + offsetX,
                y: parentPos.y + NODE_HEIGHT + 100 + Math.random() * 50
            };
        }
    }

    for (const spouseId of newPerson.relationships.spouseIds) {
        const spousePos = existingPositions.get(spouseId);
        if (spousePos) {
            return {
                x: spousePos.x + NODE_WIDTH + 30,
                y: spousePos.y
            };
        }
    }

    if (existingPositions.size > 0) {
        let minX = Infinity;
        let maxY = 0;
        existingPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxY = Math.max(maxY, pos.y);
        });
        return {
            x: minX + (Math.random() * 100),
            y: maxY + NODE_HEIGHT + 80 + (Math.random() * 50)
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
