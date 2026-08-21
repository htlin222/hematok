import { Share2, Heart, ThumbsDown, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useLikedArticles } from "../contexts/LikedArticlesContext";
import type { FeedItem } from "../types/feed";
import { imgUrl } from "../types/feed";
import { ZoomViewer } from "./ZoomViewer";
import { api } from "../lib/api";

interface HematokCardProps {
    item: FeedItem;
    onOpenDetails: (item: FeedItem) => void;
    getRandomItems: (n: number, excludeId: string) => FeedItem[];
    isTestMode?: boolean;
}

function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function HematokCard({ item, onOpenDetails, getRandomItems, isTestMode = false }: HematokCardProps) {
    const { toggleLike, isLiked, toggleDislike, isDisliked } = useLikedArticles();
    const [idx, setIdx] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [chrome, setChrome] = useState(true); // overlay + controls visible
    const [zoom, setZoom] = useState(false);
    
    // Quiz / Test State
    const [options, setOptions] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);

    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const multi = item.images.length > 1;
    // The most specific category sits last in the cats chain.
    const category = item.cats && item.cats.length > 0 ? item.cats[item.cats.length - 1] : item.collection;

    // Initialize test options when test mode activates
    useEffect(() => {
        if (isTestMode && options.length === 0) {
            const distractors = getRandomItems(3, item.id);
            const all = shuffle([item.title, ...distractors.map(d => d.title)]);
            setOptions(all);
            setSelected(null);
        }
    }, [isTestMode, item.id, item.title, getRandomItems, options.length]);

    const handleShare = async () => {
        const shareData = { title: item.title, text: item.title, url: item.url };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.error("Error sharing:", error);
            }
        } else {
            await navigator.clipboard.writeText(item.url);
            alert("Link copied to clipboard!");
        }
    };

    const go = (delta: number) => {
        setLoaded(false);
        setIdx((i) => (i + delta + item.images.length) % item.images.length);
    };

    // Single tap on the image toggles chrome; double tap opens the zoom viewer.
    const handleImageClick = () => {
        if (clickTimer.current) return;
        clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            setChrome((c) => !c);
        }, 240);
    };
    const handleImageDoubleClick = () => {
        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
        }
        setZoom(true);
    };

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    const submitAnswer = async (opt: string) => {
        if (selected) return; // already guessed
        setSelected(opt);
        const correct = opt === item.title;
        // background save to D1
        api.testAnswer(item.id, correct);
    };

    return (
        <div className="h-screen w-full flex items-center justify-center snap-start relative" data-feed-id={item.id}>
            <div className="h-full w-full relative bg-black">
                {/* Image (tap = toggle chrome, double-tap = zoom) */}
                <div
                    className="absolute inset-0"
                    onClick={handleImageClick}
                    onDoubleClick={handleImageDoubleClick}
                >
                    <img
                        key={idx}
                        loading="lazy"
                        src={imgUrl(item.images[idx])}
                        alt={item.title}
                        className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"
                            }`}
                        onLoad={() => setLoaded(true)}
                        onError={() => setLoaded(true)}
                    />
                    {!loaded && <div className="absolute inset-0 bg-gray-900 animate-pulse" />}
                    {chrome && (
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />
                    )}
                </div>

                {/* Gallery controls (hidden when chrome is off) */}
                {multi && chrome && (
                    <>
                        <button
                            onClick={(e) => { stop(e); go(-1); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                            onClick={(e) => { stop(e); go(1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                        <div className="absolute top-[calc(env(safe-area-inset-top)_+_4.5rem)] left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                            {item.images.map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40"
                                        }`}
                                />
                            ))}
                        </div>
                        <div className="absolute top-[calc(env(safe-area-inset-top)_+_4.5rem)] left-3 z-20 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
                            {idx + 1}/{item.images.length}
                        </div>
                    </>
                )}

                {/* Zoom affordance (always available when chrome is on) */}
                {chrome && (
                    <button
                        onClick={(e) => { stop(e); setZoom(true); }}
                        className="absolute top-[calc(env(safe-area-inset-top)_+_4.5rem)] right-3 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                        aria-label="Zoom image"
                    >
                        <Maximize2 className="w-5 h-5" />
                    </button>
                )}

                {/* Bottom overlay — compact; hidden when chrome is off */}
                {chrome && (
                    <div
                        className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent text-white"
                        onClick={stop}
                    >
                        <div className="flex justify-between items-end mb-2">
                            <span className="inline-block max-w-full truncate align-bottom text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90 mb-1">
                                {category}
                            </span>
                        </div>
                        <div className="flex justify-between items-end gap-3">
                            <div className="min-w-0 flex-1">
                                {!isTestMode ? (
                                    <button
                                        onClick={() => onOpenDetails(item)}
                                        className="block text-left w-full"
                                        aria-label="Show details"
                                    >
                                        <h2 className="text-base sm:text-lg font-bold drop-shadow leading-snug max-h-[40vh] overflow-y-auto hide-scroll overscroll-contain">
                                            {item.High_Yield && (
                                                <span className="inline-block bg-orange-500/90 text-white text-[10px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded mr-2 align-middle shadow-sm border border-orange-400/50">
                                                    High Yield
                                                </span>
                                            )}
                                            {item.title}
                                        </h2>
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto hide-scroll pb-2">
                                        <div className="text-xs text-white/60 mb-1">What is the correct diagnosis?</div>
                                        {options.map((opt, i) => {
                                            const isCorrect = opt === item.title;
                                            const isGuessed = selected === opt;
                                            
                                            let bg = "bg-black/50 hover:bg-white/10";
                                            if (selected) {
                                                if (isCorrect) bg = "bg-green-600/80 border-green-400";
                                                else if (isGuessed) bg = "bg-red-600/80 border-red-400";
                                                else bg = "bg-black/40 opacity-50";
                                            }

                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => submitAnswer(opt)}
                                                    disabled={!!selected}
                                                    className={`text-left text-sm p-3 rounded-xl border border-white/10 backdrop-blur-md transition-all ${bg}`}
                                                >
                                                    <div className="font-semibold mb-1 text-white/80">Option {['A', 'B', 'C', 'D'][i]}</div>
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                        {selected && (
                                            <div className="mt-2 text-center">
                                                {selected === item.title ? (
                                                    <span className="text-green-400 font-bold">Correct!</span>
                                                ) : (
                                                    <span className="text-red-400 font-bold">Incorrect.</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button
                                    onClick={() => toggleLike(item)}
                                    className={`p-2 rounded-full backdrop-blur-sm transition-colors ${isLiked(item.id)
                                        ? "bg-red-500 hover:bg-red-600"
                                        : "bg-white/10 hover:bg-white/20"
                                        }`}
                                    aria-label="Like image"
                                >
                                    <Heart className={`w-5 h-5 ${isLiked(item.id) ? "fill-white" : ""}`} />
                                </button>
                                <button
                                    onClick={() => toggleDislike(item)}
                                    className={`p-2 rounded-full backdrop-blur-sm transition-colors ${isDisliked(item.id)
                                        ? "bg-white text-black hover:bg-white/90"
                                        : "bg-white/10 hover:bg-white/20"
                                        }`}
                                    aria-label="Dislike image"
                                >
                                    <ThumbsDown className={`w-5 h-5 ${isDisliked(item.id) ? "fill-black" : ""}`} />
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                                    aria-label="Share image"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {zoom && (
                <ZoomViewer
                    images={item.images}
                    index={idx}
                    alt={item.title}
                    onClose={() => setZoom(false)}
                    onIndexChange={(i) => { setLoaded(false); setIdx(i); }}
                />
            )}
        </div>
    );
}
