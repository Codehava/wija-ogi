// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Members Page
// List of all family members with search and filters
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree } from '@/hooks/useFirestore';
import { useCanEdit } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Person, ScriptMode, CreatePersonInput, Gender } from '@/types';
import { personsApi } from '@/lib/api';
import { PersonCard } from '@/components/person/PersonCard';
import { PersonForm } from '@/components/person/PersonForm';
import { DualScriptDisplay } from '@/components/aksara/DualScriptDisplay';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { transliterateLatin } from '@/lib/transliteration/engine';

type SortBy = 'name' | 'birthDate' | 'generation';
type FilterGender = 'all' | Gender;

export default function MembersPage() {
    const params = useParams();
    const familyId = params.id as string;

    const { user } = useAuth();
    const { hasRole: canEdit } = useCanEdit(familyId);
    const { family, persons, personGenerations, loading, error } = useFamilyTree(familyId);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [filterGender, setFilterGender] = useState<FilterGender>('all');
    const [filterLiving, setFilterLiving] = useState<'all' | 'living' | 'deceased'>('all');
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [showPersonForm, setShowPersonForm] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Filter and sort persons
    const filteredPersons = useMemo(() => {
        let result = [...persons];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                p.fullName.toLowerCase().includes(query) ||
                p.firstName.toLowerCase().includes(query) ||
                p.lastName.toLowerCase().includes(query)
            );
        }

        // Gender filter
        if (filterGender !== 'all') {
            result = result.filter(p => p.gender === filterGender);
        }

        // Living filter
        if (filterLiving === 'living') {
            result = result.filter(p => p.isLiving);
        } else if (filterLiving === 'deceased') {
            result = result.filter(p => !p.isLiving);
        }

        // Sort
        result.sort((a, b) => {
            if (sortBy === 'name') {
                return a.fullName.localeCompare(b.fullName);
            } else if (sortBy === 'birthDate') {
                const dateA = a.birthDate || '9999';
                const dateB = b.birthDate || '9999';
                return dateA.localeCompare(dateB);
            } else if (sortBy === 'generation') {
                const genA = personGenerations.get(a.personId) ?? 999;
                const genB = personGenerations.get(b.personId) ?? 999;
                return genA - genB;
            }
            return 0;
        });

        return result;
    }, [persons, searchQuery, filterGender, filterLiving, sortBy, personGenerations]);

    // Handle add person
    const handleAddPerson = async (data: CreatePersonInput) => {
        if (!user) return;

        setFormLoading(true);
        try {
            await personsApi.createPerson(familyId, data);
            setShowPersonForm(false);
        } catch (err) {
            console.error('Failed to create person:', err);
        } finally {
            setFormLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat daftar anggota...</p>
                </div>
            </div>
        );
    }

    if (error || !family) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Error</h2>
                    <Link href="/" className="text-teal-600 hover:underline">← Kembali</Link>
                </div>
            </div>
        );
    }

    const familyLontara = transliterateLatin(family.name).lontara;

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-700 via-cyan-700 to-teal-800 text-white shadow-xl">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={`/family/${familyId}`} className="text-teal-200 hover:text-white transition">
                                ← Pohon
                            </Link>
                            <div className="h-8 w-px bg-teal-500"></div>
                            <div>
                                <h1 className="text-xl font-bold">{family.displayName || family.name}</h1>
                                <p className="text-teal-200 text-sm">Daftar Anggota</p>
                            </div>
                        </div>

                        {canEdit && (
                            <Button onClick={() => setShowPersonForm(true)} icon="➕">
                                Tambah Anggota
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="bg-white rounded-xl shadow-md p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <Input
                            placeholder="🔍 Cari anggota..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />

                        {/* Gender Filter */}
                        <Select
                            value={filterGender}
                            onChange={(e) => setFilterGender(e.target.value as FilterGender)}
                            options={[
                                { value: 'all', label: 'Semua Gender' },
                                { value: 'male', label: '♂️ Laki-laki' },
                                { value: 'female', label: '♀️ Perempuan' },
                                { value: 'other', label: '👤 Lainnya' }
                            ]}
                        />

                        {/* Living Filter */}
                        <Select
                            value={filterLiving}
                            onChange={(e) => setFilterLiving(e.target.value as typeof filterLiving)}
                            options={[
                                { value: 'all', label: 'Semua Status' },
                                { value: 'living', label: '🌱 Masih Hidup' },
                                { value: 'deceased', label: '🪦 Almarhum/ah' }
                            ]}
                        />

                        {/* Sort */}
                        <Select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            options={[
                                { value: 'name', label: '🔤 Nama A-Z' },
                                { value: 'birthDate', label: '📅 Tanggal Lahir' },
                                { value: 'generation', label: '🌳 Generasi' }
                            ]}
                        />
                    </div>

                    {/* Summary */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-200 text-sm text-stone-600">
                        <span>
                            Menampilkan {filteredPersons.length} dari {persons.length} anggota
                        </span>

                        {/* View Mode Toggle */}
                        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-1 rounded-md transition ${viewMode === 'grid' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                                    }`}
                            >
                                ▦ Grid
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1 rounded-md transition ${viewMode === 'list' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                                    }`}
                            >
                                ☰ List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Members Grid/List */}
                {filteredPersons.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-6xl mb-4">🔍</div>
                        <h3 className="text-lg font-semibold text-stone-700 mb-2">
                            Tidak ada anggota ditemukan
                        </h3>
                        <p className="text-stone-500">
                            {searchQuery ? 'Coba kata kunci lain' : 'Mulai dengan menambahkan anggota pertama'}
                        </p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPersons.map((person) => (
                            <PersonCard
                                key={person.personId}
                                person={person}
                                scriptMode={scriptMode}
                                generation={personGenerations.get(person.personId)}
                                showActions={canEdit}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-teal-50 border-b border-teal-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Nama</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden md:table-cell">Gender</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-600 hidden lg:table-cell">Tanggal Lahir</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Generasi</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-stone-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {filteredPersons.map((person) => {
                                    const gen = personGenerations.get(person.personId);
                                    return (
                                        <tr key={person.personId} className="hover:bg-teal-50 transition">
                                            <td className="px-4 py-3">
                                                <DualScriptDisplay
                                                    latinText={person.fullName}
                                                    displayMode={scriptMode}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className={person.gender === 'male' ? 'text-blue-600' : 'text-pink-600'}>
                                                    {person.gender === 'male' ? '♂️' : person.gender === 'female' ? '♀️' : '👤'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-stone-600 hidden lg:table-cell">
                                                {person.birthDate || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {gen !== undefined && gen >= 0 ? (
                                                    <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-xs">
                                                        Gen {gen}
                                                    </span>
                                                ) : (
                                                    <span className="text-stone-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/family/${familyId}/person/${person.personId}`}
                                                    className="text-teal-600 hover:underline text-sm"
                                                >
                                                    Detail →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Add Person Modal */}
            <PersonForm
                isOpen={showPersonForm}
                onClose={() => setShowPersonForm(false)}
                onSave={handleAddPerson}
                loading={formLoading}
            />
        </div>
    );
}
