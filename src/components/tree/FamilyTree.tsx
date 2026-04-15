// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Component (React Flow Edition)
// Professional tree layout using dagre algorithm + React Flow rendering
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    BackgroundVariant,
    type Node,
    type Edge,
    type NodeChange,
    type NodePositionChange,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import jsPDF from 'jspdf';
import { toPng, toJpeg } from 'html-to-image';
import toast from 'react-hot-toast';
import { Person, Relationship, ScriptMode } from '@/types';
import { findRootAncestor, calculateAllGenerations } from '@/lib/generation/calculator';
import { TreeSearch } from './TreeSearch';
import { MaleNode } from './nodes/MaleNode';
import { FemaleNode } from './nodes/FemaleNode';
import { JunctionNode } from './nodes/JunctionNode';
import { BusBarEdge } from './edges/BusBarEdge';
import { calculateSimplePosition, LayoutResult, DEFAULT_EDGE_SETTINGS } from '@/lib/layout/treeLayout';

export interface FamilyTreeProps {
    persons: Person[];
    relationships: Relationship[];
    scriptMode?: ScriptMode;
    onPersonClick?: (person: Person) => void;
    selectedPersonId?: string | null;
    editable?: boolean;
    onAddPerson?: () => void;
    familyName?: string;
    familyId?: string;
    onPositionChange?: (personId: string, position: { x: number; y: number }) => void;
    onAllPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void;
}

// Layout constants
const NODE_WIDTH = 188;
const NODE_HEIGHT = 128;

type AdaptiveSizes = {
    nodeWidth: number;
    nodeHeight: number;
    shapeSize: number;
    textWidth: number;
    fontScale: number;
};
type TextDensityMode = 'readable' | 'compact';

// Adaptive sizing
function getAdaptiveSizes(personCount: number): AdaptiveSizes {
    if (personCount > 200) return { nodeWidth: 132, nodeHeight: 100, shapeSize: 42, textWidth: 136, fontScale: 1 };
    if (personCount > 100) return { nodeWidth: 162, nodeHeight: 114, shapeSize: 50, textWidth: 168, fontScale: 1.08 };
    return { nodeWidth: NODE_WIDTH, nodeHeight: NODE_HEIGHT, shapeSize: 58, textWidth: 188, fontScale: 1.16 };
}

// Custom node types for React Flow
const nodeTypes = {
    male: MaleNode,
    female: FemaleNode,
    junction: JunctionNode,
};

// Custom edge types for React Flow
const edgeTypes = {
    busbar: BusBarEdge,
};

const PAPER_SIZES: Record<'A4' | 'A3' | 'A2' | 'A1' | 'A0', { w: number; h: number }> = {
    A4: { w: 210, h: 297 },
    A3: { w: 297, h: 420 },
    A2: { w: 420, h: 594 },
    A1: { w: 594, h: 841 },
    A0: { w: 841, h: 1189 },
};
const A_SERIES_RATIO = Math.SQRT2;

function hasUsablePersistedPosition(person: Person): boolean {
    if (!person.position || person.position.x === undefined || person.position.y === undefined) return false;
    if (person.position.fixed) return true;
    // DB default for new person is (0,0,false); treat it as unset so auto-placement can run.
    return person.position.x !== 0 || person.position.y !== 0;
}



// ═══════════════════════════════════════════════════════════════════════════════
// Inner component that uses React Flow hooks (must be inside ReactFlowProvider)
// ═══════════════════════════════════════════════════════════════════════════════
function FamilyTreeInner({
    persons,
    relationships,
    scriptMode = 'both',
    onPersonClick,
    selectedPersonId,
    editable = false,
    onAddPerson,
    familyName = 'Pohon Keluarga',
    familyId,
    onPositionChange,
    onAllPositionsChange
}: FamilyTreeProps) {
    const reactFlowInstance = useReactFlow();
    const reactFlowRef = useRef<HTMLDivElement>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
    const [ancestryPathIds, setAncestryPathIds] = useState<Set<string>>(new Set());
    const [hoveredPerson, setHoveredPerson] = useState<{ person: Person; x: number; y: number } | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [exportPaperSize, setExportPaperSize] = useState<'A4' | 'A3' | 'A2' | 'A1' | 'A0'>('A3');
    const [showPaperGuide, setShowPaperGuide] = useState(true);
    const [textDensityMode, setTextDensityMode] = useState<TextDensityMode>('readable');
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [lodLevel, setLodLevel] = useState<number>(2); // P3b: 0=shape, 1=name, 2=full

    // Refs
    const initialLayoutRef = useRef<LayoutResult | null>(null);
    const prevPersonCount = useRef(0);
    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const clonesRef = useRef<Map<string, string>>(new Map());  // R11 clone mappings
    const draggingNodeIdsRef = useRef<Set<string>>(new Set());
    const lastDraggedTimeRef = useRef<Map<string, number>>(new Map());

    // Adaptive sizes
    const adaptiveSizes = useMemo(() => getAdaptiveSizes(persons.length), [persons.length]);

    // Build persons map
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Highlighted IDs set
    const highlightedSet = useMemo(() => new Set(highlightedIds), [highlightedIds]);

    // Get saved positions
    const savedPositions = useMemo(() => {
        const map = new Map<string, { x: number; y: number }>();
        persons.forEach(p => {
            if (hasUsablePersistedPosition(p)) {
                map.set(p.personId, { x: p.position.x, y: p.position.y });
            }
        });
        return map;
    }, [persons]);

    // Detect GEDCOM imports
    useEffect(() => {
        const currentCount = persons.length;
        const prevCount = prevPersonCount.current;
        if (prevCount > 0 && currentCount > prevCount + 10) {
            initialLayoutRef.current = null;
            setIsInitialized(false);
        }
        prevPersonCount.current = currentCount;
    }, [persons.length]);

    // Calculate layout (cached)
    const getInitialDagreLayout = useCallback(() => {
        if (initialLayoutRef.current) return initialLayoutRef.current;
        const hasArrangedPositions = persons.some(p => hasUsablePersistedPosition(p));
        if (hasArrangedPositions) {
            initialLayoutRef.current = { positions: new Map(), clones: new Map() };
            return initialLayoutRef.current;
        }

        const positions = new Map<string, { x: number; y: number }>();
        const clones = new Map<string, string>();

        // Simple Top-to-Bottom Grid Layout
        // Use a grid layout to avoid sprawling, max 8 columns based on the scale
        const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(persons.length))));
        const horizontalGap = Math.max(42, Math.round(adaptiveSizes.nodeWidth * 0.34));
        const verticalGap = Math.max(48, Math.round(adaptiveSizes.nodeHeight * 0.48));

        persons.forEach((p, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            positions.set(p.personId, {
                x: 50 + col * (adaptiveSizes.nodeWidth + horizontalGap),
                y: 50 + row * (adaptiveSizes.nodeHeight + verticalGap)
            });
        });

        initialLayoutRef.current = { positions, clones };
        clonesRef.current = clones;
        return initialLayoutRef.current;
    }, [persons, adaptiveSizes.nodeWidth, adaptiveSizes.nodeHeight]);

    // Ancestry path tracing
    const traceAncestryPath = useCallback((personId: string): Set<string> => {
        const path = new Set<string>();
        const visited = new Set<string>();
        const queue = [personId];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            path.add(currentId);
            const person = personsMap.get(currentId);
            if (!person) continue;
            person.relationships.parentIds.forEach(parentId => {
                if (!visited.has(parentId)) queue.push(parentId);
            });
        }
        return path;
    }, [personsMap]);

    // Convert persons + positions to React Flow nodes and edges
    const buildNodesAndEdges = useCallback((
        posMap: Map<string, { x: number; y: number }>,
        currentSelectedId: string | null | undefined,
        currentHighlighted: Set<string>,
        currentAncestryPath: Set<string>,
        currentScriptMode: string,
        currentAdaptiveSizes: AdaptiveSizes,
        currentTextDensityMode: TextDensityMode,
    ) => {
        const rfNodes: Node[] = [];
        const rfEdges: Edge[] = [];
        const drawnPairs = new Set<string>();
        // Map: "parentId1-parentId2" (sorted) → junction node ID
        const coupleJunctions = new Map<string, string>();

        // Build person nodes
        persons.forEach(person => {
            const pos = posMap.get(person.personId);
            if (!pos) return;

            const displayName = [person.firstName, person.middleName, person.lastName]
                .filter(Boolean).join(' ') || person.fullName || person.firstName || 'N/A';
            const lontaraFullName = person.lontaraName
                ? [person.lontaraName.first, person.lontaraName.middle, person.lontaraName.last].filter(Boolean).join(' ')
                : '';

            rfNodes.push({
                id: person.personId,
                type: person.gender === 'female' ? 'female' : 'male',
                position: { x: pos.x, y: pos.y },
                data: {
                    label: displayName,
                    person: {
                        personId: person.personId,
                        firstName: person.firstName,
                        fullName: person.fullName,
                        gender: person.gender,
                        photoUrl: person.photoUrl,
                        lontaraName: person.lontaraName,
                        biography: person.biography,
                        title: person.title,
                        reignTitle: person.reignTitle,
                    },
                    displayName,
                    lontaraFullName,
                    shapeSize: currentAdaptiveSizes.shapeSize,
                    nodeTextWidth: currentAdaptiveSizes.textWidth,
                    fontScale: currentAdaptiveSizes.fontScale,
                    textDensityMode: currentTextDensityMode,
                    scriptMode: currentScriptMode,
                    isSelected: person.personId === currentSelectedId,
                    isHighlighted: currentHighlighted.has(person.personId),
                    isOnAncestryPath: currentAncestryPath.has(person.personId),
                    hasAncestryActive: currentAncestryPath.size > 0,
                    onHover: (rect: DOMRect) => {
                        setHoveredPerson({ person, x: rect.right + 8, y: rect.top });
                    },
                    onHoverEnd: () => setHoveredPerson(null),
                },
            });
        });

        // ── R11: Build clone ghost nodes ──
        for (const [cloneId, originalId] of clonesRef.current) {
            const pos = posMap.get(cloneId);
            if (!pos) continue;
            const original = personsMap.get(originalId);
            if (!original) continue;

            const displayName = [original.firstName, original.middleName, original.lastName]
                .filter(Boolean).join(' ') || original.fullName || original.firstName || 'N/A';
            const lontaraFullName = original.lontaraName
                ? [original.lontaraName.first, original.lontaraName.middle, original.lontaraName.last].filter(Boolean).join(' ')
                : '';

            rfNodes.push({
                id: cloneId,
                type: original.gender === 'female' ? 'female' : 'male',
                position: { x: pos.x, y: pos.y },
                style: { opacity: 0.45, filter: 'grayscale(0.6)' },
                data: {
                    label: `${displayName} ⧉`,
                    person: {
                        personId: cloneId,
                        firstName: original.firstName,
                        fullName: original.fullName,
                        gender: original.gender,
                        photoUrl: original.photoUrl,
                        lontaraName: original.lontaraName,
                        biography: original.biography,
                        title: original.title,
                        reignTitle: original.reignTitle,
                    },
                    displayName: `${displayName} ⧉`,
                    lontaraFullName,
                    shapeSize: currentAdaptiveSizes.shapeSize,
                    nodeTextWidth: currentAdaptiveSizes.textWidth,
                    fontScale: currentAdaptiveSizes.fontScale,
                    textDensityMode: currentTextDensityMode,
                    scriptMode: currentScriptMode,
                    isSelected: false,
                    isHighlighted: false,
                    isOnAncestryPath: false,
                    hasAncestryActive: false,
                    isClone: true,
                    cloneOf: originalId,
                    onHover: () => { },
                    onHoverEnd: () => { },
                },
            });
        }

        // ── Build spouse edges + junction nodes ──
        // Single Bezier curve from husband to wife.
        // Junction node only used as invisible anchor for child edges.
        persons.forEach(person => {
            if (!posMap.has(person.personId)) return; // Skip hidden/unmapped nodes

            person.relationships.spouseIds.forEach(spouseId => {
                const coupleKey = [person.personId, spouseId].sort().join('-');
                if (drawnPairs.has(coupleKey)) return;
                drawnPairs.add(coupleKey);

                const pos1 = posMap.get(person.personId);
                const pos2 = posMap.get(spouseId);
                if (!pos1 || !pos2) return;

                // Determine left/right
                const leftId = pos1.x < pos2.x ? person.personId : spouseId;
                const rightId = pos1.x < pos2.x ? spouseId : person.personId;
                const leftPos = pos1.x < pos2.x ? pos1 : pos2;
                const rightPos = pos1.x < pos2.x ? pos2 : pos1;

                // Determine spouse edge type — respect connector style (E7)
                const spouseConnector = DEFAULT_EDGE_SETTINGS.connectorStyle;
                let spouseEdgeType: string = DEFAULT_EDGE_SETTINGS.edgeType;
                if (spouseConnector === 'busbar') {
                    spouseEdgeType = 'step';             // Bus-bar: use step for spouse (busbar only for parent-child)
                } else if (spouseConnector === 'fork') {
                    spouseEdgeType = 'step';             // Fork: right-angle
                } else if (spouseConnector === 'elbow') {
                    spouseEdgeType = 'smoothstep';       // Elbow: rounded step
                }

                // Spouse edge: left spouse → right spouse
                rfEdges.push({
                    id: `spouse-${coupleKey}`,
                    source: leftId,
                    target: rightId,
                    sourceHandle: 'right',
                    targetHandle: 'left',
                    type: spouseEdgeType,
                    style: { stroke: DEFAULT_EDGE_SETTINGS.spouseColor, strokeWidth: DEFAULT_EDGE_SETTINGS.spouseWidth },
                });

                // Invisible junction node at midpoint (only for child edge routing)
                const junctionId = `junction-${coupleKey}`;
                const midX = (leftPos.x + rightPos.x + currentAdaptiveSizes.nodeWidth) / 2;
                const midY = (leftPos.y + rightPos.y) / 2 + currentAdaptiveSizes.shapeSize / 2;

                rfNodes.push({
                    id: junctionId,
                    type: 'junction',
                    position: { x: midX, y: midY },
                    data: { label: '' },
                    draggable: false,
                    selectable: false,
                });
                coupleJunctions.set(coupleKey, junctionId);
            });
        });

        // ── Build parent-child edges ──
        // Children connect FROM the couple's junction node (not from individual parents)
        persons.forEach(person => {
            if (!posMap.has(person.personId)) return; // Skip hidden/unmapped nodes
            if (person.relationships.parentIds.length === 0) return;

            const parentIds = person.relationships.parentIds.filter(pid => posMap.has(pid));
            if (parentIds.length === 0) return;

            const childEdgeKey = `child-to-${person.personId}`;
            if (drawnPairs.has(childEdgeKey)) return;
            drawnPairs.add(childEdgeKey);

            // Check ancestry path
            const isOnPath = currentAncestryPath.size > 0 &&
                currentAncestryPath.has(person.personId) &&
                parentIds.some(pid => currentAncestryPath.has(pid));

            // E7: Determine edge type based on connector style
            const connectorStyle = DEFAULT_EDGE_SETTINGS.connectorStyle;
            let parentChildEdgeType: string = DEFAULT_EDGE_SETTINGS.edgeType;
            if (connectorStyle === 'busbar') {
                parentChildEdgeType = 'busbar';      // Orthogonal bus-bar (custom)
            } else if (connectorStyle === 'fork') {
                parentChildEdgeType = 'step';         // Right-angle brackets
            } else if (connectorStyle === 'elbow') {
                parentChildEdgeType = 'smoothstep';   // Manhattan with rounded corners
            }

            const edgeStyle = {
                stroke: isOnPath ? '#f59e0b' : DEFAULT_EDGE_SETTINGS.parentChildColor,
                strokeWidth: isOnPath ? 3 : DEFAULT_EDGE_SETTINGS.parentChildWidth,
                opacity: currentAncestryPath.size > 0 ? (isOnPath ? 1 : Math.min(DEFAULT_EDGE_SETTINGS.parentChildOpacity, 0.3)) : DEFAULT_EDGE_SETTINGS.parentChildOpacity,
            };

            // If child has 2 parents that form a couple, connect from junction
            if (parentIds.length >= 2) {
                const coupleKey = [parentIds[0], parentIds[1]].sort().join('-');
                const junctionId = coupleJunctions.get(coupleKey);

                if (junctionId) {
                    // Connect: junction → child
                    rfEdges.push({
                        id: `child-${coupleKey}-${person.personId}`,
                        source: junctionId,
                        target: person.personId,
                        sourceHandle: 'bottom',
                        targetHandle: 'top',
                        type: parentChildEdgeType,
                        style: edgeStyle,
                    });
                    return;
                }
            }

            // Fallback: single parent → child directly
            const parentId = parentIds[0];
            rfEdges.push({
                id: `child-${parentId}-${person.personId}`,
                source: parentId,
                target: person.personId,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: parentChildEdgeType,
                style: edgeStyle,
            });
        });

        // ── P3a: Edge Bundling (E8) ──
        // When enabled, merge parent-child edges from same source that target
        // children at similar X positions into fewer, thicker bundled edges.
        if (DEFAULT_EDGE_SETTINGS.edgeBundling) {
            const bundleThreshold = 60; // px proximity for bundling
            // Group edges by source node
            const edgesBySource = new Map<string, Edge[]>();
            const nonChildEdges: Edge[] = [];

            for (const edge of rfEdges) {
                if (edge.id.startsWith('child-')) {
                    const group = edgesBySource.get(edge.source) ?? [];
                    group.push(edge);
                    edgesBySource.set(edge.source, group);
                } else {
                    nonChildEdges.push(edge);
                }
            }

            const bundledEdges: Edge[] = [...nonChildEdges];

            for (const [sourceId, edges] of edgesBySource) {
                if (edges.length <= 2) {
                    // Too few to bundle — keep as-is
                    bundledEdges.push(...edges);
                    continue;
                }

                // Sort by target X position
                const withPos = edges.map(e => ({
                    edge: e,
                    targetX: posMap.get(e.target)?.x ?? 0,
                })).sort((a, b) => a.targetX - b.targetX);

                // Greedily merge nearby edges
                let i = 0;
                while (i < withPos.length) {
                    const bundleStart = i;
                    let bundleEndX = withPos[i].targetX;

                    // Extend bundle while next child is within threshold
                    while (i + 1 < withPos.length &&
                        withPos[i + 1].targetX - bundleEndX < bundleThreshold) {
                        i++;
                        bundleEndX = withPos[i].targetX;
                    }

                    const bundleSize = i - bundleStart + 1;

                    if (bundleSize >= 3) {
                        // Create a single bundled edge to the median child
                        const medianIdx = bundleStart + Math.floor(bundleSize / 2);
                        const medianEdge = withPos[medianIdx].edge;

                        bundledEdges.push({
                            ...medianEdge,
                            id: `bundle-${sourceId}-${bundleStart}`,
                            style: {
                                ...medianEdge.style,
                                strokeWidth: Math.min(
                                    (medianEdge.style?.strokeWidth as number ?? 1.8) + bundleSize * 0.3,
                                    6
                                ),
                                opacity: 0.7,
                            },
                        });

                        // Also add thin individual edges for non-median children
                        for (let j = bundleStart; j <= i; j++) {
                            if (j === medianIdx) continue;
                            bundledEdges.push({
                                ...withPos[j].edge,
                                style: {
                                    ...withPos[j].edge.style,
                                    strokeWidth: 0.6,
                                    opacity: 0.3,
                                    strokeDasharray: '3,3',
                                },
                            });
                        }
                    } else {
                        // Not enough to bundle
                        for (let j = bundleStart; j <= i; j++) {
                            bundledEdges.push(withPos[j].edge);
                        }
                    }
                    i++;
                }
            }

            rfEdges.length = 0;
            rfEdges.push(...bundledEdges);
        }

        return { rfNodes, rfEdges };
    }, [persons, personsMap]);

    // Initialize positions and build React Flow nodes/edges
    useEffect(() => {
        if (persons.length === 0) return;

        let posMap: Map<string, { x: number; y: number }>;

        if (!isInitialized) {
            posMap = new Map();
            const hasArrangedPositions = persons.some(p => hasUsablePersistedPosition(p));

            if (hasArrangedPositions) {
                persons.forEach(p => {
                    if (savedPositions.has(p.personId)) {
                        posMap.set(p.personId, savedPositions.get(p.personId)!);
                    } else {
                        const viewport = {
                            pan: { x: reactFlowInstance.getViewport().x, y: reactFlowInstance.getViewport().y },
                            zoom: reactFlowInstance.getViewport().zoom,
                            containerWidth: reactFlowRef.current?.clientWidth || window.innerWidth,
                            containerHeight: reactFlowRef.current?.clientHeight || window.innerHeight,
                        };
                        const simplePos = calculateSimplePosition(p, posMap, personsMap, viewport);
                        posMap.set(p.personId, simplePos);
                    }
                });
            } else {
                const layoutResult = getInitialDagreLayout();
                const dagrePositions = layoutResult.positions;
                persons.forEach(p => {
                    const pos = dagrePositions.get(p.personId);
                    if (pos) {
                        posMap.set(p.personId, pos);
                    } else {
                        const viewport = {
                            pan: { x: reactFlowInstance.getViewport().x, y: reactFlowInstance.getViewport().y },
                            zoom: reactFlowInstance.getViewport().zoom,
                            containerWidth: reactFlowRef.current?.clientWidth || window.innerWidth,
                            containerHeight: reactFlowRef.current?.clientHeight || window.innerHeight,
                        };
                        const simplePos = calculateSimplePosition(p, posMap, personsMap, viewport);
                        posMap.set(p.personId, simplePos);
                    }
                });
            }

            positionsRef.current = posMap;
            setIsInitialized(true);
        } else {
            // Check for new persons and synced positions from server
            posMap = new Map(positionsRef.current);
            let hasChanges = false;

            persons.forEach(p => {
                if (!posMap.has(p.personId)) {
                    const savedPos = savedPositions.get(p.personId);
                    if (savedPos) {
                        posMap.set(p.personId, savedPos);
                    } else {
                        const viewport = {
                            pan: { x: reactFlowInstance.getViewport().x, y: reactFlowInstance.getViewport().y },
                            zoom: reactFlowInstance.getViewport().zoom,
                            containerWidth: reactFlowRef.current?.clientWidth || window.innerWidth,
                            containerHeight: reactFlowRef.current?.clientHeight || window.innerHeight,
                        };
                        const simplePos = calculateSimplePosition(p, posMap, personsMap, viewport);
                        posMap.set(p.personId, simplePos);
                    }
                    hasChanges = true;
                } else {
                    // Sync positions from server if they exist and are fixed
                    const currentPos = posMap.get(p.personId);
                    const serverPos = savedPositions.get(p.personId);
                    const isDragging = draggingNodeIdsRef.current.has(p.personId);
                    const lastDragged = lastDraggedTimeRef.current.get(p.personId) || 0;
                    const recentlyDragged = Date.now() - lastDragged < 5000; // 5 second cooldown
                    
                    if (serverPos && currentPos && !isDragging && !recentlyDragged && (Math.abs(currentPos.x - serverPos.x) > 1 || Math.abs(currentPos.y - serverPos.y) > 1)) {
                        posMap.set(p.personId, serverPos);
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                positionsRef.current = posMap;
            } else {
                posMap = positionsRef.current;
            }
        }

        const { rfNodes, rfEdges } = buildNodesAndEdges(
            posMap,
            selectedPersonId,
            highlightedSet,
            ancestryPathIds,
            scriptMode || 'both',
            adaptiveSizes,
            textDensityMode,
        );

        setNodes(rfNodes);
        setEdges(rfEdges);

        // Fit view on first load
        if (!isInitialized || prevPersonCount.current === 0) {
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.15 });
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persons, isInitialized, selectedPersonId, highlightedSet, ancestryPathIds, scriptMode, adaptiveSizes, textDensityMode, buildNodesAndEdges]);

    // Handle node position changes (drag)
    const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
        onNodesChange(changes);

        // Update our position ref when nodes are dragged
        const posChanges = changes.filter(
            (c): c is NodePositionChange => c.type === 'position' && c.position !== undefined
        );
        if (posChanges.length > 0) {
            const newPosMap = new Map(positionsRef.current);
            posChanges.forEach(change => {
                if (change.position) {
                    newPosMap.set(change.id, { x: change.position.x, y: change.position.y });
                }
            });
            positionsRef.current = newPosMap;

            // Recalculate junction positions when spouse nodes are dragged
            const draggedPersonIds = posChanges
                .filter(c => c.position && !c.id.startsWith('junction-'))
                .map(c => c.id);

            if (draggedPersonIds.length > 0) {
                setNodes(prevNodes => {
                    const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
                    let changed = false;

                    draggedPersonIds.forEach(personId => {
                        const person = personsMap.get(personId);
                        if (!person) return;

                        person.relationships.spouseIds.forEach(spouseId => {
                            const coupleKey = [personId, spouseId].sort().join('-');
                            const junctionId = `junction-${coupleKey}`;
                            const junctionNode = nodeMap.get(junctionId);
                            if (!junctionNode) return;

                            // Get current positions of both spouses from the live node positions
                            const personNode = nodeMap.get(personId);
                            const spouseNode = nodeMap.get(spouseId);
                            if (!personNode || !spouseNode) return;

                            // Determine left/right consistently (same as initial layout)
                            const p1 = personNode.position;
                            const p2 = spouseNode.position;
                            const leftPos = p1.x < p2.x ? p1 : p2;
                            const rightPos = p1.x < p2.x ? p2 : p1;

                            // Midpoint between right-handle of left spouse and left-handle of right spouse
                            const midX = (leftPos.x + rightPos.x + adaptiveSizes.nodeWidth) / 2;
                            // Stay at vertical midpoint of both spouses (follows the Bezier curve center)
                            const midY = (leftPos.y + rightPos.y) / 2 + adaptiveSizes.shapeSize / 2;

                            if (junctionNode.position.x !== midX || junctionNode.position.y !== midY) {
                                nodeMap.set(junctionId, {
                                    ...junctionNode,
                                    position: { x: midX, y: midY },
                                });
                                changed = true;
                            }
                        });
                    });

                    return changed ? Array.from(nodeMap.values()) : prevNodes;
                });
            }
        }
    }, [onNodesChange, personsMap, adaptiveSizes, setNodes]);

    const handleNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
        draggingNodeIdsRef.current.add(node.id);
    }, []);

    // Save positions after drag ends
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
        draggingNodeIdsRef.current.delete(node.id);
        lastDraggedTimeRef.current.set(node.id, Date.now());
        if (onPositionChange) {
            onPositionChange(node.id, { x: node.position.x, y: node.position.y });
        }
    }, [onPositionChange]);

    const handleSelectionDragStart = useCallback((_event: React.MouseEvent, nodes: Node[]) => {
        nodes.forEach(n => draggingNodeIdsRef.current.add(n.id));
    }, []);

    const handleSelectionDragStop = useCallback((_event: React.MouseEvent, nodes: Node[]) => {
        const positionsToUpdate = new Map<string, { x: number; y: number }>();
        const now = Date.now();
        nodes.forEach(node => {
            draggingNodeIdsRef.current.delete(node.id);
            lastDraggedTimeRef.current.set(node.id, now);
            positionsToUpdate.set(node.id, { x: node.position.x, y: node.position.y });
        });

        if (onAllPositionsChange && positionsToUpdate.size > 0) {
            onAllPositionsChange(positionsToUpdate);
        }
    }, [onAllPositionsChange]);

    // Handle node click
    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        const person = personsMap.get(node.id);
        if (person) {
            onPersonClick?.(person);
            setAncestryPathIds(traceAncestryPath(person.personId));
        }
    }, [personsMap, onPersonClick, traceAncestryPath]);

    // Clear ancestry on pane click
    const handlePaneClick = useCallback(() => {
        setAncestryPathIds(new Set());
        setHoveredPerson(null);
    }, []);

    // Focus on person (for search)
    const focusOnPerson = useCallback((personId: string) => {
        const pos = positionsRef.current.get(personId);
        if (!pos) return;

        reactFlowInstance.setCenter(pos.x + adaptiveSizes.nodeWidth / 2, pos.y + adaptiveSizes.nodeHeight / 2, {
            zoom: Math.max(reactFlowInstance.getZoom(), 0.8),
            duration: 500,
        });
        setHighlightedIds([personId]);
    }, [reactFlowInstance, adaptiveSizes.nodeWidth, adaptiveSizes.nodeHeight]);

    const treeAspectRatio = useMemo(() => {
        const personNodes = nodes.filter(node => node.type === 'male' || node.type === 'female');
        if (personNodes.length === 0) return NODE_WIDTH / NODE_HEIGHT;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        personNodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + adaptiveSizes.nodeWidth);
            maxY = Math.max(maxY, node.position.y + adaptiveSizes.nodeHeight);
        });

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return width / height;
    }, [nodes, adaptiveSizes.nodeWidth, adaptiveSizes.nodeHeight]);

    // Canvas guide follows paper ratio (A-series), independent from paper size selection.
    const guideLayout = useMemo(() => {
        const portraitAspect = 1 / A_SERIES_RATIO;
        const landscapeAspect = A_SERIES_RATIO;
        const isLandscape = Math.abs(treeAspectRatio - landscapeAspect) <= Math.abs(treeAspectRatio - portraitAspect);

        return {
            isLandscape,
            targetAspect: isLandscape ? landscapeAspect : portraitAspect,
            pageW: isLandscape ? A_SERIES_RATIO : 1,
            pageH: isLandscape ? 1 : A_SERIES_RATIO,
        };
    }, [treeAspectRatio]);

    // Selected paper size is used only for physical output dimensions.
    const paperLayout = useMemo(() => {
        const paper = PAPER_SIZES[exportPaperSize] ?? PAPER_SIZES.A3;
        const portraitW = Math.min(paper.w, paper.h);
        const portraitH = Math.max(paper.w, paper.h);

        return {
            pageW: guideLayout.isLandscape ? portraitH : portraitW,
            pageH: guideLayout.isLandscape ? portraitW : portraitH,
            isLandscape: guideLayout.isLandscape,
            targetAspect: guideLayout.targetAspect,
        };
    }, [exportPaperSize, guideLayout]);

    const getTreeBounds = useCallback(() => {
        const posMap = positionsRef.current;
        if (posMap.size === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        posMap.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + adaptiveSizes.nodeWidth + 24);
            maxY = Math.max(maxY, pos.y + adaptiveSizes.nodeHeight + 32);
        });

        const padding = Math.max(64, Math.round(adaptiveSizes.nodeWidth * 0.36));
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }, [adaptiveSizes.nodeWidth, adaptiveSizes.nodeHeight]);

    // PDF Export (WYSIWYG — hi-res capture, multi-page, print-quality)
    const handleExportPDF = useCallback(async () => {
        if (isExporting || persons.length === 0) return;
        setIsExporting(true);
        toast('📸 Mempersiapkan PDF print-quality...', { duration: 4000 });

        try {
            const container = reactFlowRef.current;
            if (!container) throw new Error('React Flow container not found');

            // Save original state
            const prevViewport = reactFlowInstance.getViewport();
            const prevWidth = container.style.width;
            const prevHeight = container.style.height;
            const prevPosition = container.style.position;
            const prevOverflow = container.style.overflow;

            const bounds = getTreeBounds();
            if (!bounds) throw new Error('Tree bounds are empty');

            let { minX, minY, maxX, maxY, width: treeWidth, height: treeHeight } = bounds;
            const targetAspect = paperLayout.targetAspect;
            const currentAspect = treeWidth / Math.max(1, treeHeight);

            // Extend capture area to match paper aspect ratio so exported PDF fills page better.
            if (currentAspect > targetAspect) {
                const targetHeight = treeWidth / targetAspect;
                const extra = targetHeight - treeHeight;
                minY -= extra / 2;
                maxY += extra / 2;
            } else {
                const targetWidth = treeHeight * targetAspect;
                const extra = targetWidth - treeWidth;
                minX -= extra / 2;
                maxX += extra / 2;
            }

            treeWidth = maxX - minX;
            treeHeight = maxY - minY;

            // Higher zoom = more readable nodes for print
            const exportZoom = persons.length > 150 ? 1.0 : persons.length > 50 ? 1.5 : 2.0;

            // Dynamic PIXEL_RATIO per paper size — smaller paper needs lower ratio
            // to avoid exceeding browser canvas limits (~64M pixels safe maximum for modern browsers)
            const PIXEL_RATIO_MAP: Record<string, number> = {
                A4: 2, A3: 2.5, A2: 3, A1: 3.5, A0: 4
            };
            let pixelRatio = PIXEL_RATIO_MAP[exportPaperSize] || 3;

            const canvasWidth = Math.ceil(treeWidth * exportZoom);
            const canvasHeight = Math.ceil(treeHeight * exportZoom);

            // Safety: cap total pixel count to prevent browser canvas crash
            // Increased to 64M (approx 8000x8000) for much sharper exports
            const MAX_TOTAL_PIXELS = 64_000_000;
            const rawPixels = canvasWidth * pixelRatio * canvasHeight * pixelRatio;
            if (rawPixels > MAX_TOTAL_PIXELS) {
                pixelRatio = Math.max(1, Math.floor(Math.sqrt(MAX_TOTAL_PIXELS / (canvasWidth * canvasHeight)) * 10) / 10);
                console.warn(`PDF: Canvas too large, reducing pixelRatio to ${pixelRatio}`);
            }

            // Temporarily expand container to full tree size
            container.style.width = `${canvasWidth}px`;
            container.style.height = `${canvasHeight}px`;
            container.style.position = 'absolute';
            container.style.overflow = 'hidden';

            // Set viewport so entire tree is visible at our chosen zoom
            reactFlowInstance.setViewport({
                x: -minX * exportZoom,
                y: -minY * exportZoom,
                zoom: exportZoom,
            });

            // Wait for React Flow to re-render at new size
            await new Promise(r => setTimeout(r, 800));

            // Hide UI overlays for clean capture
            const overlays = container.querySelectorAll<HTMLElement>(
                '.react-flow__controls, .react-flow__minimap, .react-flow__background, .react-flow__attribution'
            );
            overlays.forEach(el => el.style.display = 'none');

            const controlPanels = container.querySelectorAll<HTMLElement>('.absolute.z-10');
            const hiddenPanels: HTMLElement[] = [];
            controlPanels.forEach(el => {
                if (el.closest('.react-flow__renderer')) return;
                hiddenPanels.push(el);
                el.style.display = 'none';
            });

            // Capture the full tree as hi-res JPEG (much smaller than PNG)
            const rfViewport = container.querySelector<HTMLElement>('.react-flow__renderer')
                || container;

            const captureOptions = {
                cacheBust: true,
                pixelRatio: pixelRatio,
                width: canvasWidth,
                height: canvasHeight,
                backgroundColor: '#fafaf9',
                quality: 0.98,
                filter: (node: HTMLElement) => {
                    const cls = node.className?.toString?.() || '';
                    if (cls.includes('react-flow__controls')) return false;
                    if (cls.includes('react-flow__minimap')) return false;
                    if (cls.includes('react-flow__attribution')) return false;
                    if (cls.includes('react-flow__background')) return false;
                    return true;
                },
            };

            let dataUrl: string;
            try {
                dataUrl = await toJpeg(rfViewport, captureOptions);
            } catch (captureErr) {
                // Fallback: retry at half resolution if JPEG capture fails
                console.warn('PDF: First capture failed, retrying at lower resolution...', captureErr);
                toast('⏳ Mengoptimalkan resolusi...', { duration: 2000 });
                captureOptions.pixelRatio = Math.max(1, pixelRatio * 0.5);
                dataUrl = await toJpeg(rfViewport, captureOptions);
            }

            // Restore container immediately
            overlays.forEach(el => el.style.display = '');
            hiddenPanels.forEach(el => el.style.display = '');
            container.style.width = prevWidth;
            container.style.height = prevHeight;
            container.style.position = prevPosition;
            container.style.overflow = prevOverflow;
            reactFlowInstance.setViewport(prevViewport);

            // Load the captured image
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = dataUrl;
            });

            const imgWidthPx = img.naturalWidth;
            const imgHeightPx = img.naturalHeight;

            // ── Paper dimensions (stable mm margins across paper sizes) ──
            const pageW = paperLayout.pageW;
            const pageH = paperLayout.pageH;
            const footerBlock = Math.max(12, Math.min(22, pageH * 0.03));
            const titleBlock = Math.max(10, Math.min(18, pageH * 0.028));
            const marginTop = titleBlock + 2;
            const marginBottom = footerBlock + 2;
            const marginSide = Math.max(6, Math.min(12, pageW * 0.02));
            const contentW = pageW - marginSide * 2;
            const contentH = pageH - marginTop - marginBottom;

            // ── Single hi-res page — fit entire tree on one page ──
            const scale = Math.min(contentW / imgWidthPx, contentH / imgHeightPx);
            const finalW = imgWidthPx * scale;
            const finalH = imgHeightPx * scale;
            const xOff = marginSide + (contentW - finalW) / 2;
            const yOff = marginTop + (contentH - finalH) / 2;

            const pdf = new jsPDF({
                orientation: paperLayout.isLandscape ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pageW, pageH],
            });

            // Header
            const titleSize = pageW >= 594 ? 18 : pageW >= 420 ? 15 : 13;
            pdf.setFontSize(titleSize);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(20, 20, 20);
            pdf.text(familyName, pageW / 2, Math.max(8, titleBlock * 0.72), { align: 'center' });

            // Tree image — full resolution on single page
            pdf.addImage(dataUrl, 'JPEG', xOff, yOff, finalW, finalH, undefined, 'MEDIUM');

            // Add Legend (if available) - Bottom Left, scaled by paper size
            if (legendRef.current) {
                try {
                    const legendUrl = await toPng(legendRef.current, { cacheBust: true, pixelRatio: 3 });
                    const legendImg = new Image();
                    await new Promise<void>((resolve, reject) => {
                        legendImg.onload = () => resolve();
                        legendImg.onerror = reject;
                        legendImg.src = legendUrl;
                    });

                    // Use actual image aspect ratio for precise sizing
                    const legendAspect = legendImg.naturalWidth / legendImg.naturalHeight;
                    const legendW = Math.max(32, Math.min(58, pageW * 0.18));
                    const legendH = legendW / legendAspect;

                    // Position: Bottom Left, above footer area
                    const legendX = marginSide;
                    const legendY = pageH - marginBottom - 7 - legendH;

                    pdf.addImage(legendUrl, 'PNG', legendX, legendY, legendW, legendH);
                } catch (e) {
                    console.error('Legend capture failed', e);
                }
            }

            // Footer
            const now = new Date();
            const dateStr = now.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            const timeStr = now.toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
            });

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(100, 100, 100);
            pdf.text('Warisan Jejak Keluarga Bugis', pageW / 2, pageH - (footerBlock * 0.76), { align: 'center' });

            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Created by wija-ogi.com', pageW / 2, pageH - (footerBlock * 0.44), { align: 'center' });

            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`${dateStr} ${timeStr}`, pageW / 2, pageH - (footerBlock * 0.2), { align: 'center' });
            pdf.setTextColor(0, 0, 0);

            const safeName = familyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const timestamp = now.toISOString().slice(0, 10);
            pdf.save(`${safeName}-${exportPaperSize}-${timestamp}.pdf`);

            toast.success(`✅ PDF ${exportPaperSize} hi-res berhasil didownload!`);
        } catch (error) {
            console.error('PDF export error:', error);
            toast.error('Gagal mengexport PDF. Silakan coba lagi.');
            if (reactFlowRef.current) {
                reactFlowRef.current.style.width = '';
                reactFlowRef.current.style.height = '';
                reactFlowRef.current.style.position = '';
                reactFlowRef.current.style.overflow = '';
            }
        } finally {
            setIsExporting(false);
        }
    }, [isExporting, persons.length, familyName, reactFlowInstance, exportPaperSize, getTreeBounds, paperLayout]);

    // MiniMap node colors
    const minimapNodeColor = useCallback((node: Node) => {
        return node.type === 'female' ? '#dc2626' : '#16a34a';
    }, []);

    // Mobile-friendly: Check window width for default legend state
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsLegendOpen(false);
            } else {
                setIsLegendOpen(true);
            }
        };
        // Initial check
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [isLegendOpen, setIsLegendOpen] = useState(true);

    if (persons.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl border-2 border-dashed border-teal-300">
                <div className="text-6xl mb-4">🌱</div>
                <h3 className="text-lg font-semibold text-stone-700 mb-2">Pohon Keluarga Kosong</h3>
                <p className="text-stone-500 mb-4 text-center">Mulai dengan menambahkan leluhur pertama</p>
                {onAddPerson && (
                    <button onClick={onAddPerson} className="px-6 py-3 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 transition shadow-lg">
                        ➕ Tambah Leluhur
                    </button>
                )}
            </div>
        );
    }

    return (
        <div ref={reactFlowRef} className="relative h-full w-full">
            <style>{`
                @media print {
                    @page {
                        size: ${exportPaperSize} ${guideLayout.isLandscape ? 'landscape' : 'portrait'};
                        margin: 8mm;
                    }
                }
            `}</style>
            {/* Top Bar Container - Responsive */}
            <div className="absolute top-0 left-0 right-0 z-10 p-3 flex flex-col md:flex-row justify-between gap-3 pointer-events-none print:hidden">

                {/* Controls - Mobile: Order 2, Desktop: Order 1 */}
                <div className="order-2 md:order-1 pointer-events-auto flex items-center gap-1.5 md:gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-hide">
                    <div className="flex gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm p-1.5 border border-stone-200 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                        <select
                            value={exportPaperSize}
                            onChange={(e) => setExportPaperSize(e.target.value as 'A4' | 'A3' | 'A2' | 'A1' | 'A0')}
                            className="h-8 md:h-9 px-2 rounded text-xs md:text-sm font-medium border border-stone-200 bg-white text-stone-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
                            title="Ukuran kertas PDF"
                        >
                            <option value="A4">A4</option>
                            <option value="A3">A3</option>
                            <option value="A2">A2</option>
                            <option value="A1">A1</option>
                            <option value="A0">A0</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className={`px-3 md:px-4 h-8 md:h-9 flex items-center justify-center gap-1.5 rounded text-xs md:text-sm font-medium border cursor-pointer select-none transition-colors ${isExporting ? 'bg-blue-100 text-blue-400 border-blue-200 cursor-wait'
                                : 'hover:bg-blue-50 text-blue-600 border-blue-200 bg-white'
                                }`}
                            title="Export ke file PDF (print quality)"
                        >
                            {isExporting ? '⏳' : '🖨️'} <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowPaperGuide(prev => !prev)}
                            className={`px-2.5 md:px-3 h-8 md:h-9 flex items-center justify-center rounded text-xs md:text-sm font-medium border cursor-pointer select-none transition-colors ${showPaperGuide
                                ? 'bg-teal-50 text-teal-700 border-teal-200'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                }`}
                            title="Tampilkan batas kanvas auto berdasarkan paper ratio"
                        >
                            {showPaperGuide ? 'Guide On' : 'Guide Off'}
                        </button>
                        <div className="flex h-8 md:h-9 rounded border border-stone-200 overflow-hidden bg-white">
                            <button
                                type="button"
                                onClick={() => setTextDensityMode('readable')}
                                className={`px-2.5 md:px-3 text-xs md:text-sm font-medium transition-colors ${textDensityMode === 'readable'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-stone-600 hover:bg-stone-50'
                                    }`}
                                title="Teks lebih nyaman dibaca (tidak mengubah posisi node)"
                            >
                                Readable
                            </button>
                            <button
                                type="button"
                                onClick={() => setTextDensityMode('compact')}
                                className={`px-2.5 md:px-3 text-xs md:text-sm font-medium border-l border-stone-200 transition-colors ${textDensityMode === 'compact'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'text-stone-600 hover:bg-stone-50'
                                    }`}
                                title="Teks lebih ringkas (tidak mengubah posisi node)"
                            >
                                Compact
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search - Mobile: Order 1, Desktop: Order 2 */}
                <div className="order-1 md:order-2 pointer-events-auto w-full md:w-64">
                    <TreeSearch
                        persons={persons}
                        onSelect={focusOnPerson}
                        onHighlight={setHighlightedIds}
                        className="w-full shadow-sm"
                    />
                </div>
            </div>

            {/* Legend - Collapsible on Mobile */}
            <div className="absolute bottom-20 md:bottom-3 left-3 z-10 print:hidden transition-all duration-300">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-stone-200 overflow-hidden">
                    <button
                        onClick={() => setIsLegendOpen(!isLegendOpen)}
                        className="w-full flex items-center justify-between p-2 md:p-3 bg-stone-50/50 hover:bg-stone-100 transition-colors cursor-pointer text-xs md:text-sm font-medium text-stone-700 gap-2"
                    >
                        <span>ℹ️ Legenda</span>
                        <span className={`transform transition-transform ${isLegendOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isLegendOpen && (
                        <div className="p-3 border-t border-stone-100">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-600 border border-green-700 shadow-sm flex items-center justify-center text-white text-[10px] md:text-xs"></div>
                                    <div>
                                        <div className="text-xs md:text-sm font-semibold text-stone-700">Oroane</div>
                                        <div className="text-[10px] md:text-xs font-lontara text-green-700">ᨕᨚᨑᨚᨕᨊᨙ</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-6 h-6 md:w-8 md:h-8 flex items-center justify-center">
                                        <svg width="100%" height="100%" viewBox="0 0 50 50" className="drop-shadow-sm">
                                            <polygon points="25,45 5,10 45,10" className="fill-red-600 stroke-red-700" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-xs md:text-sm font-semibold text-stone-700">Makkunrai</div>
                                        <div className="text-[10px] md:text-xs font-lontara text-red-700">ᨆᨀᨘᨋᨕᨗ</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* React Flow Canvas */}
            <div className={`relative w-full h-full ${lodLevel === 0 ? 'lod-shape-only' : lodLevel === 1 ? 'lod-name-only' : ''}`}>
                <style>{`
                .lod-shape-only .node-text-detail { display: none !important; }
                .lod-name-only .node-text-extra { display: none !important; }
            `}</style>
                {showPaperGuide && (
                    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-4 pt-16 pb-4 print:hidden">
                        <div
                            className="h-full w-auto max-w-full rounded-2xl border-2 border-dashed border-teal-400/70 bg-teal-100/10 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.35)]"
                            style={{
                                aspectRatio: `${guideLayout.pageW} / ${guideLayout.pageH}`,
                            }}
                        />
                    </div>
                )}
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragStop={handleNodeDragStop}
                    onSelectionDragStart={handleSelectionDragStart}
                    onSelectionDragStop={handleSelectionDragStop}
                    onPaneClick={handlePaneClick}
                    onMoveEnd={(_, viewport) => {
                        // P3b: LOD — compute detail level from zoom
                        const zoom = viewport.zoom;
                        const newLod = zoom < 0.1 ? 0 : zoom < 0.2 ? 1 : 2;
                        if (newLod !== lodLevel) setLodLevel(newLod);
                    }}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    minZoom={0.05}
                    maxZoom={3}
                    attributionPosition="bottom-right"
                    defaultEdgeOptions={{
                        type: DEFAULT_EDGE_SETTINGS.edgeType,
                    }}
                    style={{ background: '#fafaf9' }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d6d3d1" />
                    <Controls
                        position="bottom-right"
                        showInteractive={false}
                        className="m-2 md:m-4" // Responsive margin
                    />
                    <MiniMap
                        nodeColor={minimapNodeColor}
                        nodeStrokeWidth={2}
                        zoomable
                        pannable
                        position="bottom-right"
                        style={{ width: 120, height: 80, marginBottom: 50, marginRight: 10 }}
                        className="hidden md:block" // Hide minimap on mobile
                    />
                </ReactFlow>
            </div>

            {/* Hover Tooltip - Hidden on mobile or handled differently? 
                React Flow doesn't hover on touch usually. 
                Keep it as is, mouse only.
            */}
            {hoveredPerson && (() => {
                const hp = hoveredPerson;
                const hpName = [hp.person.firstName, hp.person.middleName, hp.person.lastName].filter(Boolean).join(' ') || hp.person.fullName || 'N/A';
                const spNames = hp.person.relationships.spouseIds
                    .map(sid => personsMap.get(sid))
                    .filter(Boolean)
                    .map(s => s!.firstName || s!.fullName || '');
                const cCount = persons.filter(p => p.relationships.parentIds.includes(hp.person.personId)).length;
                return (
                    <div
                        className="fixed z-[100] bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-stone-200 p-3 pointer-events-none hidden md:block" // Hide tooltip on mobile, use node click
                        style={{
                            left: Math.min(hp.x, typeof window !== 'undefined' ? window.innerWidth - 260 : hp.x),
                            top: Math.max(8, hp.y),
                            maxWidth: 240,
                        }}
                    >
                        <div className="font-semibold text-sm text-stone-800 leading-tight">{hpName}</div>
                        <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                            <span>{hp.person.gender === 'male' ? '♂ Laki-laki' : hp.person.gender === 'female' ? '♀ Perempuan' : '● Lainnya'}</span>
                        </div>
                        {hp.person.biography && (
                            <div className="text-xs text-stone-600 mt-1 line-clamp-2 italic">{hp.person.biography}</div>
                        )}
                        <div className="mt-1.5 pt-1.5 border-t border-stone-100 text-xs text-stone-500 space-y-0.5">
                            {spNames.length > 0 && <div>🤝 {spNames.join(', ')}</div>}
                            {cCount > 0 && <div>👶 {cCount} anak</div>}
                        </div>
                    </div>
                );
            })()}
            {/* Hidden Legend for Capture */}
            <div ref={legendRef} className="bg-white p-4 rounded-lg border border-stone-800 shadow-sm inline-block" style={{ position: 'absolute', top: -9999, left: -9999, width: 'fit-content' }}>
                <div className="font-bold text-stone-800 mb-2 border-b border-stone-200 pb-1 text-sm">Legenda / Keterangan</div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-600 border border-green-700 shadow-sm flex items-center justify-center text-white text-xs"></div>
                        <div>
                            <div className="text-sm font-semibold text-stone-700">Oroane</div>
                            <div className="text-xs font-lontara text-green-700">ᨕᨚᨑᨚᨕᨊᨙ</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 50 50" className="drop-shadow-sm">
                                <polygon points="25,45 5,10 45,10" className="fill-red-600 stroke-red-700" strokeWidth="2" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-stone-700">Makkunrai</div>
                            <div className="text-xs font-lontara text-red-700">ᨆᨀᨘᨋᨕᨗ</div>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — wraps with ReactFlowProvider
// ═══════════════════════════════════════════════════════════════════════════════
export function FamilyTree(props: FamilyTreeProps) {
    return (
        <ReactFlowProvider>
            <FamilyTreeInner {...props} />
        </ReactFlowProvider>
    );
}

export default FamilyTree;
