// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Person Node Component
// Tree node for family visualization
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { Person, ScriptMode } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { getGenerationLabel } from '@/lib/generation/calculator';

export interface PersonNodeProps {
    person: Person;
    scriptMode?: ScriptMode;
    generation?: number;
    selected?: boolean;
    onClick?: () => void;
    showDetails?: boolean;
    compact?: boolean;
}

export function PersonNode({
    person,
    scriptMode = 'both',
    generation = -1,
    selected = false,
    onClick,
    showDetails = true,
    compact = false
}: PersonNodeProps) {
    // Get display name - build from components
    const displayName = [person.firstName, person.middleName, person.lastName]
        .filter(Boolean).join(' ') || person.fullName || person.firstName;

    // Auto-transliterate full name for Lontara display
    const lontaraName = useMemo(() => {
        if (person.lontaraNameCustom?.first) {
            const parts = [person.lontaraNameCustom.first, person.lontaraNameCustom.middle, person.lontaraNameCustom.last].filter(Boolean);
            return parts.join(' ');
        }
        return transliterateLatin(displayName).lontara;
    }, [displayName, person.lontaraNameCustom]);

    // Gender-based styling - Updated: Green for male, Red for female
    const genderConfig = {
        male: {
            shapeColor: 'bg-green-600',
            shapeBorder: 'border-green-700',
            textColor: 'text-green-900',
            bgColor: 'bg-green-50',
        },
        female: {
            shapeColor: 'bg-red-600',
            shapeBorder: 'border-red-700',
            textColor: 'text-red-900',
            bgColor: 'bg-red-50',
        },
        other: {
            shapeColor: 'bg-purple-500',
            shapeBorder: 'border-purple-600',
            textColor: 'text-purple-900',
            bgColor: 'bg-purple-50',
        },
        unknown: {
            shapeColor: 'bg-gray-500',
            shapeBorder: 'border-gray-600',
            textColor: 'text-gray-900',
            bgColor: 'bg-gray-50',
        }
    };

    const config = genderConfig[person.gender] || genderConfig.unknown;
    const generationText = generation > 0 ? getGenerationLabel(generation) : null;
    const shapeSize = compact ? 40 : 50;
    const hasTitle = !!person.title || !!person.reignTitle;

    // Render gender shape (circle or triangle)
    const renderShape = () => {
        if (person.gender === 'female') {
            // Inverted Triangle for female - Red
            return (
                <div
                    className={clsx(
                        "relative flex-shrink-0",
                        // Add gold ring if titled
                        hasTitle && 'ring-2 ring-amber-400 rounded-sm' // Triangle tricky with border, use ring on container or just svg stroke
                    )}
                    style={{ width: shapeSize, height: shapeSize }}
                >
                    <svg
                        width={shapeSize}
                        height={shapeSize}
                        viewBox="0 0 50 50"
                        className="drop-shadow-md"
                        style={hasTitle ? { filter: 'drop-shadow(0 0 2px #fbbf24)' } : undefined}
                    >
                        <polygon
                            points="25,45 5,10 45,10"
                            className={clsx('fill-red-600 stroke-red-700')}
                            strokeWidth={hasTitle ? "3" : "2"}
                            stroke={hasTitle ? "#fbbf24" : undefined} // Gold stroke if titled
                        />
                        {person.photoUrl ? (
                            <clipPath id={`clip-${person.personId}`}>
                                <polygon points="25,40 10,15 40,15" />
                            </clipPath>
                        ) : null}
                    </svg>
                    {person.photoUrl && (
                        <Image
                            src={person.photoUrl}
                            alt={person.firstName}
                            fill
                            sizes={`${shapeSize}px`}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ clipPath: 'polygon(50% 90%, 10% 20%, 90% 20%)' }}
                            unoptimized
                        />
                    )}
                </div>
            );
        } else {
            // Circle for male (and other/unknown) - Green
            const baseColorClass = person.gender === 'male' ? 'bg-green-600 border-green-700' :
                person.gender === 'other' ? 'bg-purple-500 border-purple-600' :
                    'bg-gray-500 border-gray-600';

            return (
                <div
                    className={clsx(
                        'rounded-full flex-shrink-0 border-2 overflow-hidden drop-shadow-md',
                        // If titled: keep bg color, add gold border/ring
                        hasTitle ? clsx(baseColorClass.split(' ')[0], 'border-amber-400 ring-2 ring-amber-300') : baseColorClass
                    )}
                    style={{ width: shapeSize, height: shapeSize }}
                >
                    {person.photoUrl ? (
                        <Image
                            src={person.photoUrl}
                            alt={person.firstName}
                            width={shapeSize}
                            height={shapeSize}
                            className="w-full h-full object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-lg">
                            {/* Empty for male as requested, keep dot for others? User said "simbol laki laki pada bulatan hilangkan". 
                                I'll leave it empty for male. 
                            */}
                            {person.gender === 'male' ? '' : '●'}
                        </div>
                    )}
                </div>
            );
        }
    };

    return (
        <div
            onClick={onClick}
            className={clsx(
                'cursor-pointer transition-all duration-200 hover:scale-105',
                selected && 'ring-4 ring-teal-400 shadow-xl scale-105'
            )}
            style={person.position ? {
                position: 'absolute',
                left: person.position.x,
                top: person.position.y
            } : undefined}
        >
            {/* Horizontal layout: Shape on left, text on right */}
            <div className={clsx(
                'flex items-center gap-3 rounded-lg p-2',
                config.bgColor,
                'border border-opacity-30',
                selected ? 'border-teal-500' : 'border-transparent'
            )}>
                {/* Gender Shape */}
                <div className="relative">
                    {renderShape()}
                    {/* Crown badge for nobility */}
                    {hasTitle && (
                        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[10px] shadow-sm border border-amber-500 z-10">
                            👑
                        </div>
                    )}
                </div>

                {/* Names beside shape */}
                <div className="flex-1 min-w-0">
                    {/* Latin Name */}
                    {(scriptMode === 'latin' || scriptMode === 'both') && (
                        <div className={clsx(
                            'font-semibold truncate',
                            config.textColor,
                            compact ? 'text-xs' : 'text-sm'
                        )}>
                            {displayName}
                        </div>
                    )}

                    {/* Lontara Name */}
                    {(scriptMode === 'lontara' || scriptMode === 'both') && (
                        <div className={clsx(
                            'font-lontara text-teal-700 truncate',
                            compact ? 'text-xs' : 'text-sm'
                        )}>
                            {lontaraName}
                        </div>
                    )}

                    {/* Details */}
                    {showDetails && !compact && (
                        <div className="text-xs text-stone-500 mt-1">
                            {/* Reign Title */}
                            {person.reignTitle && (
                                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium mr-1">
                                    👑 {person.reignTitle}
                                </span>
                            )}
                            {person.birthDate && (
                                <span>
                                    {person.birthDate.split('-')[0]}
                                    {person.deathDate && ` - ${person.deathDate.split('-')[0]}`}
                                </span>
                            )}
                            {generationText && (
                                <span className="ml-2 bg-teal-100 text-teal-700 px-1 py-0.5 rounded text-[10px]">
                                    {generationText}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Deceased indicator */}
                {!person.isLiving && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-stone-400 rounded-full flex items-center justify-center text-white text-[8px]">
                        🪦
                    </div>
                )}
            </div>
        </div>
    );
}

export default PersonNode;
