// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Tree Search Component
// Search and filter persons in the family tree with autocomplete
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Person } from '@/types';

export interface TreeSearchProps {
    persons: Person[];
    onSelect: (personId: string) => void;
    onHighlight?: (personIds: string[]) => void;
    className?: string;
}

export function TreeSearch({
    persons,
    onSelect,
    onHighlight,
    className
}: TreeSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter persons based on query
    const results = useMemo(() => {
        if (!query.trim()) return [];

        const q = query.toLowerCase();
        return persons
            .filter(p => {
                const fullName = [p.firstName, p.middleName, p.lastName]
                    .filter(Boolean).join(' ').toLowerCase();
                const lontaraName = p.lontaraName?.first?.toLowerCase() || '';
                return fullName.includes(q) || lontaraName.includes(q);
            })
            .slice(0, 10); // Limit results for performance
    }, [persons, query]);

    // Update highlight when results change
    useEffect(() => {
        if (onHighlight) {
            onHighlight(results.map(p => p.personId));
        }
    }, [results, onHighlight]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setQuery('');
                break;
        }
    };

    const handleSelect = (person: Person) => {
        onSelect(person.personId);
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
    };

    // Build display name
    const getDisplayName = (p: Person) => {
        return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
    };

    return (
        <div className={clsx('relative', className)}>
            {/* Search Input */}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
                    🔍
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        setSelectedIndex(0);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Cari anggota keluarga..."
                    className={clsx(
                        'w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200',
                        'bg-white/80 backdrop-blur-sm shadow-sm',
                        'focus:ring-2 focus:ring-teal-400 focus:border-teal-400',
                        'placeholder:text-stone-400 text-sm',
                        'transition-all duration-200'
                    )}
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && results.length > 0 && (
                <div
                    ref={listRef}
                    className={clsx(
                        'absolute z-50 w-full mt-1 py-1',
                        'bg-white rounded-lg border border-stone-200 shadow-lg',
                        'max-h-64 overflow-y-auto'
                    )}
                >
                    {results.map((person, index) => (
                        <button
                            key={person.personId}
                            onClick={() => handleSelect(person)}
                            className={clsx(
                                'w-full px-3 py-2 text-left flex items-center gap-3',
                                'hover:bg-teal-50 transition-colors',
                                selectedIndex === index && 'bg-teal-50'
                            )}
                        >
                            {/* Gender indicator */}
                            <span className={clsx(
                                'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm',
                                person.gender === 'female' ? 'bg-red-600' : 'bg-green-600'
                            )}>
                                {person.gender === 'female' ? '♀️' : '♂️'}
                            </span>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-stone-800 truncate">
                                    {getDisplayName(person)}
                                </div>
                                {person.lontaraName?.first && (
                                    <div className="text-xs text-teal-600 font-lontara truncate">
                                        {person.lontaraName.first}
                                    </div>
                                )}
                            </div>

                            {/* Birth year */}
                            {person.birthDate && (
                                <span className="text-xs text-stone-400">
                                    {person.birthDate.split('-')[0]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* No results */}
            {isOpen && query && results.length === 0 && (
                <div className="absolute z-50 w-full mt-1 py-3 px-4 bg-white rounded-lg border border-stone-200 shadow-lg text-center text-stone-500 text-sm">
                    Tidak ditemukan "{query}"
                </div>
            )}
        </div>
    );
}

export default TreeSearch;
