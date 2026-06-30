import { useEffect, useRef, useCallback, useState } from "react";
import { HematokCard } from "./components/HematokCard";
import { DetailsSheet } from "./components/DetailsSheet";
import { Loader2, Search, X, Download } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { useLikedArticles } from "./contexts/LikedArticlesContext";
import { useFeed } from "./hooks/useFeed";
import { imgUrl } from "./types/feed";
import type { FeedItem } from "./types/feed";

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const { items, loading, fetchArticles } = useFeed();
  const { likedArticles, toggleLike } = useLikedArticles();
  const observerTarget = useRef(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsItem, setDetailsItem] = useState<FeedItem | null>(null);
  const itemsRef = useRef<FeedItem[]>(items);
  itemsRef.current = items;

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && !loading) {
        fetchArticles();
      }
    },
    [loading, fetchArticles]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: "100px",
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    fetchArticles();
  }, []);

  // Space should scroll the feed (like a normal page), not re-trigger whatever
  // button last had focus (e.g. the ⓘ Details button). Leave inputs and open
  // modals (zoom / details sheet) alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;

      // "i" opens the details/info sheet for the card currently centered in view.
      if (e.key === "i" || e.key === "I") {
        if (document.querySelector("[data-modal]")) return; // already open
        const card = document
          .elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
          ?.closest("[data-feed-id]");
        const id = card?.getAttribute("data-feed-id");
        const item = id ? itemsRef.current.find((x) => x.id === id) : undefined;
        if (item) {
          e.preventDefault();
          setDetailsItem(item);
        }
        return;
      }

      // Space scrolls the feed (Shift+Space = up) rather than re-triggering the
      // button that last had focus (e.g. the ⓘ Details button).
      if (e.code !== "Space" && e.key !== " ") return;
      if (document.querySelector("[data-modal]")) return; // a dialog is open
      e.preventDefault();
      if (tag === "BUTTON") el?.blur(); // stop the button activating on keyup
      const dir = e.shiftKey ? -1 : 1;
      scrollerRef.current?.scrollBy({ top: dir * window.innerHeight, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredLikedArticles = likedArticles.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      item.cats.some((c) => c.toLowerCase().includes(q))
    );
  });

  const handleExport = () => {
    const simplified = likedArticles.map((item) => ({
      title: item.title,
      author: item.author,
      categories: item.cats,
      url: item.url,
      images: item.images.map((k) => imgUrl(k)),
    }));

    const dataStr = JSON.stringify(simplified, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `hematok-favorites-${new Date().toISOString().split("T")[0]
      }.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div ref={scrollerRef} className="h-screen w-full bg-black text-white overflow-y-scroll snap-y snap-mandatory hide-scroll">
      <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50">
        <button
          onClick={() => window.location.reload()}
          className="text-2xl font-bold text-white drop-shadow-lg hover:opacity-80 transition-opacity"
        >
          Hematok
        </button>
      </div>

      <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setShowAbout(!showAbout)}
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          About
        </button>
        <button
          onClick={() => setShowLikes(!showLikes)}
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          Likes
        </button>
      </div>

      {showAbout && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 z-[41] p-6 rounded-lg max-w-md relative">
            <button
              onClick={() => setShowAbout(false)}
              className="absolute top-2 right-2 text-white/70 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">About Hematok</h2>
            <p className="mb-4">
              An endless, TikTok-style scroll through the{" "}
              <a
                href="https://imagebank.hematology.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:underline"
              >
                ASH Image Bank
              </a>
              — thousands of hematology and pathology images for study and reference.
            </p>
            <p className="text-white/70">
              Double-tap an image to like it. All images and metadata belong to the
              American Society of Hematology and the original contributors; tap
              &ldquo;View on ASH Image Bank&rdquo; to open the source.
            </p>
          </div>
          <div
            className={`w-full h-full z-[40] top-1 left-1  bg-[rgb(28 25 23 / 43%)] fixed  ${showAbout ? "block" : "hidden"
              }`}
            onClick={() => setShowAbout(false)}
          ></div>
        </div>
      )}

      {showLikes && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 z-[41] p-6 rounded-lg w-full max-w-2xl h-[80vh] flex flex-col relative">
            <button
              onClick={() => setShowLikes(false)}
              className="absolute top-2 right-2 text-white/70 hover:text-white"
            >
              ✕
            </button>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Liked Images</h2>
              {likedArticles.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export liked images"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search liked images..."
                className="w-full bg-gray-800 text-white px-4 py-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-5 h-5 text-white/50 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredLikedArticles.length === 0 ? (
                <p className="text-white/70">
                  {searchQuery ? "No matches found." : "No liked images yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredLikedArticles.map((item) => (
                    <div key={item.id} className="flex gap-4 items-start group">
                      <img
                        src={imgUrl(item.images[0])}
                        alt={item.title}
                        className="w-20 h-20 object-cover rounded bg-black"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:text-gray-200"
                          >
                            {item.title}
                          </a>
                          <button
                            onClick={() => toggleLike(item)}
                            className="text-white/50 hover:text-white/90 p-1 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            aria-label="Remove from likes"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-white/70 line-clamp-2">{item.author}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            className={`w-full h-full z-[40] top-1 left-1  bg-[rgb(28 25 23 / 43%)] fixed  ${showLikes ? "block" : "hidden"
              }`}
            onClick={() => setShowLikes(false)}
          ></div>
        </div>
      )}

      {items.map((item, index) => (
        <HematokCard key={`${item.id}-${index}`} item={item} onOpenDetails={setDetailsItem} />
      ))}
      <div ref={observerTarget} className="h-10 -mt-1" />
      {loading && (
        <div className="h-screen w-full flex items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {detailsItem && (
        <DetailsSheet item={detailsItem} onClose={() => setDetailsItem(null)} />
      )}
      <Analytics />
    </div>
  );
}

export default App;
