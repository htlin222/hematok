import { useEffect, useRef, useCallback, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { ImageCard } from "./components/ImageCard";
import { useLikedImages } from "./contexts/LikedImagesContext";
import { useFeed } from "./hooks/useFeed";
import { imageUrl } from "./types/feed";

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { cards, loading, error, loadMore } = useFeed();
  const { likedImages, toggleLike } = useLikedImages();
  const observerTarget = useRef(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && !loading) loadMore();
    },
    [loading, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: "200px",
    });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  const filteredLikes = likedImages.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.cats.join(" ").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen w-full bg-black text-white overflow-y-scroll snap-y snap-mandatory hide-scroll">
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => window.location.reload()}
          className="text-2xl font-bold text-white drop-shadow-lg hover:opacity-80 transition-opacity"
        >
          Hematok
        </button>
      </div>

      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setShowAbout((v) => !v)}
          className="text-sm text-white/70 hover:text-white transition-colors"
        >
          About
        </button>
        <button
          onClick={() => setShowLikes((v) => !v)}
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
              A TikTok-style feed for exploring hematology images from the{" "}
              <a
                href="https://imagebank.hematology.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline"
              >
                ASH Image Bank
              </a>
              .
            </p>
            <p className="text-white/70 text-sm">
              UI derived from{" "}
              <a
                href="https://github.com/IsaacGemal/wikitok"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline"
              >
                WikiTok
              </a>{" "}
              (MIT). Images © ASH and the contributing authors.
            </p>
          </div>
          <div className="w-full h-full z-[40] top-0 left-0 fixed" onClick={() => setShowAbout(false)} />
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
            <h2 className="text-xl font-bold mb-4">Liked Images</h2>
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search liked images..."
                className="w-full bg-gray-800 text-white px-4 py-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-5 h-5 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredLikes.length === 0 ? (
                <p className="text-white/70">
                  {searchQuery ? "No matches found." : "No liked images yet."}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredLikes.map((a) => (
                    <div key={a.id} className="flex gap-4 items-start group">
                      {a.image && (
                        <img
                          src={imageUrl(a.image)}
                          alt={a.title}
                          className="w-20 h-20 object-cover rounded bg-gray-800"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:text-gray-200"
                          >
                            {a.title}
                          </a>
                          <button
                            onClick={() =>
                              toggleLike({
                                id: a.id,
                                title: a.title,
                                url: a.url,
                                images: a.image ? [a.image] : [],
                                cats: a.cats,
                                author: "",
                                collection: "",
                                views: 0,
                                downloads: 0,
                                rand: 0,
                              })
                            }
                            className="text-white/50 hover:text-white/90 p-1 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            aria-label="Remove from likes"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-white/60 line-clamp-2">{a.cats.join("  ›  ")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="w-full h-full z-[40] top-0 left-0 fixed" onClick={() => setShowLikes(false)} />
        </div>
      )}

      {error && (
        <div className="h-screen w-full flex items-center justify-center text-center px-6">
          <div>
            <p className="text-red-400 font-semibold mb-2">Couldn't load the feed.</p>
            <p className="text-white/60 text-sm">{error}</p>
          </div>
        </div>
      )}

      {cards.map((card) => (
        <ImageCard key={card.id} card={card} />
      ))}
      <div ref={observerTarget} className="h-10 -mt-1" />
      {loading && (
        <div className="h-screen w-full flex items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      )}
    </div>
  );
}

export default App;
