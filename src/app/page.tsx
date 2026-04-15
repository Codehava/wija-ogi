// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Home Page
// Landing page with family selection
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeSelector } from '@/contexts/ThemeContext';
import { useUserFamilies } from '@/hooks/useFirestore';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { familiesApi } from '@/lib/api';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { HeroSection } from '@/components/landing/HeroSection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { FeatureGrid } from '@/components/landing/FeatureGrid';

export default function HomePage() {
    const router = useRouter();
    const { user, loading: authLoading, isAuthenticated, signInGoogle, signOut } = useAuth();
    const { families, loading: familiesLoading, refresh } = useUserFamilies();

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [familyName, setFamilyName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const loading = authLoading || familiesLoading;

    // Transliterate WIJA for display
    const wijaLontara = transliterateLatin('wija').lontara;

    // Handle create family
    const handleCreateFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!familyName.trim()) {
            setError('Nama keluarga wajib diisi');
            return;
        }

        if (!user) {
            setError('Anda harus login terlebih dahulu');
            return;
        }

        setCreating(true);
        try {
            const family = await familiesApi.createFamily(
                {
                    name: familyName.trim(),
                    displayName: displayName.trim() || undefined
                }
            );

            // Refresh list and navigate to new family
            await refresh?.();
            setShowCreateModal(false);
            setFamilyName('');
            setDisplayName('');
            router.push(`/family/${family.familyId}`);
        } catch (err: any) {
            console.error('Failed to create family:', err);
            setError(err.message || 'Gagal membuat keluarga. Silakan coba lagi.');
        } finally {
            setCreating(false);
        }
    };

    const handleOpenCreateModal = () => {
        setFamilyName('');
        setDisplayName('');
        setError('');
        setShowCreateModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                {/* Skeleton header */}
                <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                    <div className="max-w-7xl mx-auto px-4 py-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-white/20 animate-pulse" />
                            <div>
                                <div className="h-7 w-24 bg-white/20 rounded animate-pulse mb-2" />
                                <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Skeleton family cards */}
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Image
                                src="/logo.png"
                                alt="WIJA Logo"
                                width={56}
                                height={56}
                                className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1"
                                priority
                            />
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    WIJA-Ogi
                                </h1>
                                <p className="text-teal-200 text-sm">Warisan Jejak Keluarga Bugis</p>
                            </div>
                        </div>

                        {isAuthenticated && (
                            <div className="flex items-center gap-2">
                                <ThemeSelector />
                                <span className="text-teal-200 text-sm hidden sm:block">
                                    {user?.email}
                                </span>
                                <button
                                    onClick={() => signOut()}
                                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition press-effect"
                                >
                                    Keluar
                                </button>
                            </div>
                        )}
                        {!isAuthenticated && (
                            <ThemeSelector />
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col">
                {!isAuthenticated ? (
                    /* Landing Page - New Redesign */
                    <div className="flex-1 flex flex-col min-h-screen">
                        <HeroSection onLogin={() => signInGoogle()} />
                        <PhilosophySection />
                        <FeatureGrid />

                        {/* Footer (Simplified for landing) */}
                        <div className="py-8 text-center text-stone-400 text-sm bg-stone-50 border-t border-stone-100">
                            <p>&copy; {new Date().getFullYear()} WIJA-Ogi. Dibuat dengan ❤️ untuk Budaya Bugis-Makassar.</p>
                            <p className="font-lontara mt-2 text-teal-600/50 text-lg">
                                {transliterateLatin('wija ogi').lontara}
                            </p>
                        </div>
                    </div>
                ) : (

                    /* Family Selection */
                    <div className="flex-1 px-4 py-8">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-bold text-stone-800">Keluarga Saya</h2>
                                    <p className="text-stone-500 mt-1">Pilih keluarga untuk melanjutkan</p>
                                </div>
                                <Button onClick={handleOpenCreateModal} icon="➕" className="shadow-lg">
                                    Buat Keluarga Baru
                                </Button>
                            </div>

                            {families.length === 0 ? (
                                <div className="glass rounded-xl text-center py-12 px-6 shadow-float">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                        <span className="text-4xl">🌱</span>
                                    </div>
                                    <h3 className="text-xl font-semibold text-stone-800 mb-2">
                                        Belum Ada Keluarga
                                    </h3>
                                    <p className="text-stone-600 mb-6 max-w-sm mx-auto">
                                        Mulai buat pohon keluarga pertama Anda dan lestarikan warisan keluarga
                                    </p>
                                    <Button onClick={handleOpenCreateModal} className="press-effect">
                                        ✨ Buat Keluarga Baru
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {families.map((family, index) => (
                                        <Link
                                            key={family.familyId}
                                            href={`/family/${family.familyId}`}
                                            className="glass rounded-xl hover-lift group stagger-item"
                                            style={{ animationDelay: `${index * 50}ms` }}
                                        >
                                            <div className="p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="font-semibold text-lg text-stone-800 group-hover:text-teal-700 transition">
                                                            {family.name}
                                                        </h3>
                                                        <p className="text-sm text-stone-500">{family.displayName}</p>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all">
                                                        <span className="text-lg">🌳</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 text-sm text-stone-600">
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-stone-400">👥</span>
                                                        {family.stats.personCount} anggota
                                                    </span>
                                                    <span className="text-teal-600 font-lontara">
                                                        {transliterateLatin(family.name).lontara}
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-stone-500 text-sm">
                <p>WIJA-Ogi - Warisan Jejak Keluarga Bugis</p>
                <p className="font-lontara text-teal-700 mt-1">
                    {wijaLontara} - ᨓᨑᨗᨔᨊ ᨍᨙᨍᨀ ᨀᨙᨒᨘᨕᨑᨁ
                </p>
            </footer>

            {/* Create Family Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="🌳 Buat Keluarga Baru"
                size="md"
            >
                <form onSubmit={handleCreateFamily}>
                    <ModalBody className="space-y-4">
                        <Input
                            label="Nama Keluarga *"
                            value={familyName}
                            onChange={(e) => setFamilyName(e.target.value)}
                            placeholder="Contoh: Keluarga Budiman"
                            error={error}
                        />

                        {familyName && (
                            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                <div className="text-sm text-teal-600">Lontara:</div>
                                <div className="font-lontara text-xl text-teal-700">
                                    {transliterateLatin(familyName).lontara}
                                </div>
                            </div>
                        )}

                        <Input
                            label="Nama Tampilan (opsional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Contoh: Pohon Keluarga Budiman"
                            helperText="Nama yang ditampilkan di header"
                        />
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            loading={creating}
                            className="flex-1"
                        >
                            Buat Keluarga
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        </div >
    );
}
