// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Statistics Component
// Dashboard showing family tree metrics and insights
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { Person } from '@/types';
import { calculateGeneration, findRootAncestor } from '@/lib/generation/calculator';

export interface FamilyStatsProps {
    persons: Person[];
    familyName?: string;
    className?: string;
    compact?: boolean;
}

interface StatCard {
    label: string;
    value: string | number;
    icon: string;
    color: string;
}

export function FamilyStats({
    persons,
    familyName = 'Keluarga',
    className,
    compact = false
}: FamilyStatsProps) {
    // Calculate all statistics
    const stats = useMemo(() => {
        if (persons.length === 0) {
            return {
                total: 0,
                male: 0,
                female: 0,
                living: 0,
                deceased: 0,
                generations: 0,
                avgChildrenPerParent: 0,
                oldestBirth: null as string | null,
                newestBirth: null as string | null
            };
        }

        // Basic counts
        const male = persons.filter(p => p.gender === 'male').length;
        const female = persons.filter(p => p.gender === 'female').length;
        const living = persons.filter(p => p.isLiving).length;
        const deceased = persons.filter(p => !p.isLiving).length;

        // Calculate generations
        const personsMap = new Map(persons.map(p => [p.personId, p]));
        const rootAncestor = findRootAncestor(persons);
        let maxGeneration = 1;

        if (rootAncestor) {
            persons.forEach(p => {
                const gen = calculateGeneration(p.personId, rootAncestor.personId, personsMap);
                if (gen > maxGeneration) maxGeneration = gen;
            });
        }

        // Calculate average children per parent
        const parentsWithChildren = persons.filter(p => p.relationships.childIds.length > 0);
        const totalChildren = parentsWithChildren.reduce((sum, p) => sum + p.relationships.childIds.length, 0);
        const avgChildrenPerParent = parentsWithChildren.length > 0
            ? (totalChildren / parentsWithChildren.length).toFixed(1)
            : 0;

        // Find birth dates range
        const birthDates = persons
            .filter(p => p.birthDate)
            .map(p => p.birthDate!)
            .sort();

        return {
            total: persons.length,
            male,
            female,
            living,
            deceased,
            generations: maxGeneration,
            avgChildrenPerParent,
            oldestBirth: birthDates[0]?.split('-')[0] || null,
            newestBirth: birthDates[birthDates.length - 1]?.split('-')[0] || null
        };
    }, [persons]);

    // Define stat cards
    const statCards: StatCard[] = [
        { label: 'Total Anggota', value: stats.total, icon: '👥', color: 'bg-teal-500' },
        { label: 'Generasi', value: stats.generations, icon: '🌳', color: 'bg-emerald-500' },
        { label: 'Laki-laki', value: stats.male, icon: '♂️', color: 'bg-blue-500' },
        { label: 'Perempuan', value: stats.female, icon: '♀️', color: 'bg-pink-500' },
        { label: 'Masih Hidup', value: stats.living, icon: '💚', color: 'bg-green-500' },
        { label: 'Almarhum', value: stats.deceased, icon: '🕊️', color: 'bg-stone-500' },
    ];

    if (compact) {
        // Compact inline view
        return (
            <div className={clsx('flex items-center gap-4 text-sm', className)}>
                <span className="font-medium text-stone-700">{familyName}</span>
                <span className="text-stone-400">|</span>
                <span className="text-stone-600">👥 {stats.total}</span>
                <span className="text-stone-600">🌳 {stats.generations} gen</span>
                <span className="text-blue-600">♂ {stats.male}</span>
                <span className="text-pink-600">♀ {stats.female}</span>
            </div>
        );
    }

    // Full dashboard view
    return (
        <div className={clsx('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-stone-800">
                    📊 Statistik {familyName}
                </h3>
                {stats.oldestBirth && stats.newestBirth && (
                    <span className="text-sm text-stone-500">
                        {stats.oldestBirth} - {stats.newestBirth}
                    </span>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {statCards.map((stat, i) => (
                    <div
                        key={i}
                        className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{stat.icon}</span>
                            <span className="text-xs text-stone-500">{stat.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-stone-800">
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Additional Info */}
            <div className="flex items-center gap-4 text-sm text-stone-500">
                <span>📈 Rata-rata anak per orang tua: <strong>{stats.avgChildrenPerParent}</strong></span>
                {stats.total > 0 && (
                    <span>
                        ⚖️ Rasio L:P = <strong>{((stats.male / stats.total) * 100).toFixed(0)}:{((stats.female / stats.total) * 100).toFixed(0)}</strong>
                    </span>
                )}
            </div>
        </div>
    );
}

export default FamilyStats;
