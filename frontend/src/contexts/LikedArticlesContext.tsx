import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { FeedItem } from "../types/feed";
import { Heart } from "lucide-react";
import "../assets/heartAnimation.css";

interface LikedArticlesContextType {
    likedArticles: FeedItem[];
    dislikedArticles: FeedItem[];
    toggleLike: (item: FeedItem) => void;
    toggleDislike: (item: FeedItem) => void;
    isLiked: (id: string) => boolean;
    isDisliked: (id: string) => boolean;
}

const LikedArticlesContext = createContext<LikedArticlesContextType | undefined>(undefined);

export function LikedArticlesProvider({ children }: { children: ReactNode }) {
    const [likedArticles, setLikedArticles] = useState<FeedItem[]>(() => {
        const saved = localStorage.getItem("likedImages");
        return saved ? JSON.parse(saved) : [];
    });

    // Dislikes feed the recommendation Worker as a negative signal (push the
    // semantic profile away from these) and are excluded from future pages.
    const [dislikedArticles, setDislikedArticles] = useState<FeedItem[]>(() => {
        const saved = localStorage.getItem("dislikedImages");
        return saved ? JSON.parse(saved) : [];
    });

    const [showHeart, setShowHeart] = useState(false);

    useEffect(() => {
        localStorage.setItem("likedImages", JSON.stringify(likedArticles));
    }, [likedArticles]);

    useEffect(() => {
        localStorage.setItem("dislikedImages", JSON.stringify(dislikedArticles));
    }, [dislikedArticles]);

    const toggleLike = (item: FeedItem) => {
        setLikedArticles((prev) => {
            const alreadyLiked = prev.some((a) => a.id === item.id);
            if (alreadyLiked) {
                return prev.filter((a) => a.id !== item.id);
            } else {
                // Liking clears any existing dislike — the two are exclusive.
                setDislikedArticles((d) => d.filter((a) => a.id !== item.id));
                setShowHeart(true);
                setTimeout(() => setShowHeart(false), 800);
                return [...prev, item];
            }
        });
    };

    const toggleDislike = (item: FeedItem) => {
        setDislikedArticles((prev) => {
            const alreadyDisliked = prev.some((a) => a.id === item.id);
            if (alreadyDisliked) {
                return prev.filter((a) => a.id !== item.id);
            } else {
                // Disliking clears any existing like — the two are exclusive.
                setLikedArticles((l) => l.filter((a) => a.id !== item.id));
                return [...prev, item];
            }
        });
    };

    const isLiked = (id: string) => likedArticles.some((item) => item.id === id);
    const isDisliked = (id: string) => dislikedArticles.some((item) => item.id === id);

    return (
        <LikedArticlesContext.Provider
            value={{ likedArticles, dislikedArticles, toggleLike, toggleDislike, isLiked, isDisliked }}
        >
            {children}
            {showHeart && (
                <div className="heart-animation">
                    <Heart size={200} strokeWidth={0} className="fill-white" />
                </div>
            )}
        </LikedArticlesContext.Provider>
    );
}

export function useLikedArticles() {
    const context = useContext(LikedArticlesContext);
    if (!context) {
        throw new Error("useLikedArticles must be used within a LikedArticlesProvider");
    }
    return context;
}
