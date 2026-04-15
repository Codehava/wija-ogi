// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Lontara Input Component
// Input with live Lontara transliteration preview
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { transliterateLatin, LONTARA_CONFIG } from '@/lib/transliteration/engine';

export interface LontaraInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string;
    error?: string;
    showPreview?: boolean;
    showKeyboard?: boolean;
    onChange?: (latin: string, lontara: string) => void;
}

export const LontaraInput = forwardRef<HTMLInputElement, LontaraInputProps>(
    ({ label, error, showPreview = true, showKeyboard = false, onChange, className, value, ...props }, ref) => {
        const [localValue, setLocalValue] = useState(String(value || ''));
        const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

        const { lontara } = useMemo(() => {
            return transliterateLatin(localValue);
        }, [localValue]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setLocalValue(newValue);
            const result = transliterateLatin(newValue);
            onChange?.(newValue, result.lontara);
        };

        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-stone-700">
                        {label}
                    </label>
                )}

                <div className="relative">
                    <input
                        ref={ref}
                        type="text"
                        value={localValue}
                        onChange={handleChange}
                        className={clsx(
                            'w-full px-3 py-2 border rounded-lg transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-offset-0',
                            error
                                ? 'border-red-500 focus:ring-red-500'
                                : 'border-stone-300 focus:ring-teal-500',
                            className
                        )}
                        {...props}
                    />

                    {showKeyboard && (
                        <button
                            type="button"
                            onClick={() => setShowVirtualKeyboard(!showVirtualKeyboard)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded"
                            title="Toggle Lontara keyboard"
                        >
                            ⌨️
                        </button>
                    )}
                </div>

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                {/* Lontara Preview */}
                {showPreview && localValue && (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                        <div className="text-xs text-teal-600 mb-1">Lontara:</div>
                        <div className="text-2xl font-lontara text-teal-800">
                            {lontara || '—'}
                        </div>
                    </div>
                )}

                {/* Virtual Keyboard (simplified) */}
                {showKeyboard && showVirtualKeyboard && (
                    <VirtualLontaraKeyboard
                        onChar={(char) => {
                            const newValue = localValue + char;
                            setLocalValue(newValue);
                            const result = transliterateLatin(newValue);
                            onChange?.(newValue, result.lontara);
                        }}
                        onClose={() => setShowVirtualKeyboard(false)}
                    />
                )}
            </div>
        );
    }
);

LontaraInput.displayName = 'LontaraInput';

// Simplified Virtual Keyboard
interface VirtualLontaraKeyboardProps {
    onChar: (char: string) => void;
    onClose: () => void;
}

function VirtualLontaraKeyboard({ onChar, onClose }: VirtualLontaraKeyboardProps) {
    const rows = [
        ['ka', 'ga', 'nga', 'ngka', 'pa', 'ba', 'ma', 'mpa'],
        ['ta', 'da', 'na', 'nra', 'ca', 'ja', 'nya', 'nca'],
        ['ya', 'ra', 'la', 'wa', 'sa', 'a', 'ha', ' ']
    ];

    return (
        <div className="p-3 bg-white border border-stone-200 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-stone-600">Lontara Input</span>
                <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <div className="space-y-1">
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-1 justify-center">
                        {row.map((syllable) => {
                            const lontara = syllable === ' '
                                ? ' '
                                : LONTARA_CONFIG.consonantBase[syllable.replace(/a$/, '')] || syllable;

                            return (
                                <button
                                    key={syllable}
                                    type="button"
                                    onClick={() => onChar(syllable)}
                                    className="w-10 h-10 flex flex-col items-center justify-center bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded text-xs"
                                >
                                    <span className="font-lontara text-teal-700">{lontara}</span>
                                    <span className="text-[8px] text-stone-500">{syllable}</span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
            {/* Vowels */}
            <div className="flex gap-1 justify-center mt-2 pt-2 border-t border-stone-200">
                {['i', 'u', 'e', 'o'].map((vowel) => (
                    <button
                        key={vowel}
                        type="button"
                        onClick={() => onChar(vowel)}
                        className="w-10 h-8 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-sm font-medium"
                    >
                        {vowel}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default LontaraInput;
