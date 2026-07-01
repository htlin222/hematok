import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import type { FeedItem } from "../types/feed";
import { Heart } from "lucide-react";
import "../assets/heartAnimation.css";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";

const LIKES_KEY = "likedImages";
const DISLIKES_KEY = "dislikedImages";
const READ_KEY = "readImages"; // ids of cards that have scrolled into view

interface LikedArticlesContextType {
    likedArticles: FeedItem[];
    dislikedArticles: FeedItem[];
    toggleLike: (item: FeedItem) => void;
    toggleDislike: (item: FeedItem) => void;
    isLiked: (id: string) => boolean;
    isDisliked: (id: string) => boolean;
    markRead: (item: FeedItem) => void;
    // True once we're safe to load the feed: either anonymous, or the logged-in
    // owner's server history has been hydrated. The feed waits on this so the
    // first page already reflects server likes / read history.
    synced: boolean;
}

const LikedArticlesContext = createContext<LikedArticlesContextType | undefined>(undefined);

function readReadIds(): string[] {
    try {
        const raw = localStorage.getItem(READ_KEY);
        return raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}

export function LikedArticlesProvider({ children }: { children: ReactNode }) {
    const { ready, email } = useAuth();

    const [likedArticles, setLikedArticles] = useState<FeedItem[]>(() => {
        const saved = localStorage.getItem(LIKES_KEY);
        return saved ? JSON.parse(saved) : [];
    });

    // Dislikes feed the recommendation Worker as a negative signal (push the
    // semantic profile away from these) and are excluded from future pages.
    const [dislikedArticles, setDislikedArticles] = useState<FeedItem[]>(() => {
        const saved = localStorage.getItem(DISLIKES_KEY);
        return saved ? JSON.parse(saved) : [];
    });

    const [showHeart, setShowHeart] = useState(false);
    const [synced, setSynced] = useState(false);

    // Ids already recorded as read this session — dedupes markRead so we don't
    // spam the server or localStorage on every intersection event.
    const readSet = useRef<Set<string>>(new Set(readReadIds()));

    useEffect(() => {
        localStorage.setItem(LIKES_KEY, JSON.stringify(likedArticles));
    }, [likedArticles]);

    useEffect(() => {
        localStorage.setItem(DISLIKES_KEY, JSON.stringify(dislikedArticles));
    }, [dislikedArticles]);

    // On login, union this device's local history into the server and adopt the
    // merged truth. Anonymous visitors are "synced" immediately (nothing to do).
    useEffect(() => {
        if (!ready) return;
        if (!email) {
            setSynced(true);
            return;
        }
        let alive = true;
        (async () => {
            const local = {
                liked: JSON.parse(localStorage.getItem(LIKES_KEY) || "[]") as FeedItem[],
                disliked: JSON.parse(localStorage.getItem(DISLIKES_KEY) || "[]") as FeedItem[],
                read: readReadIds(),
            };
            const merged = (await api.merge(local)) ?? (await api.state());
            if (!alive) return;
            if (merged) {
                setLikedArticles(merged.liked ?? []);
                setDislikedArticles(merged.disliked ?? []);
                const read = merged.read ?? [];
                readSet.current = new Set(read);
                localStorage.setItem(READ_KEY, JSON.stringify(read));
            }
            setSynced(true);
        })();
        return () => {
            alive = false;
        };
    }, [ready, email]);

    const toggleLike = (item: FeedItem) => {
        setLikedArticles((prev) => {
            const alreadyLiked = prev.some((a) => a.id === item.id);
            if (alreadyLiked) {
                if (email) api.event("unlike", { id: item.id });
                return prev.filter((a) => a.id !== item.id);
            } else {
                // Liking clears any existing dislike — the two are exclusive.
                setDislikedArticles((d) => d.filter((a) => a.id !== item.id));
                setShowHeart(true);
                setTimeout(() => setShowHeart(false), 800);
                if (email) api.event("like", { item });
                return [...prev, item];
            }
        });
    };

    const toggleDislike = (item: FeedItem) => {
        setDislikedArticles((prev) => {
            const alreadyDisliked = prev.some((a) => a.id === item.id);
            if (alreadyDisliked) {
                if (email) api.event("undislike", { id: item.id });
                return prev.filter((a) => a.id !== item.id);
            } else {
                // Disliking clears any existing like — the two are exclusive.
                setLikedArticles((l) => l.filter((a) => a.id !== item.id));
                if (email) api.event("dislike", { item });
                return [...prev, item];
            }
        });
    };

    // A card scrolled into view. Record it as read once (deduped). Persisted
    // locally always; mirrored to the server when the owner is logged in.
    const markRead = (item: FeedItem) => {
        if (readSet.current.has(item.id)) return;
        readSet.current.add(item.id);
        localStorage.setItem(READ_KEY, JSON.stringify([...readSet.current]));
        if (email) api.event("read", { id: item.id });
    };

    const isLiked = (id: string) => likedArticles.some((item) => item.id === id);
    const isDisliked = (id: string) => dislikedArticles.some((item) => item.id === id);

    return (
        <LikedArticlesContext.Provider
            value={{
                likedArticles,
                dislikedArticles,
                toggleLike,
                toggleDislike,
                isLiked,
                isDisliked,
                markRead,
                synced,
            }}
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
