// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Add Relationship Form Component
// Modal for creating relationships between persons
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo } from 'react';
import { Person, RelationshipType, CreateRelationshipInput } from '@/types';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { DualScriptDisplay } from '@/components/aksara/DualScriptDisplay';

export interface AddRelationshipFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateRelationshipInput) => void;
    persons: Person[];
    currentPersonId?: string;
    loading?: boolean;
}

export function AddRelationshipForm({
    isOpen,
    onClose,
    onSave,
    persons,
    currentPersonId,
    loading = false
}: AddRelationshipFormProps) {
    const [type, setType] = useState<RelationshipType>('spouse');
    const [person1Id, setPerson1Id] = useState(currentPersonId || '');
    const [person2Id, setPerson2Id] = useState('');
    const [marriageDate, setMarriageDate] = useState('');
    const [marriagePlace, setMarriagePlace] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Filter available persons (exclude already selected)
    const availablePersons1 = useMemo(() => {
        return persons.filter(p => p.personId !== person2Id);
    }, [persons, person2Id]);

    const availablePersons2 = useMemo(() => {
        return persons.filter(p => p.personId !== person1Id);
    }, [persons, person1Id]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!person1Id) newErrors.person1Id = 'Pilih orang pertama';
        if (!person2Id) newErrors.person2Id = 'Pilih orang kedua';
        if (person1Id === person2Id) newErrors.person2Id = 'Tidak bisa memilih orang yang sama';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        onSave({
            type,
            person1Id,
            person2Id,
            marriage: type === 'spouse' ? {
                date: marriageDate || undefined,
                place: marriagePlace || undefined,
                status: 'married'
            } : undefined
        });
    };

    const handleClose = () => {
        setType('spouse');
        setPerson1Id(currentPersonId || '');
        setPerson2Id('');
        setMarriageDate('');
        setMarriagePlace('');
        setErrors({});
        onClose();
    };

    const person1 = persons.find(p => p.personId === person1Id);
    const person2 = persons.find(p => p.personId === person2Id);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="🔗 Tambah Hubungan"
            size="md"
        >
            <form onSubmit={handleSubmit}>
                <ModalBody className="space-y-6">
                    {/* Relationship Type */}
                    <Select
                        label="Jenis Hubungan"
                        value={type}
                        onChange={(e) => setType(e.target.value as RelationshipType)}
                        options={[
                            { value: 'spouse', label: '🤝 Pasangan (Suami/Istri)' },
                            { value: 'parent-child', label: '👥 Orang Tua - Anak' }
                        ]}
                    />

                    {/* Preview */}
                    {person1 && person2 && (
                        <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                            <div className="flex items-center justify-center gap-4">
                                <div className="text-center">
                                    <div className="text-2xl mb-1">
                                        {person1.gender === 'male' ? '♂️' : person1.gender === 'female' ? '♀️' : '👤'}
                                    </div>
                                    <DualScriptDisplay latinText={person1.firstName} displayMode="both" size="sm" />
                                </div>

                                <div className="text-center px-4">
                                    <div className="text-2xl">
                                        {type === 'spouse' ? '🤝' : '👥'}
                                    </div>
                                    <div className="text-xs text-stone-500 mt-1">
                                        {type === 'spouse' ? 'Pasangan' : 'Orang Tua → Anak'}
                                    </div>
                                </div>

                                <div className="text-center">
                                    <div className="text-2xl mb-1">
                                        {person2.gender === 'male' ? '♂️' : person2.gender === 'female' ? '♀️' : '👤'}
                                    </div>
                                    <DualScriptDisplay latinText={person2.firstName} displayMode="both" size="sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Person Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label={type === 'parent-child' ? 'Orang Tua' : 'Orang Pertama'}
                            value={person1Id}
                            onChange={(e) => setPerson1Id(e.target.value)}
                            options={[
                                { value: '', label: '-- Pilih --' },
                                ...availablePersons1.map(p => ({
                                    value: p.personId,
                                    label: `${p.gender === 'male' ? '♂️' : '♀️'} ${p.fullName}`
                                }))
                            ]}
                            error={errors.person1Id}
                        />

                        <Select
                            label={type === 'parent-child' ? 'Anak' : 'Orang Kedua'}
                            value={person2Id}
                            onChange={(e) => setPerson2Id(e.target.value)}
                            options={[
                                { value: '', label: '-- Pilih --' },
                                ...availablePersons2.map(p => ({
                                    value: p.personId,
                                    label: `${p.gender === 'male' ? '♂️' : '♀️'} ${p.fullName}`
                                }))
                            ]}
                            error={errors.person2Id}
                        />
                    </div>

                    {/* Marriage Details (for spouse type) */}
                    {type === 'spouse' && (
                        <div className="p-4 bg-pink-50 rounded-xl border border-pink-200 space-y-4">
                            <div className="font-medium text-pink-700">💒 Detail Pernikahan (Opsional)</div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Tanggal Pernikahan"
                                    type="date"
                                    value={marriageDate}
                                    onChange={(e) => setMarriageDate(e.target.value)}
                                />
                                <Input
                                    label="Tempat Pernikahan"
                                    value={marriagePlace}
                                    onChange={(e) => setMarriagePlace(e.target.value)}
                                    placeholder="Kota/Tempat"
                                />
                            </div>
                        </div>
                    )}

                    {/* Help Text */}
                    <div className="text-sm text-stone-500 bg-stone-50 rounded-lg p-3">
                        {type === 'spouse' ? (
                            <p>💡 Hubungan pasangan akan menautkan kedua orang sebagai suami-istri.</p>
                        ) : (
                            <p>💡 Orang pertama akan menjadi orang tua dari orang kedua.</p>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                        Batal
                    </Button>
                    <Button type="submit" loading={loading} className="flex-1">
                        Simpan Hubungan
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}

export default AddRelationshipForm;
