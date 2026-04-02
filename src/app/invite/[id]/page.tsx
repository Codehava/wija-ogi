// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Accept Invitation Page
// Allows users to accept family invitations via link
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { invitationsApi } from '@/lib/api';
import { Invitation } from '@/types';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AcceptInvitationPage() {
    const params = useParams();
    const router = useRouter();
    const invitationId = params.id as string;

    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accepting, setAccepting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function loadInvitation() {
            try {
                setLoading(true);
                const inv = await invitationsApi.getInvitation(invitationId);

                if (!inv) {
                    setError('Undangan tidak ditemukan');
                    return;
                }

                if (inv.status !== 'pending') {
                    setError('Undangan sudah tidak valid (sudah diterima/ditolak/kadaluarsa)');
                    return;
                }

                const expiresDate = inv.expiresAt instanceof Date ? inv.expiresAt : new Date(inv.expiresAt);
                if (expiresDate < new Date()) {
                    setError('Undangan sudah kadaluarsa');
                    return;
                }

                setInvitation(inv);
            } catch (err) {
                console.error('Error loading invitation:', err);
                setError('Gagal memuat undangan');
            } finally {
                setLoading(false);
            }
        }

        if (invitationId) {
            loadInvitation();
        }
    }, [invitationId]);

    const handleAccept = async () => {
        if (!user || !invitation) return;

        setAccepting(true);
        try {
            await invitationsApi.acceptInvitation(
                invitationId,
                {
                    userId: user.uid,
                    displayName: user.displayName || user.email || 'User',
                    email: user.email || '',
                    photoUrl: user.photoURL || undefined
                }
            );
            setSuccess(true);

            // Redirect to family after 2 seconds
            setTimeout(() => {
                router.push(`/family/${invitation.familyId}`);
            }, 2000);
        } catch (err) {
            console.error('Error accepting invitation:', err);
            setError('Gagal menerima undangan. Silakan coba lagi.');
        } finally {
            setAccepting(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat undangan...</p>
                </div>
            </div>
        );
    }

    // Not logged in
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50 p-4">
                <Card variant="elevated" className="max-w-md w-full">
                    <CardHeader gradient>
                        <h1 className="text-xl font-bold text-center">✉️ Undangan Keluarga</h1>
                    </CardHeader>
                    <CardBody className="text-center py-8">
                        <div className="text-6xl mb-4">🔐</div>
                        <h2 className="text-lg font-semibold text-stone-800 mb-2">Silakan Login Terlebih Dahulu</h2>
                        <p className="text-stone-600 mb-6">
                            Anda perlu login untuk menerima undangan ini.
                        </p>
                        <Button
                            className="w-full"
                            onClick={() => {
                                window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${invitationId}`)}`;
                            }}
                        >
                            Login / Daftar
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50 p-4">
                <Card variant="elevated" className="max-w-md w-full">
                    <CardBody className="text-center py-8">
                        <div className="text-6xl mb-4">❌</div>
                        <h2 className="text-lg font-semibold text-stone-800 mb-2">Undangan Tidak Valid</h2>
                        <p className="text-stone-600 mb-6">{error}</p>
                        <Link href="/">
                            <Button variant="secondary">
                                Kembali ke Beranda
                            </Button>
                        </Link>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50 p-4">
                <Card variant="elevated" className="max-w-md w-full">
                    <CardBody className="text-center py-8">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-lg font-semibold text-stone-800 mb-2">Selamat Bergabung!</h2>
                        <p className="text-stone-600 mb-6">
                            Anda berhasil bergabung dengan keluarga <strong>{invitation?.familyName}</strong>.
                        </p>
                        <p className="text-sm text-teal-600">Mengalihkan ke halaman keluarga...</p>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // Invitation details
    const roleLabels = {
        superadmin: '👑 Super Admin',
        owner: '👑 Owner',
        admin: '⚙️ Admin',
        editor: '✏️ Editor',
        viewer: '👁️ Viewer'
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50 p-4">
            <Card variant="elevated" className="max-w-md w-full">
                <CardHeader gradient>
                    <h1 className="text-xl font-bold text-center">✉️ Undangan Keluarga</h1>
                </CardHeader>
                <CardBody className="py-6">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">👥</div>
                        <h2 className="text-lg font-semibold text-stone-800">
                            {invitation?.invitedByName} mengundang Anda
                        </h2>
                        <p className="text-stone-600 mt-1">
                            untuk bergabung dengan keluarga
                        </p>
                    </div>

                    <div className="bg-stone-50 rounded-xl p-4 mb-6">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-teal-700 mb-1">
                                {invitation?.familyName}
                            </div>
                            <div className="inline-block bg-teal-100 text-teal-700 text-sm px-3 py-1 rounded-full">
                                {roleLabels[invitation?.role || 'viewer']}
                            </div>
                        </div>
                    </div>

                    {user?.email?.toLowerCase() !== invitation?.email.toLowerCase() && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm">
                            <span className="font-medium">⚠️ Perhatian:</span> Undangan ini ditujukan untuk <strong>{invitation?.email}</strong>,
                            tetapi Anda login sebagai <strong>{user?.email}</strong>.
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Link href="/" className="flex-1">
                            <Button variant="secondary" className="w-full">
                                Tolak
                            </Button>
                        </Link>
                        <Button
                            onClick={handleAccept}
                            loading={accepting}
                            className="flex-1"
                        >
                            Terima Undangan
                        </Button>
                    </div>

                    <p className="text-xs text-stone-500 text-center mt-4">
                        Kadaluarsa: {invitation?.expiresAt ? (invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt)).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        }) : ''}
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
