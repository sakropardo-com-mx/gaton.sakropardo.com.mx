import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { MediaModal } from '../components/MediaModal';

interface MediaItem {
  id: number;
  title: string;
  poster: string;
  date: string;
  duration: string;
  sinopsis: string;
}

export function Home({ activeProfile }: { activeProfile: { name: string, avatar: string } }) {
  const { modalId } = useParams();
  const navigate = useNavigate();
  
  const [featured, setFeatured] = useState<MediaItem | null>(null);
  const [recents, setRecents] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<MediaItem[]>([]);
  
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll for sticky navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      // 4. Load Continue Watching from localStorage
      const watchedIds = Object.keys(localStorage)
        .filter(k => k.startsWith('watched_') && localStorage.getItem(k) === 'true')
        .map(k => parseInt(k.replace('watched_', '')));
        
      if (watchedIds.length > 0) {
        const { data: watchedData } = await supabase
          .from('all')
          .select('id, title, poster, date, duration, sinopsis')
          .in('id', watchedIds.slice(0, 15));
        if (watchedData) setContinueWatching(watchedData as MediaItem[]);
      }

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

  // Reusable Carousel Component with Scroll Arrows
  const CarouselRow = ({ title, items, isTop10 = false, showProgress = false }: { title: string, items: MediaItem[], isTop10?: boolean, showProgress?: boolean }) => {
    const scrollLeft = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.parentElement?.querySelector('.carousel-container')?.scrollBy({ left: -800, behavior: 'smooth' });
    };
    const scrollRight = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.parentElement?.querySelector('.carousel-container')?.scrollBy({ left: 800, behavior: 'smooth' });
    };

    return (
      <div className="mb-12 relative group/row">
        <h2 className="text-xl md:text-2xl font-bold text-gray-200 hover:text-white mb-2 px-4 md:px-12 transition-colors cursor-pointer">
          {title}
        </h2>
        <div className="relative">
          <button onClick={scrollLeft} className="absolute left-0 top-0 bottom-0 w-12 bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover/row:opacity-100 transition-all z-20 flex items-center justify-center">
            <span className="text-3xl font-bold">&lsaquo;</span>
          </button>
          
          <div className="carousel-container flex gap-4 overflow-x-auto pb-8 pt-4 px-4 md:px-12 scroll-smooth snap-x snap-mandatory no-scrollbar items-center">
            {items.map((item, index) => (
              <div 
                key={item.id} 
                className="shrink-0 flex items-center snap-start relative group transition-transform duration-300 hover:scale-110 hover:z-30 cursor-pointer origin-center"
                onClick={() => navigate(`/media/${item.id}`)}
              >
                {isTop10 && (
                  <span className="text-[120px] md:text-[180px] font-black tracking-tighter text-black outline-text leading-none mr-[-20px] md:mr-[-40px] z-0 select-none drop-shadow-2xl">
                    {index + 1}
                  </span>
                )}
                <div className={`rounded-md overflow-hidden bg-slate-900 shadow-lg aspect-[2/3] ${isTop10 ? 'w-[120px] md:w-[180px]' : 'w-[140px] md:w-[220px] lg:w-[260px]'} relative z-10`}>
                  <img 
                    src={item.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} 
                    alt={item.title} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Poster'; }}
                  />
                  {showProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                      <div className="h-full bg-[#E50914]" style={{ width: `${Math.random() * 60 + 20}%` }}></div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="text-white font-bold text-sm md:text-base leading-tight line-clamp-2 drop-shadow-md mb-2">{item.title}</h3>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="text-green-500">Nuevo</span>
                      <span className="text-gray-300 border border-gray-600 px-1">HD</span>
                      <span className="text-gray-300">{item.duration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={scrollRight} className="absolute right-0 top-0 bottom-0 w-12 bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover/row:opacity-100 transition-all z-20 flex items-center justify-center">
            <span className="text-3xl font-bold">&rsaquo;</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#141414] font-sans pb-10">
      {/* Netflix Navbar */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#141414] shadow-lg' : 'bg-gradient-to-b from-black/80 to-transparent'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-12 py-4 gap-4">
          <div className="flex items-center gap-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#E50914] tracking-wider drop-shadow-md cursor-pointer" onClick={() => setSearchInput('')}>
              GATON
            </h1>
            <nav className="hidden lg:flex gap-5 text-sm text-gray-300">
              <a href="#" className="font-bold text-white hover:text-gray-300 transition-colors">Inicio</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Series</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Películas</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Novedades populares</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Mi lista</a>
            </nav>
          </div>
          
          <div className="w-full md:w-auto flex items-center gap-6">
            <div className="relative group/search w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white font-bold text-lg">
                ⚲
              </span>
              <input
                type="text"
                placeholder="Títulos, géneros..."
                className="w-full pl-10 pr-4 py-1.5 rounded-sm bg-black/60 border border-transparent focus:border-white text-white text-sm focus:outline-none transition-all placeholder-gray-400 group-hover/search:bg-black/80 group-hover/search:border-white"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="hidden md:flex items-center gap-4 text-white">
              <span className="cursor-pointer font-bold text-sm">Niños</span>
              <span className="cursor-pointer text-xl">🔔</span>
              <div className="flex items-center gap-2 cursor-pointer group">
                <div className="w-8 h-8 rounded-sm overflow-hidden border border-transparent group-hover:border-white transition-colors">
                  <img src={activeProfile.avatar} alt={activeProfile.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs">&#9660;</span>
              </div>
            </div>
          </div>
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
                      <button 
                        onClick={() => navigate(`/media/${featured.id}`)}
                        className="px-6 md:px-8 py-2 md:py-3 bg-white text-black font-bold rounded-md hover:bg-white/80 transition flex items-center gap-2 text-lg"
                      >
                        <span className="text-2xl">▶</span> Reproducir
                      </button>
                      <button 
                        onClick={() => navigate(`/media/${featured.id}`)}
                        className="px-6 md:px-8 py-2 md:py-3 bg-gray-500/50 text-white font-bold rounded-md hover:bg-gray-500/70 transition flex items-center gap-2 text-lg backdrop-blur-sm"
                      >
                        <span className="text-xl">ℹ</span> Más información
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CAROUSELS */}
              <div className="relative z-20 -mt-10 md:-mt-20">
                {continueWatching.length > 0 && (
                  <CarouselRow title={`Seguir viendo para ${activeProfile.name}`} items={continueWatching} showProgress={true} />
                )}
                <CarouselRow title="Las 10 películas más populares en México hoy" items={recents.slice(0, 10)} isTop10={true} />
                <CarouselRow title="Agregados Recientemente" items={recents} />
                <CarouselRow title="Películas Destacadas" items={movies} />
                <CarouselRow title="Maratón de Series" items={series} />
              </div>
            </>
          )}
        </>
      )}

      {/* Render Modal Overlay */}
      {modalId && <MediaModal id={parseInt(modalId, 10)} onClose={() => navigate('/')} />}

      {/* Tailwind Custom Scrollbar for Netflix rows */}
      <style>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .outline-text {
          -webkit-text-stroke: 4px #595959;
          text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000;
        }
        body { background-color: #141414; }
      `}</style>
    </div>
  );
}
