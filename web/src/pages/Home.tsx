import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

interface MediaItem {
  id: number;
  title: string;
  poster: string;
  date: string;
  duration: string;
  sinopsis: string;
}

export function Home() {
  const [featured, setFeatured] = useState<MediaItem | null>(null);
  const [recents, setRecents] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Initial Data Load (Hero + Rows)
  useEffect(() => {
    async function loadNetflixUI() {
      setLoading(true);
      
      // 1. Fetch Latest 20 (Recents & Featured)
      const { data: recentData } = await supabase
        .from('all')
        .select('id, title, poster, date, duration, sinopsis')
        .order('id', { ascending: false })
        .limit(20);
        
      if (recentData && recentData.length > 0) {
        setFeatured(recentData[0] as MediaItem);
        setRecents(recentData.slice(1) as MediaItem[]);
      }

      // 2. Fetch Movies
      const { data: movieData } = await supabase
        .from('all')
        .select('id, title, poster, date, duration, sinopsis')
        .not('title', 'ilike', '%temporada%')
        .not('title', 'ilike', '%serie%')
        .order('id', { ascending: false })
        .range(20, 40);
        
      if (movieData) setMovies(movieData as MediaItem[]);

      // 3. Fetch Series
      const { data: serieData } = await supabase
        .from('all')
        .select('id, title, poster, date, duration, sinopsis')
        .or('title.ilike.%temporada%,title.ilike.%serie%')
        .order('id', { ascending: false })
        .limit(20);

      if (serieData) setSeries(serieData as MediaItem[]);

      setLoading(false);
    }
    
    if (!activeSearch) {
      loadNetflixUI();
    }
  }, [activeSearch]);

  // Real-time debounce effect for Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setActiveSearch(searchInput);
      if (searchInput.trim() !== '') {
        setLoading(true);
        const { data } = await supabase
          .from('all')
          .select('id, title, poster, date, duration, sinopsis')
          .ilike('title', `%${searchInput}%`)
          .order('id', { ascending: false })
          .limit(48);
        setSearchResults((data as MediaItem[]) || []);
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reusable Carousel Component
  const CarouselRow = ({ title, items }: { title: string, items: MediaItem[] }) => (
    <div className="mb-10 pl-4 md:pl-12">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 drop-shadow-md">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 pr-12 custom-scrollbar scroll-smooth snap-x snap-mandatory">
        {items.map(item => (
          <Link 
            to={`/media/${item.id}`} 
            key={item.id} 
            className="shrink-0 w-36 md:w-48 lg:w-56 snap-start group relative transition-transform duration-300 hover:scale-105 hover:z-10"
          >
            <div className="rounded-md overflow-hidden bg-slate-800 shadow-lg aspect-[2/3] border border-transparent group-hover:border-slate-500 transition-colors">
              <img 
                src={item.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} 
                alt={item.title} 
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Poster'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                <p className="text-white font-bold text-sm leading-tight line-clamp-2">{item.title}</p>
                <p className="text-gray-300 text-xs mt-1">{item.date}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#141414] font-sans pb-10">
      {/* Absolute Header Overlay */}
      <header className="absolute top-0 w-full z-50 p-4 md:px-12 md:py-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-3xl md:text-4xl font-extrabold text-red-600 tracking-wider uppercase drop-shadow-md cursor-pointer" onClick={() => setSearchInput('')}>
          Gaton Play
        </h1>
        
        <div className="w-full md:w-96 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Títulos, personas, géneros..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-black/60 border border-gray-600 text-white text-sm focus:outline-none focus:border-white focus:bg-black/80 transition-all backdrop-blur-md"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </header>

      {/* SEARCH RESULTS GRID */}
      {activeSearch ? (
        <div className="pt-32 px-4 md:px-12 max-w-[100rem] mx-auto">
          <h2 className="text-2xl text-gray-400 mb-6">Resultados para: <span className="text-white font-bold">{activeSearch}</span></h2>
          
          {loading ? (
            <div className="text-center py-20 text-white">Buscando...</div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {searchResults.map(item => (
                <Link to={`/media/${item.id}`} key={item.id} className="rounded-md overflow-hidden bg-slate-800 shadow-lg aspect-[2/3] group relative transition-transform hover:scale-105 hover:z-10">
                  <img 
                    src={item.poster} 
                    alt={item.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Poster'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <p className="text-white font-bold text-sm leading-tight line-clamp-2">{item.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500 text-lg">No se encontraron resultados.</div>
          )}
        </div>
      ) : (
        /* NETFLIX UI LAYOUT */
        <>
          {loading && !featured ? (
            <div className="h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-600 border-opacity-50"></div>
            </div>
          ) : (
            <>
              {/* HERO BANNER */}
              {featured && (
                <div className="relative h-[70vh] md:h-[85vh] w-full mb-8 bg-black">
                  <div className="absolute inset-0">
                    <img 
                      src={featured.poster || 'https://via.placeholder.com/1920x1080?text=Banner'} 
                      alt={featured.title}
                      className="w-full h-full object-cover opacity-70"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/1920x1080?text=Banner'; }}
                    />
                    {/* Dark Gradients for Netflix effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent"></div>
                  </div>
                  
                  <div className="absolute bottom-[10%] md:bottom-[20%] left-4 md:left-12 max-w-2xl z-10">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg leading-tight line-clamp-2">
                      {featured.title}
                    </h1>
                    
                    <div className="flex items-center gap-4 text-sm md:text-base font-semibold text-gray-300 mb-6 drop-shadow">
                      <span className="text-green-500 font-bold">Nuevo</span>
                      <span>{featured.date}</span>
                      <span className="border border-gray-500 px-1 text-xs">HD</span>
                      <span>{featured.duration}</span>
                    </div>

                    <p className="text-gray-200 text-sm md:text-lg mb-8 line-clamp-3 md:line-clamp-4 drop-shadow-md">
                      {featured.sinopsis || "Descubre esta increíble obra disponible ahora mismo en el catálogo."}
                    </p>

                    <div className="flex gap-4">
                      <Link 
                        to={`/media/${featured.id}`}
                        className="px-6 md:px-8 py-2 md:py-3 bg-white text-black font-bold rounded-md hover:bg-white/80 transition flex items-center gap-2 text-lg"
                      >
                        <span className="text-2xl">▶</span> Reproducir / Descargar
                      </Link>
                      <Link 
                        to={`/media/${featured.id}`}
                        className="px-6 md:px-8 py-2 md:py-3 bg-gray-500/50 text-white font-bold rounded-md hover:bg-gray-500/70 transition flex items-center gap-2 text-lg backdrop-blur-sm"
                      >
                        <span className="text-xl">ℹ</span> Más información
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* CAROUSELS */}
              <div className="relative z-20 -mt-10 md:-mt-20">
                <CarouselRow title="Agregados Recientemente" items={recents} />
                <CarouselRow title="Películas Destacadas" items={movies} />
                <CarouselRow title="Maratón de Series" items={series} />
              </div>
            </>
          )}
        </>
      )}

      {/* Tailwind Custom Scrollbar for Netflix rows */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }
        body { background-color: #141414; }
      `}</style>
    </div>
  );
}
