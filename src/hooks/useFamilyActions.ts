// ═══════════════════════════════════════════════════════════════════════════════
// useFamilyActions — Extracted handler logic from family page
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidate } from '@/hooks/useFirestore';
import { Person, CreatePersonInput } from '@/types';
import { personsApi, relationshipsApi } from '@/lib/api';
import { RelationshipContext } from '@/components/person/PersonForm';
import toast from 'react-hot-toast';

interface UseFamilyActionsParams {
    familyId: string;
    persons: Person[];
    family?: { displayName?: string; name: string } | null;
    isSuperAdmin: boolean;
}

export function useFamilyActions({ familyId, persons, family, isSuperAdmin }: UseFamilyActionsParams) {
    const { user } = useAuth();
    const { invalidatePersons, invalidateRelationships } = useInvalidate();

    // State
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [showPersonForm, setShowPersonForm] = useState(false);
    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);
    const [isEditingSidebar, setIsEditingSidebar] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [showGedcomImport, setShowGedcomImport] = useState(false);
    const [exportingGedcom, setExportingGedcom] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [addMemberContext, setAddMemberContext] = useState<RelationshipContext | null>(null);

    // Relationship form state
    const [relationType, setRelationType] = useState<'spouse' | 'parent' | 'child'>('spouse');
    const [targetPersonId, setTargetPersonId] = useState<string>('');
    const [marriageOrder, setMarriageOrder] = useState<number>(1);

    // Photo upload
    const [sidebarPhotoUploading, setSidebarPhotoUploading] = useState(false);
    const sidebarPhotoInputRef = useRef<HTMLInputElement>(null);

    // ─── Handlers ──────────────────────────────────────────────────────

    const handleAddPerson = useCallback(() => {
        setEditingPerson(null);
        setAddMemberContext(null);
        setShowPersonForm(true);
    }, []);

    const handleQuickAdd = useCallback((type: RelationshipContext['type']) => {
        if (!selectedPerson) return;
        setEditingPerson(null);
        setAddMemberContext({ type, referencePerson: selectedPerson.fullName });
        setShowPersonForm(true);
    }, [selectedPerson]);

    const handleExportGedcom = useCallback(async () => {
        setExportingGedcom(true);
        try {
            const res = await fetch(`/api/gedcom/export/${familyId}`);
            if (!res.ok) throw new Error('Failed to export');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${family?.displayName || family?.name || 'family-tree'}.ged`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('File GEDCOM berhasil diunduh!');
        } catch (err) {
            console.error('GEDCOM export error:', err);
            toast.error('Gagal mengekspor GEDCOM');
        } finally {
            setExportingGedcom(false);
        }
    }, [familyId, family]);

    const handleRegenerateLontara = useCallback(async () => {
        if (!isSuperAdmin) return;
        setRegenerating(true);
        try {
            const result = await personsApi.regenerateAllLontaraNames(familyId);
            toast.success(`Berhasil regenerate ${result.count} nama Lontara!`);
            invalidatePersons(familyId);
        } catch (err) {
            console.error('Failed to regenerate Lontara:', err);
            toast.error('Gagal regenerate Lontara');
        } finally {
            setRegenerating(false);
        }
    }, [familyId, invalidatePersons, isSuperAdmin]);

    const handleEditPerson = useCallback((person: Person) => {
        setEditingPerson(person);
        setIsEditingSidebar(true);
    }, []);

    const handleSavePerson = useCallback(async (data: CreatePersonInput) => {
        if (!user) return;
        setFormLoading(true);
        try {
            if (editingPerson) {
                await personsApi.updatePerson(familyId, editingPerson.personId, data);
                setIsEditingSidebar(false);
                setEditingPerson(null);
                if (selectedPerson?.personId === editingPerson.personId) {
                    setSelectedPerson(null);
                }
            } else {
                const newPerson = await personsApi.createPerson(familyId, data);
                if (addMemberContext && selectedPerson && newPerson?.personId) {
                    try {
                        const ctx = addMemberContext;
                        if (ctx.type === 'spouse') {
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'spouse',
                                person1Id: selectedPerson.personId,
                                person2Id: newPerson.personId,
                                marriage: { status: 'married', marriageOrder: (selectedPerson.relationships.spouseIds.length || 0) + 1 }
                            });
                            await personsApi.addSpouse(familyId, selectedPerson.personId, newPerson.personId);
                        } else if (ctx.type === 'father' || ctx.type === 'mother') {
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'parent-child',
                                person1Id: newPerson.personId,
                                person2Id: selectedPerson.personId
                            });
                            await personsApi.addParentChild(familyId, newPerson.personId, selectedPerson.personId);
                            const existingParentIds = selectedPerson.relationships.parentIds;
                            if (existingParentIds.length > 0) {
                                for (const existingParentId of existingParentIds) {
                                    const existingParent = persons.find(p => p.personId === existingParentId);
                                    if (!existingParent) continue;
                                    const newGender = ctx.type === 'father' ? 'male' : 'female';
                                    if (existingParent.gender !== newGender) {
                                        if (!existingParent.relationships.spouseIds.includes(newPerson.personId)) {
                                            await relationshipsApi.createRelationship(familyId, {
                                                type: 'spouse',
                                                person1Id: existingParentId,
                                                person2Id: newPerson.personId,
                                                marriage: { status: 'married', marriageOrder: 1 }
                                            });
                                            await personsApi.addSpouse(familyId, existingParentId, newPerson.personId);
                                        }
                                    }
                                }
                            }
                        } else if (ctx.type === 'son' || ctx.type === 'daughter') {
                            await relationshipsApi.createRelationship(familyId, {
                                type: 'parent-child',
                                person1Id: selectedPerson.personId,
                                person2Id: newPerson.personId
                            });
                            await personsApi.addParentChild(familyId, selectedPerson.personId, newPerson.personId);
                            const spouseIds = selectedPerson.relationships.spouseIds;
                            if (spouseIds.length > 0) {
                                const firstSpouseId = spouseIds[0];
                                await relationshipsApi.createRelationship(familyId, {
                                    type: 'parent-child',
                                    person1Id: firstSpouseId,
                                    person2Id: newPerson.personId
                                });
                                await personsApi.addParentChild(familyId, firstSpouseId, newPerson.personId);
                            }
                        }
                        invalidateRelationships(familyId);
                        toast.success(`Berhasil menambahkan ${data.firstName} dan menghubungkan relasi!`);
                    } catch (relErr) {
                        console.error('Person created but relationship failed:', relErr);
                        toast.error('Anggota berhasil ditambahkan, tapi gagal menghubungkan relasi.');
                    }
                }
            }
            invalidatePersons(familyId);
            setShowPersonForm(false);
            setEditingPerson(null);
            setAddMemberContext(null);
        } catch (err) {
            console.error('Failed to save person:', err);
            toast.error('Gagal menyimpan anggota: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, user, editingPerson, selectedPerson, addMemberContext, persons, invalidatePersons, invalidateRelationships]);

    const handleAddRelationship = useCallback(async () => {
        if (!user || !selectedPerson || !targetPersonId) return;
        setFormLoading(true);
        try {
            if (relationType === 'spouse') {
                await relationshipsApi.createRelationship(familyId, {
                    type: 'spouse',
                    person1Id: selectedPerson.personId,
                    person2Id: targetPersonId,
                    marriage: { status: 'married', marriageOrder }
                });
                await personsApi.addSpouse(familyId, selectedPerson.personId, targetPersonId);
            } else if (relationType === 'parent') {
                await relationshipsApi.createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: selectedPerson.personId,
                    person2Id: targetPersonId
                });
                await personsApi.addParentChild(familyId, selectedPerson.personId, targetPersonId);
            } else if (relationType === 'child') {
                await relationshipsApi.createRelationship(familyId, {
                    type: 'parent-child',
                    person1Id: targetPersonId,
                    person2Id: selectedPerson.personId
                });
                await personsApi.addParentChild(familyId, targetPersonId, selectedPerson.personId);
            }
            invalidatePersons(familyId);
            invalidateRelationships(familyId);
            setShowRelationshipModal(false);
            setTargetPersonId('');
            setMarriageOrder(1);
        } catch (err) {
            console.error('Failed to create relationship:', err);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, user, selectedPerson, targetPersonId, relationType, marriageOrder, invalidatePersons, invalidateRelationships]);

    const getAvailablePersons = useCallback(() => {
        if (!selectedPerson) return [];
        return persons.filter(p => {
            if (p.personId === selectedPerson.personId) return false;
            if (relationType === 'spouse') return !selectedPerson.relationships.spouseIds.includes(p.personId);
            if (relationType === 'parent') return !selectedPerson.relationships.childIds.includes(p.personId);
            if (relationType === 'child') return !selectedPerson.relationships.parentIds.includes(p.personId);
            return true;
        });
    }, [persons, selectedPerson, relationType]);

    const handleDeletePerson = useCallback(async () => {
        if (!selectedPerson || !user) return;
        const confirmDelete = window.confirm(`Hapus ${selectedPerson.fullName}? Tindakan ini tidak dapat dibatalkan.`);
        if (!confirmDelete) return;
        setFormLoading(true);
        try {
            await personsApi.deletePerson(familyId, selectedPerson.personId);
            invalidatePersons(familyId);
            invalidateRelationships(familyId);
            setSelectedPerson(null);
        } catch (err) {
            console.error('Failed to delete person:', err);
            toast.error('Gagal menghapus anggota: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, selectedPerson, user, invalidatePersons, invalidateRelationships]);

    const handleRemoveRelationship = useCallback(async (
        type: 'spouse' | 'parent' | 'child',
        relatedPersonId: string
    ) => {
        if (!selectedPerson || !user) return;
        const relatedPerson = persons.find(p => p.personId === relatedPersonId);
        const confirmRemove = window.confirm(`Hapus hubungan dengan ${relatedPerson?.fullName || 'orang ini'}?`);
        if (!confirmRemove) return;
        setFormLoading(true);
        try {
            if (type === 'spouse') {
                await personsApi.removeSpouse(familyId, selectedPerson.personId, relatedPersonId);
            } else if (type === 'parent') {
                await personsApi.removeParentChild(familyId, relatedPersonId, selectedPerson.personId);
            } else if (type === 'child') {
                await personsApi.removeParentChild(familyId, selectedPerson.personId, relatedPersonId);
            }
            invalidatePersons(familyId);
            invalidateRelationships(familyId);
        } catch (err) {
            console.error('Failed to remove relationship:', err);
            toast.error('Gagal menghapus hubungan: ' + (err as Error).message);
        } finally {
            setFormLoading(false);
        }
    }, [familyId, selectedPerson, user, persons, invalidatePersons, invalidateRelationships]);

    const handlePositionChange = useCallback(async (personId: string, position: { x: number; y: number }) => {
        try {
            await personsApi.updatePersonPosition(familyId, personId, { ...position, fixed: true });
        } catch (err) {
            console.error('Failed to save position:', err);
        }
    }, [familyId]);

    const handleAllPositionsChange = useCallback(async (positions: Map<string, { x: number; y: number }>) => {
        try {
            await personsApi.updateAllPersonPositions(familyId, Object.fromEntries(positions));
        } catch (err) {
            console.error('Failed to save all positions:', err);
        }
    }, [familyId]);

    const handleSidebarPhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user || !selectedPerson) return;
        setSidebarPhotoUploading(true);
        try {
            const { photoUrl } = await personsApi.uploadPersonPhoto(familyId, selectedPerson.personId, file);
            await personsApi.updatePerson(familyId, selectedPerson.personId, { photoUrl } as any);
            invalidatePersons(familyId);
        } catch (err: any) {
            console.error('Failed to upload photo:', err);
            toast.error(err.message || 'Gagal mengunggah foto');
        } finally {
            setSidebarPhotoUploading(false);
            if (sidebarPhotoInputRef.current) {
                sidebarPhotoInputRef.current.value = '';
            }
        }
    }, [familyId, user, selectedPerson, invalidatePersons]);

    const handleSidebarPhotoDelete = useCallback(async () => {
        if (!user || !selectedPerson?.photoUrl) return;
        setSidebarPhotoUploading(true);
        try {
            await personsApi.deletePersonPhoto(familyId, selectedPerson.personId);
            await personsApi.updatePerson(familyId, selectedPerson.personId, { photoUrl: '' } as any);
        } catch (err) {
            console.error('Failed to delete photo:', err);
        } finally {
            setSidebarPhotoUploading(false);
        }
    }, [familyId, user, selectedPerson]);

    return {
        // State
        selectedPerson, setSelectedPerson,
        showPersonForm, setShowPersonForm,
        showRelationshipModal, setShowRelationshipModal,
        formLoading,
        editingPerson, setEditingPerson,
        isEditingSidebar, setIsEditingSidebar,
        regenerating,
        showGedcomImport, setShowGedcomImport,
        exportingGedcom,
        showExportModal, setShowExportModal,
        addMemberContext, setAddMemberContext,
        relationType, setRelationType,
        targetPersonId, setTargetPersonId,
        marriageOrder, setMarriageOrder,
        sidebarPhotoUploading,
        sidebarPhotoInputRef,

        // Handlers
        handleAddPerson,
        handleQuickAdd,
        handleExportGedcom,
        handleRegenerateLontara,
        handleEditPerson,
        handleSavePerson,
        handleAddRelationship,
        getAvailablePersons,
        handleDeletePerson,
        handleRemoveRelationship,
        handlePositionChange,
        handleAllPositionsChange,
        handleSidebarPhotoUpload,
        handleSidebarPhotoDelete,
    };
}
