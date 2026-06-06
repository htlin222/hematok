import { useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { imgUrl } from "../types/feed";

interface ZoomViewerProps {
    images: string[]; // R2 keys
    index: number;
    alt: string;
    onClose: () => void;
    onIndexChange: (i: number) => void;
}

/**
 * Fullscreen, pinch-to-zoom / pan / double-tap image viewer. Rendered outside
 * the snap-scroll feed so touch gestures don't fight the vertical scroll.
 */
export function ZoomViewer({ images, index, alt, onClose, onIndexChange }: ZoomViewerProps) {
    const multi = images.length > 1;

    // Lock body scroll + close on Escape while open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (multi && e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
            if (multi && e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [index, images.length, multi, onClose, onIndexChange]);

    return (
        <div data-modal="zoom" className="fixed inset-0 z-[100] bg-black flex items-center justify-center touch-none">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                aria-label="Close zoom"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {multi && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-sm text-white/80 bg-black/40 px-3 py-1 rounded-full">
                    {index + 1} / {images.length}
                </div>
            )}

            <TransformWrapper
                key={index}
                doubleClick={{ mode: "toggle", step: 2 }}
                pinch={{ step: 5 }}
                minScale={1}
                maxScale={8}
                centerOnInit
            >
                <TransformComponent
                    wrapperStyle={{ width: "100vw", height: "100vh" }}
                    contentStyle={{ width: "100vw", height: "100vh" }}
                >
                    <div className="w-screen h-screen flex items-center justify-center">
                        <img
                            src={imgUrl(images[index])}
                            alt={alt}
                            className="max-w-full max-h-full object-contain select-none"
                            draggable={false}
                        />
                    </div>
                </TransformComponent>
            </TransformWrapper>

            {multi && (
                <>
                    <button
                        onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="w-7 h-7 text-white" />
                    </button>
                    <button
                        onClick={() => onIndexChange((index + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                        aria-label="Next image"
                    >
                        <ChevronRight className="w-7 h-7 text-white" />
                    </button>
                </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-xs text-white/50">
                Pinch or double-tap to zoom · drag to pan
            </div>
        </div>
    );
}
