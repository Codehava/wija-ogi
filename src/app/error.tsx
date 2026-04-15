// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Root Error Boundary
// Catches rendering errors and shows a friendly UI
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 px-4">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">😵</div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">
                    Terjadi Kesalahan
                </h2>
                <p className="text-stone-600 mb-6">
                    Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
                </p>
                {process.env.NODE_ENV === 'development' && error.message && (
                    <pre className="text-xs text-left text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg mb-4 overflow-auto max-h-48">
                        {error.message}
                    </pre>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition font-medium shadow-lg"
                    >
                        🔄 Coba Lagi
                    </button>
                    <Link
                        href="/"
                        className="px-6 py-2.5 bg-white text-stone-700 rounded-lg border border-stone-300 hover:bg-stone-50 transition font-medium"
                    >
                        🏠 Beranda
                    </Link>
                </div>
            </div>
        </div>
    );
}
