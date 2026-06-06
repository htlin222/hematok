import { useEffect } from "react";
import { X, ExternalLink, Eye, Download } from "lucide-react";
import type { FeedItem } from "../types/feed";

interface DetailsSheetProps {
    item: FeedItem;
    onClose: () => void;
}

/** Bottom sheet with the full (untruncated) metadata for an image. */
export function DetailsSheet({ item, onClose }: DetailsSheetProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-gray-900 text-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-7 pb-8">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close details"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold leading-snug pr-8 mb-4">{item.title}</h2>

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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-0.5">{label}</div>
            <div className="text-white/90">{children}</div>
        </div>
    );
}
