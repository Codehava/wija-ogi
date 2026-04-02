// ═══════════════════════════════════════════════════════════════════════════════
// PersonSidebar — Detail/edit panel for the selected person
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { RefObject } from 'react';
import { Person, Relationship, ScriptMode, CreatePersonInput } from '@/types';
import { PersonCard } from '@/components/person/PersonCard';
import { SidebarEditForm } from '@/components/person/SidebarEditForm';
import { RelationshipContext } from '@/components/person/PersonForm';

interface PersonSidebarProps {
    person: Person;
    persons: Person[];
    relationships: Relationship[];
    scriptMode: ScriptMode;
    personGenerations: Map<string, number>;
    canEdit: boolean;
    isEditing: boolean;
    editingPerson: Person | null;
    formLoading: boolean;
    sidebarPhotoUploading: boolean;
    sidebarPhotoInputRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onCancelEdit: () => void;
    onSave: (data: CreatePersonInput) => void;
    onEdit: (person: Person) => void;
    onDelete: () => void;
    onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPhotoDelete: () => void;
    onQuickAdd: (type: RelationshipContext['type']) => void;
    onRemoveRelationship: (type: 'spouse' | 'parent' | 'child', relatedPersonId: string) => void;
    onLinkExisting: () => void;
}

export function PersonSidebar({
    person,
    persons,
    relationships,
    scriptMode,
    personGenerations,
    canEdit,
    isEditing,
    editingPerson,
    formLoading,
    sidebarPhotoUploading,
    sidebarPhotoInputRef,
    onClose,
    onCancelEdit,
    onSave,
    onEdit,
    onDelete,
    onPhotoUpload,
    onPhotoDelete,
    onQuickAdd,
    onRemoveRelationship,
    onLinkExisting,
}: PersonSidebarProps) {
    return (
        <>
            {/* Backdrop overlay — mobile only */}
            <div
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
                onClick={() => { if (isEditing) onCancelEdit(); else onClose(); }}
            />

            {/* Sidebar / Bottom Sheet */}
            <div className={`
                fixed z-50 bg-white shadow-2xl overflow-y-auto transition-all
                /* Mobile: bottom sheet */
                inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl border-t border-stone-200
                /* Desktop: right sidebar */
                md:inset-x-auto md:right-0 md:top-[72px] md:bottom-0 md:max-h-none md:rounded-t-none md:border-t-0 md:border-l md:border-stone-200
                ${isEditing ? 'md:w-96' : 'md:w-80'}
                animate-slide-in-right
            `}>
                {/* Drag handle — mobile only */}
                <div className="flex justify-center pt-2 pb-1 md:hidden">
                    <div className="w-10 h-1 rounded-full bg-stone-300" />
                </div>

                <div className="p-4 pt-2 md:pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-stone-800">
                            {isEditing ? '✏️ Edit Anggota' : 'Detail Anggota'}
                        </h3>
                        <button
                            onClick={() => {
                                if (isEditing) {
                                    onCancelEdit();
                                } else {
                                    onClose();
                                }
                            }}
                            className="p-1 hover:bg-stone-100 rounded-lg transition"
                        >
                            ✕
                        </button>
                    </div>

                    {isEditing && editingPerson ? (
                        <SidebarEditForm
                            onSave={onSave}
                            onCancel={onCancelEdit}
                            loading={formLoading}
                            initialData={{
                                firstName: editingPerson.firstName,
                                lastName: editingPerson.lastName || '',
                                middleName: editingPerson.middleName || '',
                                gender: editingPerson.gender,
                                birthDate: editingPerson.birthDate,
                                birthPlace: editingPerson.birthPlace,
                                birthOrder: editingPerson.birthOrder,
                                deathDate: editingPerson.deathDate,
                                deathPlace: editingPerson.deathPlace,
                                isLiving: editingPerson.isLiving,
                                occupation: editingPerson.occupation,
                                biography: editingPerson.biography,
                                isRootAncestor: editingPerson.isRootAncestor,
                                title: editingPerson.title,
                                reignTitle: editingPerson.reignTitle
                            }}
                        />
                    ) : (
                        <>
                            <PersonCard
                                person={person}
                                scriptMode={scriptMode}
                                generation={personGenerations.get(person.personId)}
                                showActions={canEdit}
                                onEdit={() => onEdit(person)}
                            />

                            {/* Photo Upload Section */}
                            {canEdit && (
                                <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                                    <input
                                        ref={sidebarPhotoInputRef as React.Ref<HTMLInputElement>}
                                        type="file"
                                        accept="image/*"
                                        onChange={onPhotoUpload}
                                        className="hidden"
                                        disabled={sidebarPhotoUploading}
                                    />
                                    <div className="text-xs text-stone-500 mb-2">📷 Foto Anggota</div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => sidebarPhotoInputRef.current?.click()}
                                            disabled={sidebarPhotoUploading}
                                            className="flex-1 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition disabled:opacity-50"
                                        >
                                            {sidebarPhotoUploading ? '⏳ Uploading...' : person.photoUrl ? '🔄 Ganti Foto' : '📷 Upload Foto'}
                                        </button>
                                        {person.photoUrl && !sidebarPhotoUploading && (
                                            <button
                                                onClick={onPhotoDelete}
                                                className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                                title="Hapus foto"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Existing Relationships */}
                    <div className="mt-4 pt-4 border-t border-stone-200">
                        <h4 className="font-medium text-stone-700 mb-2">Hubungan</h4>

                        {person.relationships.spouseIds.length > 0 && (
                            <div className="mb-3">
                                <div className="text-xs text-stone-500 mb-1">🤝 Pasangan</div>
                                {person.relationships.spouseIds.map(id => {
                                    const spouse = persons.find(p => p.personId === id);
                                    const rel = relationships.find(r =>
                                        r.type === 'spouse' &&
                                        ((r.person1Id === person.personId && r.person2Id === id) ||
                                            (r.person1Id === id && r.person2Id === person.personId))
                                    );
                                    const marriageOrderNum = rel?.marriage?.marriageOrder;

                                    return spouse ? (
                                        <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                            <div className="flex-1">
                                                <span className="text-sm text-stone-700">{spouse.fullName}</span>
                                                {marriageOrderNum && marriageOrderNum > 1 && (
                                                    <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                                                        Istri ke-{marriageOrderNum}
                                                    </span>
                                                )}
                                                {marriageOrderNum === 1 && person.relationships.spouseIds.length > 1 && (
                                                    <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                        Istri ke-1
                                                    </span>
                                                )}
                                            </div>
                                            {canEdit && (
                                                <button
                                                    onClick={() => onRemoveRelationship('spouse', id)}
                                                    className="text-xs text-red-500 hover:text-red-700 px-2"
                                                    title="Hapus hubungan"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {person.relationships.parentIds.length > 0 && (
                            <div className="mb-3">
                                <div className="text-xs text-stone-500 mb-1">👥 Orang Tua</div>
                                {person.relationships.parentIds.map(id => {
                                    const parent = persons.find(p => p.personId === id);
                                    return parent ? (
                                        <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                            <span className="text-sm text-stone-700">{parent.fullName}</span>
                                            {canEdit && (
                                                <button
                                                    onClick={() => onRemoveRelationship('parent', id)}
                                                    className="text-xs text-red-500 hover:text-red-700 px-2"
                                                    title="Hapus hubungan"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {person.relationships.childIds.length > 0 && (
                            <div className="mb-3">
                                <div className="text-xs text-stone-500 mb-1">👶 Anak</div>
                                {person.relationships.childIds.map(id => {
                                    const child = persons.find(p => p.personId === id);
                                    return child ? (
                                        <div key={id} className="flex items-center justify-between pl-4 py-1 hover:bg-stone-50 rounded">
                                            <span className="text-sm text-stone-700">{child.fullName}</span>
                                            {canEdit && (
                                                <button
                                                    onClick={() => onRemoveRelationship('child', id)}
                                                    className="text-xs text-red-500 hover:text-red-700 px-2"
                                                    title="Hapus hubungan"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        )}

                        {person.relationships.spouseIds.length === 0 &&
                            person.relationships.parentIds.length === 0 &&
                            person.relationships.childIds.length === 0 && (
                                <p className="text-sm text-stone-400 italic">Belum ada hubungan</p>
                            )}
                    </div>

                    {/* Quick-Add Relationship Buttons */}
                    {canEdit && (
                        <div className="mt-4 pt-4 border-t border-stone-200">
                            <h4 className="font-medium text-stone-700 mb-3">➕ Tambah Anggota Keluarga</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onQuickAdd('spouse')}
                                    className="px-3 py-2.5 text-sm bg-pink-50 text-pink-700 rounded-lg hover:bg-pink-100 transition border border-pink-200 font-medium text-left"
                                >
                                    🤝 Pasangan
                                </button>
                                {person.relationships.parentIds.length < 2 && (
                                    <>
                                        {!person.relationships.parentIds.some(id => {
                                            const p = persons.find(pp => pp.personId === id);
                                            return p?.gender === 'male';
                                        }) && (
                                                <button
                                                    onClick={() => onQuickAdd('father')}
                                                    className="px-3 py-2.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200 font-medium text-left"
                                                >
                                                    ♂️ Ayah
                                                </button>
                                            )}
                                        {!person.relationships.parentIds.some(id => {
                                            const p = persons.find(pp => pp.personId === id);
                                            return p?.gender === 'female';
                                        }) && (
                                                <button
                                                    onClick={() => onQuickAdd('mother')}
                                                    className="px-3 py-2.5 text-sm bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition border border-purple-200 font-medium text-left"
                                                >
                                                    ♀️ Ibu
                                                </button>
                                            )}
                                    </>
                                )}
                                <button
                                    onClick={() => onQuickAdd('son')}
                                    className="px-3 py-2.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200 font-medium text-left"
                                >
                                    ♂️ Anak Laki-laki
                                </button>
                                <button
                                    onClick={() => onQuickAdd('daughter')}
                                    className="px-3 py-2.5 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition border border-orange-200 font-medium text-left"
                                >
                                    ♀️ Anak Perempuan
                                </button>
                            </div>
                            <button
                                onClick={onLinkExisting}
                                className="w-full mt-2 px-3 py-2 text-sm bg-stone-50 text-stone-600 rounded-lg hover:bg-stone-100 transition border border-stone-200 font-medium"
                            >
                                🔗 Hubungkan ke yang Sudah Ada
                            </button>
                        </div>
                    )}

                    {/* Delete Member Button */}
                    {canEdit && (
                        <div className="mt-4 pt-4 border-t border-stone-200">
                            <button
                                onClick={onDelete}
                                disabled={formLoading}
                                className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                🗑️ Hapus Anggota
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
