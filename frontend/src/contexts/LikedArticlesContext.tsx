import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { FeedItem } from "../types/feed";
import { Heart } from "lucide-react";
import "../assets/heartAnimation.css";

interface LikedArticlesContextType {
    likedArticles: FeedItem[];
    toggleLike: (item: FeedItem) => void;
    isLiked: (id: string) => boolean;
}

const LikedArticlesContext = createContext<LikedArticlesContextType | undefined>(undefined);

export function LikedArticlesProvider({ children }: { children: ReactNode }) {
    const [likedArticles, setLikedArticles] = useState<FeedItem[]>(() => {
        const saved = localStorage.getItem("likedImages");
        return saved ? JSON.parse(saved) : [];
    });

    const [showHeart, setShowHeart] = useState(false);

    useEffect(() => {
        localStorage.setItem("likedImages", JSON.stringify(likedArticles));
    }, [likedArticles]);

    const toggleLike = (item: FeedItem) => {
        setLikedArticles((prev) => {
            const alreadyLiked = prev.some((a) => a.id === item.id);
            if (alreadyLiked) {
                return prev.filter((a) => a.id !== item.id);
            } else {
                setShowHeart(true);
                setTimeout(() => setShowHeart(false), 800);
                return [...prev, item];
            }
        });
    };

    const isLiked = (id: string) => {
        return likedArticles.some((item) => item.id === id);
    };

    return (
        <LikedArticlesContext.Provider value={{ likedArticles, toggleLike, isLiked }}>
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
