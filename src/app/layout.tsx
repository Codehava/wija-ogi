// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Root Layout
// Next.js App Router root layout with AuthProvider and ThemeProvider
// ═══════════════════════════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryProvider } from '@/contexts/QueryProvider';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import './nusantara.css';

export const metadata: Metadata = {
    title: 'WIJA - Warisan Jejak Keluarga',
    description: 'Aplikasi Pohon Keluarga Digital dengan Aksara Lontara',
    keywords: ['family tree', 'pohon keluarga', 'silsilah', 'lontara', 'bugis', 'aksara'],
    authors: [{ name: 'WIJA Team' }],
    icons: {
        icon: [
            { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
            { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: '/apple-touch-icon.png',
    },
    openGraph: {
        title: 'WIJA - Warisan Jejak Keluarga',
        description: 'Aplikasi Pohon Keluarga Digital dengan Aksara Lontara',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="id" suppressHydrationWarning>
            <head>
                {/* PWA Manifest */}
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#0d9488" />
                {/* Favicons */}
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
            </head>
            <body className="font-sans antialiased">
                <ThemeProvider>
                    <QueryProvider>
                        <AuthProvider>
                            {children}
                            <Toaster
                                position="bottom-right"
                                toastOptions={{
                                    duration: 4000,
                                    style: { borderRadius: '0.75rem', fontSize: '0.875rem' },
                                    success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                                }}
                            />
                        </AuthProvider>
                    </QueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
