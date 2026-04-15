// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Settings Page
// Settings and configuration for family
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFamilyTree } from '@/hooks/useFirestore';
import { useIsOwner, useIsAdmin } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';
import { ScriptMode, ThemeMode, Language } from '@/types';
import { familiesApi } from '@/lib/api';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { DualScriptDisplay } from '@/components/aksara/DualScriptDisplay';

export default function SettingsPage() {
    const params = useParams();
    const router = useRouter();
    const familyId = params.id as string;

    const { user } = useAuth();
    const { hasRole: isOwner, loading: ownerLoading } = useIsOwner(familyId);
    const { hasRole: isAdmin } = useIsAdmin(familyId);
    const { family, loading } = useFamilyTree(familyId);

    // Form state
    const [displayName, setDisplayName] = useState('');
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [themeMode, setThemeMode] = useState<ThemeMode>('klasik');
    const [language, setLanguage] = useState<Language>('id');
    const [saving, setSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Initialize form when family loads
    useEffect(() => {
        if (family) {
            setDisplayName(family.displayName || '');
            setScriptMode(family.settings.script);
            setThemeMode(family.settings.theme);
            setLanguage(family.settings.language);
        }
    }, [family]);

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            await familiesApi.updateFamily(familyId, {
                displayName,
                settings: {
                    script: scriptMode,
                    theme: themeMode,
                    language,
                },
            });
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user || deleteConfirmText !== family?.name) return;

        setSaving(true);
        try {
            await familiesApi.deleteFamily(familyId);
            router.push('/');
        } catch (err) {
            console.error('Failed to delete family:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading || ownerLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat pengaturan...</p>
                </div>
            </div>
        );
    }

    if (!family || !isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold text-stone-800 mb-2">Akses Ditolak</h2>
                    <p className="text-stone-600 mb-4">Anda tidak memiliki akses ke halaman ini.</p>
                    <Link href={`/family/${familyId}`} className="text-teal-600 hover:underline">
                        ← Kembali ke Pohon
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-700 via-cyan-700 to-teal-800 text-white shadow-xl">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-2">
                        <Link href={`/family/${familyId}`} className="text-teal-200 hover:text-white transition">
                            ← Kembali
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold">⚙️ Pengaturan Keluarga</h1>
                    <p className="text-teal-200 mt-1">{family.displayName || family.name}</p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Basic Settings */}
                <Card>
                    <CardHeader gradient>
                        <h2 className="font-bold">📋 Informasi Dasar</h2>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <div>
                            <div className="text-sm text-stone-500 mb-1">Nama Keluarga (ID)</div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono bg-stone-100 px-3 py-2 rounded-lg">{family.name}</span>
                                <DualScriptDisplay latinText={family.name} displayMode="lontara" size="md" />
                            </div>
                        </div>

                        <Input
                            label="Nama Tampilan"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Nama yang lebih deskriptif"
                            helperText="Nama ini akan ditampilkan di header"
                        />
                    </CardBody>
                </Card>

                {/* Display Settings */}
                <Card>
                    <CardHeader gradient>
                        <h2 className="font-bold">🎨 Tampilan</h2>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <Select
                            label="Mode Script"
                            value={scriptMode}
                            onChange={(e) => setScriptMode(e.target.value as ScriptMode)}
                            options={[
                                { value: 'latin', label: 'Latin saja' },
                                { value: 'lontara', label: 'Lontara saja' },
                                { value: 'both', label: 'Latin & Lontara' }
                            ]}
                        />

                        <Select
                            label="Tema Visual"
                            value={themeMode}
                            onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
                            options={[
                                { value: 'klasik', label: '🎨 Klasik' },
                                { value: 'nusantara', label: '✨ Nusantara' }
                            ]}
                        />

                        <Select
                            label="Bahasa"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as Language)}
                            options={[
                                { value: 'id', label: '🇮🇩 Indonesia' },
                                { value: 'en', label: '🇬🇧 English' }
                            ]}
                        />
                    </CardBody>
                    <CardFooter>
                        <Button onClick={handleSave} loading={saving} className="ml-auto">
                            💾 Simpan Pengaturan
                        </Button>
                    </CardFooter>
                </Card>

                {/* Statistics */}
                <Card>
                    <CardHeader gradient>
                        <h2 className="font-bold">📊 Statistik</h2>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-blue-600">{family.stats.personCount}</div>
                                <div className="text-sm text-stone-600">Anggota</div>
                            </div>
                            <div className="bg-pink-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-pink-600">{family.stats.relationshipCount}</div>
                                <div className="text-sm text-stone-600">Hubungan</div>
                            </div>
                            <div className="bg-teal-50 rounded-lg p-4">
                                <div className="text-3xl font-bold text-teal-600">{family.stats.memberCount}</div>
                                <div className="text-sm text-stone-600">Kontributor</div>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* Danger Zone - Owner Only */}
                {isOwner && (
                    <Card variant="outlined" className="border-red-200">
                        <CardHeader className="bg-red-50 border-b border-red-200">
                            <h2 className="font-bold text-red-700">⚠️ Zona Berbahaya</h2>
                        </CardHeader>
                        <CardBody>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-stone-800">Hapus Keluarga</div>
                                    <div className="text-sm text-stone-500">
                                        Semua data akan dihapus permanen
                                    </div>
                                </div>
                                <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                                    🗑️ Hapus
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </main>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                }}
                title="⚠️ Hapus Keluarga"
                size="md"
            >
                <ModalBody>
                    <div className="space-y-4">
                        <p className="text-stone-600">
                            Anda akan menghapus keluarga <strong>{family.name}</strong> dan semua datanya.
                            Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                        </p>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                            <strong>Yang akan dihapus:</strong>
                            <ul className="list-disc list-inside mt-2">
                                <li>{family.stats.personCount} anggota keluarga</li>
                                <li>{family.stats.relationshipCount} hubungan</li>
                                <li>Semua foto dan dokumen</li>
                                <li>Semua riwayat aktivitas</li>
                            </ul>
                        </div>

                        <Input
                            label={`Ketik "${family.name}" untuk konfirmasi`}
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={family.name}
                            error={deleteConfirmText && deleteConfirmText !== family.name ? 'Nama tidak cocok' : undefined}
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteConfirmText('');
                        }}
                        className="flex-1"
                    >
                        Batal
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDelete}
                        loading={saving}
                        disabled={deleteConfirmText !== family.name}
                        className="flex-1"
                    >
                        Hapus Permanen
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
}
