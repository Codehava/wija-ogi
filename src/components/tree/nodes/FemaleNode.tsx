'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface FemaleNodeData {
    label: string;
    person: {
        personId: string;
        firstName?: string;
        fullName?: string;
        gender: string;
        photoUrl?: string;
        lontaraName?: { first?: string; middle?: string; last?: string };
        biography?: string;
        title?: string;
        reignTitle?: string;
    };
    displayName: string;
    lontaraFullName: string;
    shapeSize: number;
    nodeTextWidth?: number;
    fontScale?: number;
    textDensityMode?: 'readable' | 'compact';
    scriptMode: string;
    isSelected: boolean;
    isHighlighted: boolean;
    isOnAncestryPath: boolean;
    hasAncestryActive: boolean;
    isInFocusBranch?: boolean;
    hasFocusBranchActive?: boolean;
    onPersonClick?: () => void;
    onHover?: (rect: DOMRect) => void;
    onHoverEnd?: () => void;
    lodLevel?: number; // P3b: 0=shape only, 1=name, 2=full
    isClone?: boolean;
    cloneOf?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function FemaleNodeComponent({ data }: NodeProps) {
    const d = data as unknown as FemaleNodeData;
    const shapeSize = d.shapeSize || 56;
    const textWidth = d.nodeTextWidth || 180;
    const fontScale = d.fontScale || 1;
    const mode = d.textDensityMode || 'readable';
    const densityScale = mode === 'compact' ? 0.78 : 1.34;
    const hasTitle = !!d.person.title || !!d.person.reignTitle;
    const isLongLatinName = d.displayName.length > 28;
    const effectiveScale = fontScale * densityScale;
    const isOutOfFocus = !!d.hasFocusBranchActive && !d.isInFocusBranch;
    const isOutOfAncestry = d.hasAncestryActive && !d.isOnAncestryPath;
    const lontaraFontSize = clamp(shapeSize * 0.235 * effectiveScale, mode === 'compact' ? 10 : 13, mode === 'compact' ? 16 : 21);
    const latinFontSize = clamp(shapeSize * (isLongLatinName ? 0.2 : 0.218) * effectiveScale, mode === 'compact' ? 9.5 : 12, mode === 'compact' ? 15 : 20);
    const titleBadgeFontSize = clamp(shapeSize * 0.16 * effectiveScale, mode === 'compact' ? 8 : 9, mode === 'compact' ? 11 : 13);

    return (
        <div
            className={`flex flex-col items-center gap-1 ${d.isSelected ? 'scale-110' : ''
                } ${d.isHighlighted ? 'animate-pulse' : ''}`}
            style={{
                opacity: isOutOfFocus ? 0.16 : isOutOfAncestry ? 0.3 : 1,
                filter: d.isOnAncestryPath
                    ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))'
                    : isOutOfFocus
                        ? 'grayscale(0.55)'
                        : undefined,
            }}
            onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                d.onHover?.(rect);
            }}
            onMouseLeave={() => d.onHoverEnd?.()}
        >
            {/* Handle: top */}
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, top: 0 }}
            />

            {/* Shape wrapper — spouse handles attach HERE so lines connect to the triangle */}
            <div className="relative">
                {/* Triangle Shape */}
                <div style={{ width: shapeSize, height: shapeSize }}>
                    <svg width={shapeSize} height={shapeSize} viewBox="0 0 56 56" className="drop-shadow-lg">
                        <defs>
                            <clipPath id={`tri-${d.person.personId}`}>
                                <polygon points="28,50 4,10 52,10" />
                            </clipPath>
                            <linearGradient id={`grad-f-${d.person.personId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={hasTitle ? '#fde68a' : '#fca5a5'} />
                                <stop offset="100%" stopColor={hasTitle ? '#f59e0b' : '#dc2626'} />
                            </linearGradient>
                        </defs>
                        {d.person.photoUrl ? (
                            <image
                                href={d.person.photoUrl}
                                x="0" y="0" width="56" height="56"
                                clipPath={`url(#tri-${d.person.personId})`}
                                preserveAspectRatio="xMidYMid slice"
                            />
                        ) : (
                            <polygon
                                points="28,50 4,10 52,10"
                                fill={`url(#grad-f-${d.person.personId})`}
                            />
                        )}
                        <polygon
                            points="28,50 4,10 52,10"
                            fill="none"
                            stroke={
                                hasTitle ? '#d97706' :
                                    d.isOnAncestryPath ? '#f59e0b' :
                                        d.isSelected ? '#14b8a6' :
                                            d.isHighlighted ? '#f59e0b' : '#b91c1c'
                            }
                            strokeWidth={d.isOnAncestryPath || d.isSelected || d.isHighlighted || hasTitle ? 3 : 2}
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                {/* Crown badge for nobility */}
                {hasTitle && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[10px] shadow-md border border-amber-500 z-10">
                        👑
                    </div>
                )}

                {/* Spouse handles — positioned at shape center height */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    style={{ background: 'transparent', border: 'none', width: 1, height: 1, top: '50%', right: -1 }}
                />
                <Handle
                    type="target"
                    position={Position.Left}
                    id="left"
                    style={{ background: 'transparent', border: 'none', width: 1, height: 1, top: '50%', left: -1 }}
                />
            </div>

            {/* Text below shape */}
            <div className="node-text-detail text-center w-full px-1.5" style={{ maxWidth: textWidth }}>
                {/* Reign Title badge */}
                {d.person.reignTitle && (
                    <div
                        className="node-text-extra font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 mb-0.5 leading-tight"
                        style={{ fontSize: `${titleBadgeFontSize}px` }}
                    >
                        👑 {d.person.reignTitle}
                    </div>
                )}
                {(d.scriptMode === 'lontara' || d.scriptMode === 'both') && d.lontaraFullName && (
                    <div
                        className="node-text-extra text-teal-700 font-lontara leading-[1.2] break-words"
                        style={{ fontSize: `${lontaraFontSize}px` }}
                    >
                        {d.lontaraFullName}
                    </div>
                )}
                {(d.scriptMode === 'latin' || d.scriptMode === 'both') && (
                    <div
                        className="font-semibold leading-[1.2] text-stone-700 break-words"
                        style={{ fontSize: `${latinFontSize}px` }}
                    >
                        {d.displayName}
                    </div>
                )}
            </div>

            {/* Handle: bottom */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                style={{ background: 'transparent', border: 'none', width: 1, height: 1, bottom: 0 }}
            />
        </div>
    );
}

export const FemaleNode = memo(FemaleNodeComponent);
