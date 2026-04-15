// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Export Modal Component
// Modal for configuring and initiating tree export
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { ExportOptions, ScriptMode } from '@/types';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { getDefaultExportOptions } from '@/lib/services/exports';

export interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: ExportOptions) => Promise<void>;
    familyName: string;
    personCount: number;
}

export function ExportModal({
    isOpen,
    onClose,
    onExport,
    familyName,
    personCount
}: ExportModalProps) {
    const [options, setOptions] = useState<ExportOptions>(getDefaultExportOptions());
    const [exporting, setExporting] = useState(false);
    const [step, setStep] = useState<'options' | 'progress' | 'done'>('options');
    const [progress, setProgress] = useState(0);

    const handleExport = async () => {
        setExporting(true);
        setStep('progress');

        // Simulate progress
        const progressInterval = setInterval(() => {
            setProgress(p => {
                if (p >= 90) {
                    clearInterval(progressInterval);
                    return p;
                }
                return p + 10;
            });
        }, 200);

        try {
            await onExport(options);
            clearInterval(progressInterval);
            setProgress(100);
            setStep('done');
        } catch (err) {
            console.error('Export failed:', err);
            clearInterval(progressInterval);
            setExporting(false);
            setStep('options');
        }
    };

    const handleDownload = () => {
        // This will be implemented with actual download logic
        onClose();
        setStep('options');
        setProgress(0);
        setExporting(false);
    };

    const updateOption = <K extends keyof ExportOptions>(
        key: K,
        value: ExportOptions[K]
    ) => {
        setOptions(prev => ({ ...prev, [key]: value }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={exporting ? () => { } : onClose}
            title="📄 Ekspor Pohon Keluarga"
            size="md"
            closeOnBackdrop={!exporting}
        >
            {step === 'options' && (
                <>
                    <ModalBody className="space-y-6">
                        {/* Export Info */}
                        <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                            <div className="font-medium text-teal-800">{familyName}</div>
                            <div className="text-sm text-teal-600">{personCount} anggota keluarga</div>
                        </div>

                        {/* Scope */}
                        <Select
                            label="Cakupan"
                            value={options.scope}
                            onChange={(e) => updateOption('scope', e.target.value as ExportOptions['scope'])}
                            options={[
                                { value: 'full', label: '🌳 Pohon lengkap' },
                                { value: 'from_ancestor', label: '👑 Dari leluhur tertentu' },
                                { value: 'subtree', label: '🌿 Cabang tertentu' }
                            ]}
                        />

                        {/* Script Mode */}
                        <Select
                            label="Mode Aksara"
                            value={options.scriptOptions.script}
                            onChange={(e) => updateOption('scriptOptions', {
                                ...options.scriptOptions,
                                script: e.target.value as ScriptMode
                            })}
                            options={[
                                { value: 'latin', label: 'Latin saja' },
                                { value: 'lontara', label: 'Lontara saja' },
                                { value: 'both', label: 'Latin & Lontara' }
                            ]}
                        />

                        {/* Paper Size */}
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Ukuran Kertas"
                                value={options.format.paperSize}
                                onChange={(e) => updateOption('format', {
                                    ...options.format,
                                    paperSize: e.target.value as 'A4' | 'A3' | 'Letter'
                                })}
                                options={[
                                    { value: 'A4', label: 'A4' },
                                    { value: 'A3', label: 'A3' },
                                    { value: 'Letter', label: 'Letter' }
                                ]}
                            />

                            <Select
                                label="Orientasi"
                                value={options.format.orientation}
                                onChange={(e) => updateOption('format', {
                                    ...options.format,
                                    orientation: e.target.value as 'landscape' | 'portrait'
                                })}
                                options={[
                                    { value: 'landscape', label: '🖼️ Landscape' },
                                    { value: 'portrait', label: '📄 Portrait' }
                                ]}
                            />
                        </div>

                        {/* Content Options */}
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-stone-700">Konten</div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={options.content.includePhotos}
                                        onChange={(e) => updateOption('content', {
                                            ...options.content,
                                            includePhotos: e.target.checked
                                        })}
                                        className="w-4 h-4 text-teal-600 rounded"
                                    />
                                    <span className="text-sm text-stone-700">📷 Sertakan foto</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={options.content.includeDates}
                                        onChange={(e) => updateOption('content', {
                                            ...options.content,
                                            includeDates: e.target.checked
                                        })}
                                        className="w-4 h-4 text-teal-600 rounded"
                                    />
                                    <span className="text-sm text-stone-700">📅 Sertakan tanggal lahir/wafat</span>
                                </label>
                            </div>
                        </div>
                    </ModalBody>

                    <ModalFooter>
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            Batal
                        </Button>
                        <Button onClick={handleExport} loading={exporting} className="flex-1">
                            📥 Ekspor PDF
                        </Button>
                    </ModalFooter>
                </>
            )}

            {step === 'progress' && (
                <ModalBody>
                    <div className="py-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 relative">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="36"
                                    fill="none"
                                    stroke="#fef3c7"
                                    strokeWidth="8"
                                />
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="36"
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${progress * 2.26} 226`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-teal-600">
                                {progress}%
                            </div>
                        </div>
                        <div className="text-stone-600">Membuat ekspor...</div>
                        <div className="text-sm text-stone-400 mt-1">Mohon tunggu sebentar</div>
                    </div>
                </ModalBody>
            )}

            {step === 'done' && (
                <ModalBody>
                    <div className="py-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-lg font-semibold text-stone-800 mb-2">Ekspor Berhasil!</h3>
                        <p className="text-stone-600 mb-6">File PDF Anda siap diunduh</p>

                        <Button onClick={handleDownload} className="w-full">
                            📥 Unduh PDF
                        </Button>
                    </div>
                </ModalBody>
            )}
        </Modal>
    );
}

export default ExportModal;
