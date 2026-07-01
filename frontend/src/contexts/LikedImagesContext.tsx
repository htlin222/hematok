import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Heart } from "lucide-react";
import type { FeedCard } from "../types/feed";
import "../assets/heartAnimation.css";

export interface LikedImage {
  id: string;
  title: string;
  url: string;
  /** first image key, for the thumbnail */
  image?: string;
  cats: string[];
}

interface LikedImagesContextType {
  likedImages: LikedImage[];
  toggleLike: (card: FeedCard) => void;
  isLiked: (id: string) => boolean;
}

const LikedImagesContext = createContext<LikedImagesContextType | undefined>(undefined);
const STORAGE_KEY = "hematok:liked";

export function LikedImagesProvider({ children }: { children: ReactNode }) {
  const [likedImages, setLikedImages] = useState<LikedImage[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showHeart, setShowHeart] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likedImages));
  }, [likedImages]);

  const toggleLike = (card: FeedCard) => {
    setLikedImages((prev) => {
      if (prev.some((a) => a.id === card.id)) {
        return prev.filter((a) => a.id !== card.id);
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
      return [
        ...prev,
        { id: card.id, title: card.title, url: card.url, image: card.images[0], cats: card.cats },
      ];
    });
  };

  const isLiked = (id: string) => likedImages.some((a) => a.id === id);

  return (
    <LikedImagesContext.Provider value={{ likedImages, toggleLike, isLiked }}>
      {children}
      {showHeart && (
        <div className="heart-animation">
          <Heart size={200} strokeWidth={0} className="fill-white" />
        </div>
      )}
    </LikedImagesContext.Provider>
  );
}

export function useLikedImages() {
  const ctx = useContext(LikedImagesContext);
  if (!ctx) throw new Error("useLikedImages must be used within a LikedImagesProvider");
  return ctx;
}
