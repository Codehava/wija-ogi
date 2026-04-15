// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Tree Minimap Component
// Overview navigation for large family trees — click or drag to navigate
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface NodePosition {
    x: number;
    y: number;
}

interface Person {
    personId: string;
    gender: 'male' | 'female' | 'other' | 'unknown';
}

export interface TreeMinimapProps {
    positions: Map<string, NodePosition>;
    persons: Person[];
    canvasSize: { width: number; height: number };
    viewport: {
        pan: { x: number; y: number };
        zoom: number;
        containerWidth: number;
        containerHeight: number;
    };
    onNavigate: (pan: { x: number; y: number }) => void;
    className?: string;
}

// Minimap dimensions
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const NODE_DOT_SIZE = 5;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 100;

export function TreeMinimap({
    positions,
    persons,
    canvasSize: _canvasSize,
    viewport,
    onNavigate,
    className
}: TreeMinimapProps) {
    const minimapRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Calculate bounds of actual node content (not canvas size)
    const contentBounds = useMemo(() => {
        if (positions.size === 0) {
            return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + NODE_WIDTH);
            maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
        });
        // Add some padding
        const pad = 50;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }, [positions]);

    // Scale to fit content in minimap
    const scale = useMemo(() => {
        const scaleX = MINIMAP_WIDTH / contentBounds.width;
        const scaleY = MINIMAP_HEIGHT / contentBounds.height;
        return Math.min(scaleX, scaleY);
    }, [contentBounds]);

    // Build persons map for quick lookup
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach(p => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Convert canvas coordinates to minimap coordinates
    const toMinimap = useCallback((canvasX: number, canvasY: number) => ({
        x: (canvasX - contentBounds.minX) * scale,
        y: (canvasY - contentBounds.minY) * scale,
    }), [contentBounds, scale]);

    // Calculate viewport rectangle on minimap
    // Pan is: translate(pan.x, pan.y) scale(zoom) — meaning canvas origin is 
    // shifted by (pan.x, pan.y) in screen space. The visible area in canvas coords:
    //   topLeft_canvas  = (-pan.x / zoom, -pan.y / zoom)
    //   size_canvas     = (containerWidth / zoom, containerHeight / zoom)
    const viewportRect = useMemo(() => {
        const viewX = -viewport.pan.x / viewport.zoom;
        const viewY = -viewport.pan.y / viewport.zoom;
        const viewW = viewport.containerWidth / viewport.zoom;
        const viewH = viewport.containerHeight / viewport.zoom;

        const topLeft = toMinimap(viewX, viewY);
        return {
            x: topLeft.x,
            y: topLeft.y,
            width: viewW * scale,
            height: viewH * scale
        };
    }, [viewport, toMinimap, scale]);

    // Navigate to clicked/dragged point on minimap
    const navigateToPoint = useCallback((clientX: number, clientY: number) => {
        if (!minimapRef.current) return;
        const rect = minimapRef.current.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const clickY = clientY - rect.top;

        // Convert minimap coords to canvas coords
        const canvasX = clickX / scale + contentBounds.minX;
        const canvasY = clickY / scale + contentBounds.minY;

        // Calculate pan to center the clicked point in the viewport
        const newPanX = -(canvasX * viewport.zoom) + viewport.containerWidth / 2;
        const newPanY = -(canvasY * viewport.zoom) + viewport.containerHeight / 2;

        onNavigate({ x: newPanX, y: newPanY });
    }, [scale, contentBounds, viewport.zoom, viewport.containerWidth, viewport.containerHeight, onNavigate]);

    // Handle click
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        navigateToPoint(e.clientX, e.clientY);
    }, [navigateToPoint]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        e.preventDefault();
        navigateToPoint(e.clientX, e.clientY);
    }, [isDragging, navigateToPoint]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    return (
        <div
            ref={minimapRef}
            className={clsx(
                'bg-white/95 backdrop-blur-sm rounded-lg border border-stone-200/80 shadow-lg overflow-hidden select-none',
                isDragging ? 'cursor-grabbing' : 'cursor-crosshair',
                className
            )}
            style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            <svg
                width={MINIMAP_WIDTH}
                height={MINIMAP_HEIGHT}
                className="absolute inset-0"
            >
                {/* Background */}
                <rect width="100%" height="100%" fill="#fafaf9" />

                {/* Subtle grid */}
                <defs>
                    <pattern id="minimapGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e7e5e4" strokeWidth="0.3" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#minimapGrid)" />

                {/* Node dots */}
                {Array.from(positions.entries()).map(([personId, pos]) => {
                    const person = personsMap.get(personId);
                    const color = person?.gender === 'female' ? '#dc2626' : '#16a34a';
                    const mp = toMinimap(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2);
                    return (
                        <circle
                            key={personId}
                            cx={mp.x}
                            cy={mp.y}
                            r={NODE_DOT_SIZE / 2}
                            fill={color}
                            opacity={0.7}
                        />
                    );
                })}

                {/* Viewport rectangle */}
                <rect
                    x={viewportRect.x}
                    y={viewportRect.y}
                    width={Math.max(viewportRect.width, 8)}
                    height={Math.max(viewportRect.height, 6)}
                    fill="rgba(13, 148, 136, 0.12)"
                    stroke="#0d9488"
                    strokeWidth="1.5"
                    rx="2"
                />
            </svg>

            {/* Labels */}
            <div className="absolute bottom-1 left-1.5 text-[9px] text-stone-400 font-medium">
                {positions.size} nodes
            </div>
            <div className="absolute top-1 left-1.5 text-[9px] text-stone-400">
                Klik / geser untuk navigasi
            </div>
        </div>
    );
}

export default TreeMinimap;
