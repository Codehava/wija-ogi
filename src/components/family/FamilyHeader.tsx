// ═══════════════════════════════════════════════════════════════════════════════
// FamilyHeader — Header bar with toolbar, script toggle, stats, and admin links
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Family, ScriptMode } from '@/types';
import { transliterateLatin } from '@/lib/transliteration/engine';

interface FamilyHeaderProps {
    family: Family;
    familyId: string;
    scriptMode: ScriptMode;
    onScriptModeChange: (mode: ScriptMode) => void;
    totalGenerations: number;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    regenerating: boolean;
    exportingGedcom: boolean;
    onRegenerateLontara: () => void;
    onImportGedcom: () => void;
    onExportGedcom: () => void;
    onExportSVG: () => void;
}

export function FamilyHeader({
    family,
    familyId,
    scriptMode,
    onScriptModeChange,
    totalGenerations,
    isAdmin,
    isSuperAdmin,
    regenerating,
    exportingGedcom,
    onRegenerateLontara,
    onImportGedcom,
    onExportGedcom,
    onExportSVG,
}: FamilyHeaderProps) {
    const familyLontara = transliterateLatin(family.name).lontara;

    return (
        <header className="sticky top-0 z-50 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
            <div className="max-w-full px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-3 text-teal-200 hover:text-white transition">
                            <Image
                                src="/logo.png"
                                alt="WIJA-Ogi"
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-lg bg-white/10 p-1"
                            />
                            <span>← Kembali</span>
                        </Link>
                        <div className="h-8 w-px bg-teal-500"></div>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                {family.displayName || family.name}
                            </h1>
                            <p className="text-teal-200 text-sm font-lontara">{familyLontara}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Script Mode Toggle */}
                        <div className="flex bg-teal-600/50 rounded-lg p-1">
                            {(['latin', 'both', 'lontara'] as ScriptMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => onScriptModeChange(mode)}
                                    className={`px-3 py-1 text-sm rounded-md transition ${scriptMode === mode
                                        ? 'bg-white text-teal-700 font-medium'
                                        : 'text-teal-100 hover:text-white'
                                        }`}
                                >
                                    {mode === 'latin' ? 'Latin' : mode === 'lontara' ? 'ᨒᨚᨈᨑ' : 'Both'}
                                </button>
                            ))}
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-4 text-sm text-teal-200">
                            <span>👥 {family.stats.personCount} anggota</span>
                            <span>🌳 {totalGenerations} generasi</span>
                        </div>

                        {/* Admin Menu */}
                        {(isAdmin || isSuperAdmin) && (
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/family/${familyId}/team`}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    👥 Tim
                                </Link>
                                <Link
                                    href={`/family/${familyId}/activity`}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    📋 Aktivitas
                                </Link>
                                <Link
                                    href={`/family/${familyId}/settings`}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    ⚙️ Pengaturan
                                </Link>
                                {isSuperAdmin && (
                                    <button
                                        onClick={onRegenerateLontara}
                                        disabled={regenerating}
                                        className="px-3 py-1.5 bg-yellow-500/80 hover:bg-yellow-500 disabled:bg-yellow-500/50 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                    >
                                        {regenerating ? '⏳ Regenerating...' : '🔄 Regenerate Lontara'}
                                    </button>
                                )}
                                <button
                                    onClick={onImportGedcom}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    📥 Import GEDCOM
                                </button>
                                <button
                                    onClick={onExportGedcom}
                                    disabled={exportingGedcom}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/50 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    {exportingGedcom ? '⏳ Exporting...' : '📤 Export GEDCOM'}
                                </button>
                                <button
                                    onClick={onExportSVG}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition flex items-center gap-1"
                                >
                                    📄 Export SVG
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
