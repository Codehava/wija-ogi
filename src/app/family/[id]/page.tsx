// ═══════════════════════════════════════════════════════════════════════════════
// Family Page — Composed from extracted components
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ScriptMode, Gender } from '@/types';
import { useFamilyTree, useInvalidate } from '@/hooks/useFirestore';
import { useCanEdit, useIsAdmin, useIsSuperAdmin } from '@/hooks/useAuth';
import { useFamilyActions } from '@/hooks/useFamilyActions';
import { FamilyTree } from '@/components/tree/FamilyTree';
import { SkeletonTreeView } from '@/components/ui/Skeleton';
import { PersonForm } from '@/components/person/PersonForm';
import GedcomImport from '@/components/gedcom/GedcomImport';
import ExportModal from '@/components/export/ExportModal';
import { prepareExportData, generateTreeSVG } from '@/lib/services/exports';
import { FamilyHeader } from '@/components/family/FamilyHeader';
import { PersonSidebar } from '@/components/family/PersonSidebar';
import { AddRelationshipModal } from '@/components/family/AddRelationshipModal';

export default function FamilyPage() {
    const params = useParams();
    const familyId = params.id as string;

    const { hasRole: canEdit } = useCanEdit(familyId);
    const { hasRole: isAdmin } = useIsAdmin(familyId);
    const { isSuperAdmin } = useIsSuperAdmin();
    const {
        family,
        persons,
        relationships,
        personGenerations,
        stats,
        loading,
        error
    } = useFamilyTree(familyId);
    const { invalidatePersons, invalidateRelationships } = useInvalidate();

    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');

    const actions = useFamilyActions({
        familyId,
        persons,
        family,
        isSuperAdmin,
    });

    const availablePersons = actions.getAvailablePersons();

    // ─── Loading / Error ─────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <SkeletonTreeView />
            </div>
        );
    }

    if (error || !family) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">😕</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Keluarga Tidak Ditemukan</h2>
                    <p className="text-stone-600 mb-4">
                        Keluarga ini mungkin telah dihapus atau Anda tidak memiliki akses.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-medium hover:from-teal-600 hover:to-cyan-600 transition"
                    >
                        ← Kembali ke Beranda
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden overscroll-none bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <FamilyHeader
                family={family}
                familyId={familyId}
                scriptMode={scriptMode}
                onScriptModeChange={setScriptMode}
                totalGenerations={stats.totalGenerations}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                regenerating={actions.regenerating}
                exportingGedcom={actions.exportingGedcom}
                onRegenerateLontara={actions.handleRegenerateLontara}
                onImportGedcom={() => actions.setShowGedcomImport(true)}
                onExportGedcom={actions.handleExportGedcom}
                onExportSVG={() => actions.setShowExportModal(true)}
            />

            {/* Main Content */}
            <div className="flex h-[calc(100vh-72px)]">
                {/* Tree View */}
                <div className="flex-1 relative">
                    <FamilyTree
                        persons={persons}
                        relationships={relationships}
                        scriptMode={scriptMode}
                        selectedPersonId={actions.selectedPerson?.personId}
                        onPersonClick={(p) => actions.setSelectedPerson(p)}
                        editable={canEdit}
                        onAddPerson={actions.handleAddPerson}
                        familyName={family?.displayName || family?.name || 'Pohon Keluarga'}
                        familyId={familyId}
                        onPositionChange={actions.handlePositionChange}
                        onAllPositionsChange={actions.handleAllPositionsChange}
                    />
                </div>

                {/* Sidebar */}
                {actions.selectedPerson && (
                    <PersonSidebar
                        person={actions.selectedPerson}
                        persons={persons}
                        relationships={relationships}
                        scriptMode={scriptMode}
                        personGenerations={personGenerations}
                        canEdit={canEdit}
                        isEditing={actions.isEditingSidebar}
                        editingPerson={actions.editingPerson}
                        formLoading={actions.formLoading}
                        sidebarPhotoUploading={actions.sidebarPhotoUploading}
                        sidebarPhotoInputRef={actions.sidebarPhotoInputRef}
                        onClose={() => actions.setSelectedPerson(null)}
                        onCancelEdit={() => {
                            actions.setIsEditingSidebar(false);
                            actions.setEditingPerson(null);
                        }}
                        onSave={actions.handleSavePerson}
                        onEdit={actions.handleEditPerson}
                        onDelete={actions.handleDeletePerson}
                        onPhotoUpload={actions.handleSidebarPhotoUpload}
                        onPhotoDelete={actions.handleSidebarPhotoDelete}
                        onQuickAdd={actions.handleQuickAdd}
                        onRemoveRelationship={actions.handleRemoveRelationship}
                        onLinkExisting={() => {
                            actions.setRelationType('spouse');
                            actions.setTargetPersonId('');
                            actions.setShowRelationshipModal(true);
                        }}
                    />
                )}
            </div>

            {/* Add/Edit Person Modal */}
            <PersonForm
                isOpen={actions.showPersonForm}
                onClose={() => {
                    actions.setShowPersonForm(false);
                    actions.setEditingPerson(null);
                    actions.setAddMemberContext(null);
                }}
                onSave={actions.handleSavePerson}
                loading={actions.formLoading}
                isEditing={!!actions.editingPerson}
                relationshipContext={actions.addMemberContext || undefined}
                initialData={actions.editingPerson ? {
                    firstName: actions.editingPerson.firstName,
                    lastName: actions.editingPerson.lastName || '',
                    middleName: actions.editingPerson.middleName || '',
                    gender: actions.editingPerson.gender,
                    birthDate: actions.editingPerson.birthDate,
                    birthPlace: actions.editingPerson.birthPlace,
                    birthOrder: actions.editingPerson.birthOrder,
                    deathDate: actions.editingPerson.deathDate,
                    deathPlace: actions.editingPerson.deathPlace,
                    isLiving: actions.editingPerson.isLiving,
                    occupation: actions.editingPerson.occupation,
                    biography: actions.editingPerson.biography,
                    isRootAncestor: actions.editingPerson.isRootAncestor,
                    title: actions.editingPerson.title,
                    reignTitle: actions.editingPerson.reignTitle
                } : actions.addMemberContext ? {
                    gender: (() => {
                        const genderMap: Record<string, Gender> = {
                            father: 'male', mother: 'female', son: 'male', daughter: 'female',
                            spouse: actions.selectedPerson?.gender === 'male' ? 'female' : 'male',
                        };
                        return genderMap[actions.addMemberContext!.type] || 'male';
                    })()
                } : undefined}
            />

            {/* Add Relationship Modal */}
            <AddRelationshipModal
                isOpen={actions.showRelationshipModal}
                onClose={() => actions.setShowRelationshipModal(false)}
                selectedPerson={actions.selectedPerson}
                availablePersons={availablePersons}
                relationType={actions.relationType}
                targetPersonId={actions.targetPersonId}
                marriageOrder={actions.marriageOrder}
                loading={actions.formLoading}
                onRelationTypeChange={actions.setRelationType}
                onTargetPersonChange={actions.setTargetPersonId}
                onMarriageOrderChange={actions.setMarriageOrder}
                onSubmit={actions.handleAddRelationship}
            />

            {/* GEDCOM Import Modal */}
            {actions.showGedcomImport && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
                    <GedcomImport
                        treeId={familyId}
                        treeName={family?.displayName || family?.name}
                        onImportComplete={(result) => {
                            invalidatePersons(familyId);
                            invalidateRelationships(familyId);
                            toast.success(`Berhasil import ${result.personsCount} anggota dan ${result.relationshipsCount} hubungan!`);
                        }}
                        onClose={() => actions.setShowGedcomImport(false)}
                    />
                </div>
            )}

            {/* Export Modal */}
            <ExportModal
                isOpen={actions.showExportModal}
                onClose={() => actions.setShowExportModal(false)}
                onExport={async (options) => {
                    if (!family) return;
                    const data = prepareExportData(family, persons, relationships, personGenerations, options);
                    const svg = generateTreeSVG(data, {
                        width: options.format.paperSize === 'A4' ? 2480 : options.format.paperSize === 'A3' ? 3508 : 4961,
                        height: options.format.paperSize === 'A4' ? 3508 : options.format.paperSize === 'A3' ? 4961 : 7016,
                        scriptMode: options.scriptOptions.script || 'both',
                        nodeWidth: 180,
                        nodeHeight: 80,
                        horizontalGap: 40,
                        verticalGap: 60,
                    });
                    const blob = new Blob([svg], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${family.displayName || family.name}-pohon-keluarga.svg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast.success('File SVG berhasil diunduh!');
                }}
                familyName={family?.displayName || family?.name || 'Pohon Keluarga'}
                personCount={persons.length}
            />
        </div>
    );
}
