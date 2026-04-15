// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Activity Log Page
// Shows recent actions performed on the family tree
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Activity, ActivityAction } from '@/types';

const ACTION_LABELS: Record<ActivityAction, { icon: string; label: string; color: string }> = {
    person_created: { icon: '👤', label: 'Anggota ditambahkan', color: 'bg-green-100 text-green-800' },
    person_updated: { icon: '✏️', label: 'Anggota diperbarui', color: 'bg-blue-100 text-blue-800' },
    person_deleted: { icon: '🗑️', label: 'Anggota dihapus', color: 'bg-red-100 text-red-800' },
    relationship_created: { icon: '🔗', label: 'Hubungan ditambahkan', color: 'bg-purple-100 text-purple-800' },
    relationship_deleted: { icon: '✂️', label: 'Hubungan dihapus', color: 'bg-orange-100 text-orange-800' },
    member_invited: { icon: '📨', label: 'Anggota diundang', color: 'bg-cyan-100 text-cyan-800' },
    member_joined: { icon: '🎉', label: 'Anggota bergabung', color: 'bg-emerald-100 text-emerald-800' },
    member_removed: { icon: '👋', label: 'Anggota dikeluarkan', color: 'bg-rose-100 text-rose-800' },
    family_updated: { icon: '⚙️', label: 'Pengaturan diubah', color: 'bg-amber-100 text-amber-800' },
    export_created: { icon: '📄', label: 'Export dibuat', color: 'bg-indigo-100 text-indigo-800' },
    gedcom_imported: { icon: '📥', label: 'GEDCOM diimpor', color: 'bg-teal-100 text-teal-800' },
    gedcom_exported: { icon: '📤', label: 'GEDCOM diekspor', color: 'bg-sky-100 text-sky-800' },
};

function formatRelativeTime(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return date.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function ActivityPage() {
    const params = useParams();
    const familyId = params.id as string;

    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const fetchActivities = useCallback(async (offset = 0) => {
        try {
            const res = await fetch(`/api/families/${familyId}/activities?limit=30&offset=${offset}`);
            if (!res.ok) throw new Error('Failed');
            const data: Activity[] = await res.json();

            if (offset === 0) {
                setActivities(data);
            } else {
                setActivities(prev => [...prev, ...data]);
            }
            setHasMore(data.length === 30);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [familyId]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    const handleLoadMore = () => {
        setLoadingMore(true);
        fetchActivities(activities.length);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/family/${familyId}`}
                            className="flex items-center gap-2 text-teal-200 hover:text-white transition"
                        >
                            ← Kembali ke Pohon
                        </Link>
                        <div className="h-6 w-px bg-teal-500"></div>
                        <h1 className="text-xl font-bold">📋 Riwayat Aktivitas</h1>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="animate-pulse flex gap-4 p-4 bg-white rounded-xl">
                                <div className="w-10 h-10 bg-stone-200 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-stone-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-stone-100 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activities.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-6xl mb-4">📋</div>
                        <h2 className="text-xl font-bold text-stone-700 mb-2">Belum Ada Aktivitas</h2>
                        <p className="text-stone-500">
                            Riwayat perubahan pada pohon keluarga akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activities.map((activity) => {
                            const meta = ACTION_LABELS[activity.action] || {
                                icon: '📌', label: activity.action, color: 'bg-stone-100 text-stone-800'
                            };

                            return (
                                <div
                                    key={activity.activityId}
                                    className="flex items-start gap-4 p-4 bg-white rounded-xl border border-stone-200 hover:shadow-md transition"
                                >
                                    <div className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                            <span className="text-xs text-stone-400">
                                                {formatRelativeTime(activity.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-stone-700">{activity.description}</p>
                                        <p className="text-xs text-stone-400 mt-1">
                                            oleh {activity.performedByName || 'Sistem'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="w-full py-3 text-sm font-medium text-teal-600 bg-white border border-stone-200 rounded-xl hover:bg-teal-50 transition disabled:opacity-50"
                            >
                                {loadingMore ? '⏳ Memuat...' : 'Muat Lebih Banyak'}
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
