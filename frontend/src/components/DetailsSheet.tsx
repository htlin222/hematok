import { useState, useEffect } from "react";
import { X, ExternalLink, Eye, Download, ChevronDown, ChevronUp, Bot, Loader2 } from "lucide-react";
import { morphUrl, type ExamPearls, type FeedItem, type MorphNote } from "../types/feed";
import { api } from "../lib/api";

// Shards are small and immutable per deploy — fetch each at most once per session.
const shardCache = new Map<string, Promise<Record<string, MorphNote>>>();
function loadMorph(id: string): Promise<MorphNote | null> {
    const url = morphUrl(id);
    if (!shardCache.has(url)) {
        shardCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
    }
    return shardCache.get(url)!.then((s) => s[id] ?? null);
}

// Keep in sync with the feed's left inset in App.tsx (Tailwind needs literal classes).
export const DRAWER_WIDTH = "w-[440px] xl:w-[500px]";

interface DetailsSheetProps {
    item: FeedItem;
    onClose: () => void;
    drawer?: boolean; // wide screens: left side panel instead of a modal sheet
}

/** Full (untruncated) metadata for an image — bottom sheet, or left drawer on wide screens. */
export function DetailsSheet({ item, onClose, drawer = false }: DetailsSheetProps) {
    const [explainExpanded, setExplainExpanded] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [explainLoading, setExplainLoading] = useState(false);
    const [morph, setMorph] = useState<MorphNote | null>(null);

    useEffect(() => {
        setMorph(null);
        if (!item.morph) return;
        let live = true;
        loadMorph(item.id).then((m) => live && setMorph(m));
        return () => {
            live = false;
        };
    }, [item.id, item.morph]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleExplain = async () => {
        setExplainExpanded(!explainExpanded);
        if (!explainExpanded && !explanation && !explainLoading) {
            setExplainLoading(true);
            const context = [morph?.describe_en, item.description].filter(Boolean).join("\n\n");
            const res = await api.explain(item.title, context);
            setExplanation(res);
            setExplainLoading(false);
        }
    };

    // Drawer: a non-modal left panel (no backdrop, no data-modal) so the feed stays
    // scrollable beside it. Sheet: the modal bottom sheet used on narrow screens.
    return (
        <div
            {...(drawer ? { "data-drawer": "details" } : { "data-modal": "details" })}
            className={
                drawer
                    ? `fixed inset-y-0 left-0 z-[60] ${DRAWER_WIDTH}`
                    : "fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
            }
        >
            {!drawer && <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />}
            <div
                className={
                    drawer
                        ? "relative h-full w-full overflow-y-auto overscroll-contain bg-gray-900 text-white border-r border-white/10 shadow-2xl p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]"
                        : "relative z-10 w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-gray-900 text-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 pb-8"
                }
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close details"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold leading-snug pr-8 mb-4">
                    {item.High_Yield && (
                        <span className="inline-block bg-orange-500/90 text-white text-[10px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded mr-2 align-middle shadow-sm border border-orange-400/50">
                            High Yield
                        </span>
                    )}
                    {item.title}
                </h2>

                <div className="mb-5 bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                    <button 
                        onClick={handleExplain}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 font-medium text-cyan-300">
                            <Bot className="w-4 h-4" />
                            Explain AI
                        </div>
                        {explainExpanded ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
                    </button>
                    {explainExpanded && (
                        <div className="px-4 pb-4 pt-1 text-[14px] leading-relaxed text-white/80 border-t border-white/5">
                            {explainLoading ? (
                                <div className="flex items-center gap-2 text-white/50 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating explanation...
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap">{explanation}</div>
                            )}
                        </div>
                    )}
                </div>

                {morph && <MorphSection note={morph} />}

                {item.description && (
                    <div className="mb-5">
                        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">
                            {item.collection === "reference-cases" ? "Case description" : "Description"}
                        </div>
                        <div className="space-y-3 text-[15px] leading-relaxed text-white/90">
                            {item.description.split(/\n\n+/).map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>
                    </div>
                )}

                {item.cats && item.cats.length > 0 && (
                    <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Category</div>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-cyan-200/90">
                            {item.cats.map((c, i) => (
                                <span key={i} className="inline-flex items-center">
                                    {i > 0 && <span className="text-white/30 mr-1.5">›</span>}
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {item.author && (
                    <div className="mb-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Contributor(s)</div>
                        <div className="text-sm text-white/90">{item.author}</div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    {item.published_date && (
                        <Meta label="Published">{item.published_date}</Meta>
                    )}
                    {item.size && <Meta label="Image size">{item.size}</Meta>}
                    <Meta label="Views">
                        <span className="inline-flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-white/50" />
                            {item.views.toLocaleString()}
                        </span>
                    </Meta>
                    <Meta label="Downloads">
                        <span className="inline-flex items-center gap-1">
                            <Download className="w-3.5 h-3.5 text-white/50" />
                            {item.downloads.toLocaleString()}
                        </span>
                    </Meta>
                    <Meta label="Collection">{item.collection}</Meta>
                    {item.images.length > 1 && <Meta label="Images">{item.images.length}</Meta>}
                </div>

                <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300 hover:text-cyan-200"
                >
                    View on ASH Image Bank <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">{children}</div>;
}

function MorphSection({ note }: { note: MorphNote }) {
    return (
        <div className="mb-5 space-y-4">
            <div className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-4 py-3">
                <div className="text-[11px] tracking-wide text-orange-300/90 mb-1">如何認出這張圖</div>
                <p className="text-[15px] leading-relaxed text-white/95">
                    {note.recognize_zh.replace(/^如何認出這張圖[：:]\s*/, "")}
                </p>
            </div>

            {note.exam && <ExamSection exam={note.exam} />}

            {note.features.length > 0 && (
                <div>
                    <SectionLabel>Key morphologic features</SectionLabel>
                    <ul className="list-disc pl-5 space-y-1 text-[14px] leading-relaxed text-white/90">
                        {note.features.map((f, i) => (
                            <li key={i}>{f}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div>
                <SectionLabel>
                    How to describe · {note.specimen} · {note.stain}
                </SectionLabel>
                <p className="text-[14px] leading-relaxed text-white/90 italic">{note.describe_en}</p>
            </div>

            {note.ddx.length > 0 && (
                <div>
                    <SectionLabel>Differential diagnosis</SectionLabel>
                    <dl className="space-y-2 text-[14px] leading-relaxed">
                        {note.ddx.map((d, i) => (
                            <div key={i}>
                                <dt className="font-semibold text-cyan-200/90">{d.dx}</dt>
                                <dd className="text-white/80">{d.vs}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            {note.captions && note.captions.length > 0 && (
                <div>
                    <SectionLabel>Images</SectionLabel>
                    <ol className="list-decimal pl-5 space-y-1 text-[13px] leading-relaxed text-white/75">
                        {note.captions.map((c, i) => (
                            <li key={i}>{c}</li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}

function ExamSection({ exam }: { exam: ExamPearls }) {
    const [revealed, setRevealed] = useState(false);
    return (
        <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-4 py-3 space-y-3">
            <div>
                <div className="text-[11px] tracking-wide text-cyan-300/90 mb-1">玻片考試 · 高頻考點</div>
                <p className="text-[14px] font-semibold leading-snug text-white/95">{exam.answer_en}</p>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed text-white/90">
                {exam.pearls_zh.map((p, i) => (
                    <li key={i}>{p}</li>
                ))}
            </ul>
            <p className="text-[14px] leading-relaxed text-amber-200/90">
                <span className="font-semibold">陷阱：</span>
                {exam.pitfall_zh}
            </p>
            <div className="border-t border-white/10 pt-3 text-[14px] leading-relaxed">
                <p className="text-white/90">
                    <span className="font-semibold text-cyan-200/90">Q：</span>
                    {exam.quiz.q}
                </p>
                {revealed ? (
                    <p className="mt-1 text-white/80">
                        <span className="font-semibold text-cyan-200/90">A：</span>
                        {exam.quiz.a}
                    </p>
                ) : (
                    <button
                        onClick={() => setRevealed(true)}
                        className="mt-1.5 text-[13px] font-medium text-cyan-300 hover:text-cyan-200"
                    >
                        顯示答案
                    </button>
                )}
            </div>
        </div>
    );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-0.5">{label}</div>
            <div className="text-white/90">{children}</div>
        </div>
    );
}
