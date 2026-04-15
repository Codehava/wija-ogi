import { transliterateLatin } from '@/lib/transliteration/engine';

export function PhilosophySection() {
    const reso = "Resopa Temmangingngi, Namalomo Naletei Pammase Dewata";
    const resoTrans = transliterateLatin(reso).lontara;

    const mali = "Mali Siparappe, Rebba Sipatokkong, Malilu Sipakainge";
    const maliTrans = transliterateLatin(mali).lontara;

    return (
        <section className="py-16 px-4 bg-gradient-to-b from-teal-50/50 to-white relative overflow-hidden">
            {/* Background Pattern (Subtle) */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'url("/pattern-batik.png")', backgroundSize: '200px' }}>
            </div>

            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">

                {/* Intro Philosophy */}
                <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-medium uppercase tracking-wider">
                        <span>✨ Filosofi Leluhur</span>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-stone-800 leading-tight">
                            Semangat membangun <br />
                            <span className="text-teal-600">Warisan Keluarga</span>
                        </h2>

                        <div className="bg-white/60 p-6 rounded-2xl border border-teal-100 shadow-sm">
                            <p className="font-lontara text-2xl text-stone-800 mb-3 leading-relaxed">
                                {resoTrans}
                            </p>
                            <p className="text-lg font-serif italic text-stone-700 mb-2">
                                &ldquo;{reso}&rdquo;
                            </p>
                            <p className="text-sm text-stone-500">
                                Hanya kerja keras yang tak kenal lelah yang akan mendapatkan rahmat Dewata.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Collaboration Philosophy */}
                <div className="space-y-6 md:pl-8 border-l border-teal-100/50">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium uppercase tracking-wider">
                        <span>🤝 Nilai Kebersamaan</span>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-3xl border border-orange-100 shadow-sm">
                        <p className="font-lontara text-xl text-stone-800 mb-4 leading-loose">
                            {maliTrans}
                        </p>
                        <p className="text-lg font-medium text-stone-800 mb-2">
                            Mali Siparappe, Rebba Sipatokkong
                        </p>
                        <p className="text-stone-600 mb-4">
                            Hanyut saling mendamparkan, rebah saling menegakkan, lupa saling mengingatkan.
                        </p>
                        <p className="text-xs text-stone-500 italic border-t border-orange-200 pt-3">
                            Filosofi ini menjadi dasar fitur kolaborasi di WIJA-Ogi, di mana setiap anggota keluarga saling melengkapi data silsilah.
                        </p>
                    </div>
                </div>

            </div>
        </section>
    );
}
