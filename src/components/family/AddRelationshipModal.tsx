// ═══════════════════════════════════════════════════════════════════════════════
// AddRelationshipModal — Modal for linking existing family members
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { Person } from '@/types';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface AddRelationshipModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPerson: Person | null;
    availablePersons: Person[];
    relationType: 'spouse' | 'parent' | 'child';
    targetPersonId: string;
    marriageOrder: number;
    loading: boolean;
    onRelationTypeChange: (type: 'spouse' | 'parent' | 'child') => void;
    onTargetPersonChange: (id: string) => void;
    onMarriageOrderChange: (order: number) => void;
    onSubmit: () => void;
}

export function AddRelationshipModal({
    isOpen,
    onClose,
    selectedPerson,
    availablePersons,
    relationType,
    targetPersonId,
    marriageOrder,
    loading,
    onRelationTypeChange,
    onTargetPersonChange,
    onMarriageOrderChange,
    onSubmit,
}: AddRelationshipModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="🔗 Tambah Hubungan"
            size="md"
        >
            <ModalBody className="space-y-4">
                {selectedPerson && (
                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                        <div className="text-sm text-teal-600">Menghubungkan</div>
                        <div className="font-medium text-teal-800">{selectedPerson.fullName}</div>
                    </div>
                )}

                <Select
                    label="Jenis Hubungan"
                    value={relationType}
                    onChange={(e) => {
                        onRelationTypeChange(e.target.value as 'spouse' | 'parent' | 'child');
                        onTargetPersonChange('');
                    }}
                    options={[
                        { value: 'spouse', label: '🤝 Pasangan (Suami/Istri)' },
                        { value: 'parent', label: '👥 Orang ini adalah ORANG TUA dari...' },
                        { value: 'child', label: '👶 Orang ini adalah ANAK dari...' }
                    ]}
                />

                <SearchableSelect
                    label={
                        relationType === 'spouse'
                            ? 'Pilih Pasangan'
                            : relationType === 'parent'
                                ? 'Pilih Anak'
                                : 'Pilih Orang Tua'
                    }
                    value={targetPersonId}
                    onChange={(value) => onTargetPersonChange(value)}
                    placeholder="Ketik nama untuk mencari..."
                    options={
                        availablePersons.map(p => ({
                            value: p.personId,
                            label: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || p.fullName
                        }))
                    }
                />

                {/* Marriage Order - only for spouse relationships */}
                {relationType === 'spouse' && selectedPerson && selectedPerson.relationships.spouseIds.length > 0 && (
                    <Select
                        label="Urutan Istri (untuk poligami)"
                        value={marriageOrder.toString()}
                        onChange={(e) => onMarriageOrderChange(parseInt(e.target.value))}
                        options={[
                            { value: '1', label: 'Istri ke-1' },
                            { value: '2', label: 'Istri ke-2' },
                            { value: '3', label: 'Istri ke-3' },
                            { value: '4', label: 'Istri ke-4' }
                        ]}
                    />
                )}

                {availablePersons.length === 0 && (
                    <p className="text-sm text-stone-500 text-center">
                        Tidak ada anggota keluarga lain yang tersedia untuk hubungan ini.
                    </p>
                )}
            </ModalBody>

            <ModalFooter>
                <Button
                    variant="secondary"
                    onClick={onClose}
                    className="flex-1"
                >
                    Batal
                </Button>
                <Button
                    onClick={onSubmit}
                    loading={loading}
                    disabled={!targetPersonId}
                    className="flex-1"
                >
                    Tambah Hubungan
                </Button>
            </ModalFooter>
        </Modal>
    );
}
