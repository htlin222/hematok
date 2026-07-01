import { Share2, Heart, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useLikedImages } from "../contexts/LikedImagesContext";
import type { FeedCard } from "../types/feed";
import { imageUrl } from "../types/feed";

interface ImageCardProps {
  card: FeedCard;
}

export function ImageCard({ card }: ImageCardProps) {
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [active, setActive] = useState(0);
  const [showMeta, setShowMeta] = useState(false);
  const { toggleLike, isLiked } = useLikedImages();

  const multi = card.images.length > 1;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: card.title, url: card.url });
      } else {
        await navigator.clipboard.writeText(card.url);
        alert("Link copied to clipboard!");
      }
    } catch {
      /* user dismissed share sheet */
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div
      className="h-screen w-full flex items-center justify-center snap-start relative bg-black"
      onDoubleClick={() => toggleLike(card)}
    >
      {/* image / gallery */}
      <div
        className="h-full w-full flex overflow-x-auto snap-x snap-mandatory hide-scroll"
        onScroll={multi ? onScroll : undefined}
      >
        {card.images.map((key, i) => (
          <div key={key} className="relative h-full w-full flex-shrink-0 snap-center">
            <img
              loading="lazy"
              src={imageUrl(key)}
              alt={card.title}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                loaded[i] ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setLoaded((m) => ({ ...m, [i]: true }))}
              onError={() => setLoaded((m) => ({ ...m, [i]: true }))}
              onClick={() => setShowMeta((s) => !s)}
            />
            {!loaded[i] && <div className="absolute inset-0 bg-gray-900 animate-pulse" />}
          </div>
        ))}
      </div>

      {/* gallery dots */}
      {multi && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {card.images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* tap hint + metadata overlay */}
      <div
        className={`absolute bottom-[10vh] left-0 right-0 p-6 text-white z-10 transition-opacity ${
          showMeta ? "opacity-100" : "opacity-0 pointer-events-none"
        } bg-gradient-to-t from-black/90 via-black/60 to-transparent`}
      >
        <div className="flex justify-between items-start mb-2 gap-3">
          <h2 className="text-xl font-bold drop-shadow-lg">{card.title}</h2>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => toggleLike(card)}
              className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                isLiked(card.id) ? "bg-red-500 hover:bg-red-600" : "bg-white/10 hover:bg-white/20"
              }`}
              aria-label="Like image"
            >
              <Heart className={`w-5 h-5 ${isLiked(card.id) ? "fill-white" : ""}`} />
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
        {/* category breadcrumb */}
        <p className="text-xs text-white/70 mb-2 leading-relaxed">{card.cats.join("  ›  ")}</p>
        {card.author && <p className="text-sm text-white/60 mb-3 line-clamp-2">{card.author}</p>}
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-white hover:text-gray-200 drop-shadow-lg"
        >
          View on ASH Image Bank <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* persistent tap affordance when overlay hidden */}
      {!showMeta && (
        <div className="absolute bottom-[12vh] left-6 right-6 z-10 pointer-events-none">
          <h2 className="text-lg font-semibold text-white drop-shadow-lg line-clamp-2">{card.title}</h2>
          <p className="text-xs text-white/60 mt-1">tap image for details</p>
        </div>
      )}
    </div>
  );
}
