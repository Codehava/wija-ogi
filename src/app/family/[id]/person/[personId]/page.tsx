// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Person Detail Page
// Detailed view of a single person with relationships
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree, useInvalidate } from '@/hooks/useFirestore';
import { useCanEdit } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Person, ScriptMode, CreatePersonInput } from '@/types';
import { personsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { PersonForm } from '@/components/person/PersonForm';
import { PersonNode } from '@/components/person/PersonNode';
import { DualScriptDisplay } from '@/components/aksara/DualScriptDisplay';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { getGenerationLabel, calculateGeneration } from '@/lib/generation/calculator';

export default function PersonDetailPage() {
    const params = useParams();
    const router = useRouter();
    const familyId = params.id as string;
    const personId = params.personId as string;

    const { user } = useAuth();
    const { hasRole: canEdit } = useCanEdit(familyId);
    const { family, persons, relationships, personsMap, personGenerations, loading } = useFamilyTree(familyId);
    const { invalidatePersons } = useInvalidate();

    // UI State
    const [showEditForm, setShowEditForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [photoUploading, setPhotoUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current person
    const person = useMemo(() => {
        return personsMap.get(personId) || null;
    }, [personsMap, personId]);

    // Get generation
    const generation = useMemo(() => {
        return personGenerations.get(personId) ?? -1;
    }, [personGenerations, personId]);

    // Get related persons
    const relatedPersons = useMemo(() => {
        if (!person) return { spouses: [], parents: [], children: [], siblings: [] };

        return {
            spouses: person.relationships.spouseIds
                .map(id => personsMap.get(id))
                .filter(Boolean) as Person[],
            parents: person.relationships.parentIds
                .map(id => personsMap.get(id))
                .filter(Boolean) as Person[],
            children: person.relationships.childIds
                .map(id => personsMap.get(id))
                .filter(Boolean) as Person[],
            siblings: person.relationships.siblingIds
                .map(id => personsMap.get(id))
                .filter(Boolean) as Person[]
        };
    }, [person, personsMap]);

    // Get marriage info for spouses
    const marriageInfo = useMemo(() => {
        if (!person) return new Map();

        const info = new Map<string, { date?: string; place?: string }>();
        relationships.forEach(rel => {
            if (rel.type === 'spouse' &&
                (rel.person1Id === personId || rel.person2Id === personId)) {
                const spouseId = rel.person1Id === personId ? rel.person2Id : rel.person1Id;
                info.set(spouseId, {
                    date: rel.marriage?.date,
                    place: rel.marriage?.place
                });
            }
        });
        return info;
    }, [person, relationships, personId]);

    // Handlers
    const handleUpdate = async (data: CreatePersonInput) => {
        if (!user) return;

        setFormLoading(true);
        try {
            await personsApi.updatePerson(familyId, personId, data);
            setShowEditForm(false);
        } catch (err) {
            console.error('Failed to update person:', err);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;

        setFormLoading(true);
        try {
            await personsApi.deletePerson(familyId, personId);
            router.push(`/family/${familyId}/members`);
        } catch (err) {
            console.error('Failed to delete person:', err);
        } finally {
            setFormLoading(false);
        }
    };

    // Handle photo upload
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setPhotoUploading(true);
        try {
            // Upload and compress photo
            const { photoUrl } = await personsApi.uploadPersonPhoto(familyId, personId, file);
            // Update person with new photo URL
            await personsApi.updatePerson(familyId, personId, { photoUrl } as any);
            invalidatePersons(familyId);
        } catch (err: any) {
            console.error('Failed to upload photo:', err);
            toast.error(err.message || 'Gagal mengunggah foto');
        } finally {
            setPhotoUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle photo delete
    const handlePhotoDelete = async () => {
        if (!user || !person?.photoUrl) return;

        setPhotoUploading(true);
        try {
            await personsApi.deletePersonPhoto(familyId, personId);
            await personsApi.updatePerson(familyId, personId, { photoUrl: '' } as any);
        } catch (err) {
            console.error('Failed to delete photo:', err);
        } finally {
            setPhotoUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat detail anggota...</p>
                </div>
            </div>
        );
    }

    if (!person || !family) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Anggota Tidak Ditemukan</h2>
                    <Link href={`/family/${familyId}/members`} className="text-teal-600 hover:underline">
                        ← Kembali ke Daftar
                    </Link>
                </div>
            </div>
        );
    }

    const genderIcon = person.gender === 'male' ? '♂️' : person.gender === 'female' ? '♀️' : '👤';
    const genderColor = person.gender === 'male' ? 'from-blue-600 to-blue-700' :
        person.gender === 'female' ? 'from-pink-600 to-pink-700' :
            'from-purple-600 to-purple-700';

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className={`bg-gradient-to-r ${genderColor} text-white shadow-xl`}>
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Link href={`/family/${familyId}/members`} className="opacity-80 hover:opacity-100 transition">
                            ← Daftar
                        </Link>
                        <span className="opacity-50">|</span>
                        <Link href={`/family/${familyId}`} className="opacity-80 hover:opacity-100 transition">
                            Pohon
                        </Link>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Avatar - Clickable for photo upload */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative group">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    disabled={!canEdit || photoUploading}
                                />
                                <div
                                    className={`w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl overflow-hidden ${canEdit ? 'cursor-pointer hover:ring-4 hover:ring-white/50 transition' : ''}`}
                                    onClick={() => canEdit && fileInputRef.current?.click()}
                                >
                                    {photoUploading ? (
                                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : person.photoUrl ? (
                                        <img src={person.photoUrl} alt={person.fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        genderIcon
                                    )}
                                </div>
                                {/* Upload hint on hover */}
                                {canEdit && !photoUploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                        <span className="text-white text-xl">📷</span>
                                    </div>
                                )}
                                {/* Delete photo button */}
                                {canEdit && person.photoUrl && !photoUploading && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePhotoDelete(); }}
                                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition shadow"
                                        title="Hapus foto"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            {/* Explicit Upload Button */}
                            {canEdit && !photoUploading && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-full transition flex items-center gap-1"
                                >
                                    📷 {person.photoUrl ? 'Ganti Foto' : 'Upload Foto'}
                                </button>
                            )}
                        </div>

                        {/* Name and Info */}
                        <div className="flex-1">
                            <DualScriptDisplay
                                latinText={person.fullName}
                                displayMode={scriptMode}
                                size="xl"
                                latinClassName="text-white font-bold"
                                lontaraClassName="text-white/80"
                            />

                            <div className="flex items-center gap-3 mt-2">
                                {generation >= 0 && (
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                        🌳 {getGenerationLabel(generation)}
                                    </span>
                                )}
                                {!person.isLiving && (
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                                        🪦 Almarhum/ah
                                    </span>
                                )}
                                {person.isRootAncestor && (
                                    <span className="bg-teal-400/30 px-3 py-1 rounded-full text-sm">
                                        👑 Leluhur
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        {canEdit && (
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setShowEditForm(true)}>
                                    ✏️ Edit
                                </Button>
                                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                                    🗑️
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Basic Info Card */}
                <Card>
                    <CardHeader gradient>
                        <h2 className="font-bold">📋 Informasi Dasar</h2>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div>
                                <div className="text-sm text-stone-500 mb-1">Jenis Kelamin</div>
                                <div className="font-medium">
                                    {genderIcon} {person.gender === 'male' ? 'Laki-laki' : person.gender === 'female' ? 'Perempuan' : 'Lainnya'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-stone-500 mb-1">Tanggal Lahir</div>
                                <div className="font-medium">
                                    {person.birthDate ? `🌟 ${person.birthDate}` : '-'}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-stone-500 mb-1">Tempat Lahir</div>
                                <div className="font-medium">{person.birthPlace || '-'}</div>
                            </div>

                            {!person.isLiving && (
                                <>
                                    <div>
                                        <div className="text-sm text-stone-500 mb-1">Tanggal Wafat</div>
                                        <div className="font-medium">
                                            {person.deathDate ? `🪦 ${person.deathDate}` : '-'}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm text-stone-500 mb-1">Tempat Wafat</div>
                                        <div className="font-medium">{person.deathPlace || '-'}</div>
                                    </div>
                                </>
                            )}

                            <div>
                                <div className="text-sm text-stone-500 mb-1">Pekerjaan</div>
                                <div className="font-medium">{person.occupation || '-'}</div>
                            </div>
                        </div>

                        {person.biography && (
                            <div className="mt-6 pt-6 border-t border-stone-200">
                                <div className="text-sm text-stone-500 mb-2">Biografi</div>
                                <p className="text-stone-700 whitespace-pre-line">{person.biography}</p>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Relationships Cards */}
                {relatedPersons.spouses.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="font-bold text-stone-800">🤝 Pasangan ({relatedPersons.spouses.length})</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {relatedPersons.spouses.map(spouse => {
                                    const marriage = marriageInfo.get(spouse.personId);
                                    return (
                                        <Link
                                            key={spouse.personId}
                                            href={`/family/${familyId}/person/${spouse.personId}`}
                                            className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg hover:bg-pink-100 transition"
                                        >
                                            <PersonNode person={spouse} scriptMode={scriptMode} compact />
                                            {marriage && (
                                                <div className="text-sm text-stone-600">
                                                    {marriage.date && <div>📅 {marriage.date}</div>}
                                                    {marriage.place && <div>📍 {marriage.place}</div>}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardBody>
                    </Card>
                )}

                {relatedPersons.parents.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="font-bold text-stone-800">👥‍♂️ Orang Tua ({relatedPersons.parents.length})</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {relatedPersons.parents.map(parent => (
                                    <Link
                                        key={parent.personId}
                                        href={`/family/${familyId}/person/${parent.personId}`}
                                        className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                    >
                                        <PersonNode person={parent} scriptMode={scriptMode} compact />
                                    </Link>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}

                {relatedPersons.children.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="font-bold text-stone-800">👶 Anak ({relatedPersons.children.length})</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relatedPersons.children.map(child => (
                                    <Link
                                        key={child.personId}
                                        href={`/family/${familyId}/person/${child.personId}`}
                                        className="p-3 bg-green-50 rounded-lg hover:bg-green-100 transition"
                                    >
                                        <PersonNode person={child} scriptMode={scriptMode} compact />
                                    </Link>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}

                {relatedPersons.siblings.length > 0 && (
                    <Card>
                        <CardHeader>
                            <h2 className="font-bold text-stone-800">👥 Saudara ({relatedPersons.siblings.length})</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relatedPersons.siblings.map(sibling => (
                                    <Link
                                        key={sibling.personId}
                                        href={`/family/${familyId}/person/${sibling.personId}`}
                                        className="p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                                    >
                                        <PersonNode person={sibling} scriptMode={scriptMode} compact />
                                    </Link>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </main>

            {/* Edit Form Modal */}
            <PersonForm
                isOpen={showEditForm}
                onClose={() => setShowEditForm(false)}
                onSave={handleUpdate}
                initialData={{
                    firstName: person.firstName,
                    lastName: person.lastName,
                    middleName: person.middleName,
                    gender: person.gender,
                    birthDate: person.birthDate,
                    birthPlace: person.birthPlace,
                    deathDate: person.deathDate,
                    deathPlace: person.deathPlace,
                    isLiving: person.isLiving,
                    occupation: person.occupation,
                    biography: person.biography,
                    isRootAncestor: person.isRootAncestor,
                    title: person.title,
                    reignTitle: person.reignTitle
                }}
                isEditing
                loading={formLoading}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="⚠️ Konfirmasi Hapus"
                size="sm"
            >
                <ModalBody>
                    <p className="text-stone-600">
                        Apakah Anda yakin ingin menghapus <strong>{person.fullName}</strong>?
                        Tindakan ini tidak dapat dibatalkan.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                        Batal
                    </Button>
                    <Button variant="danger" onClick={handleDelete} loading={formLoading} className="flex-1">
                        Hapus
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}
