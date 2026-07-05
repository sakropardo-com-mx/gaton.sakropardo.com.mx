import { useEffect, useState, FormEvent } from 'react';
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

const PAGE_SIZE = 48;

export function Home() {
  const [data, setData] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  
  const [category, setCategory] = useState('Todos'); // 'Todos', 'Peliculas', 'Series'
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = async (isNewSearch = false) => {
    setLoading(true);
    const currentPage = isNewSearch ? 0 : page;
    
    let query = supabase
      .from('all')
      .select('id, title, poster, date, duration, sinopsis')
      .order('id', { ascending: false });

    // Category filter heuristic (since it's all in one table)
    if (category === 'Peliculas') {
      query = query.not('title', 'ilike', '%temporada%').not('title', 'ilike', '%serie%');
    } else if (category === 'Series') {
      query = query.or('title.ilike.%temporada%,title.ilike.%serie%');
    }

    if (activeSearch) {
      query = query.ilike('title', `%${activeSearch}%`);
    }

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data: records, error } = await query;

    if (error) {
      console.error('Error fetching data:', error);
    } else {
      if (isNewSearch) {
        setData(records as MediaItem[]);
      } else {
        setData(prev => [...prev, ...(records as MediaItem[])]);
      }
      
      if (records && records.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems(true);
  }, [activeSearch, category]);

  useEffect(() => {
    if (page > 0) {
      fetchItems(false);
    }
  }, [page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    setPage(0);
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-4 drop-shadow-sm">
          Gaton Play Series
        </h1>
        <p className="text-gray-400 text-lg">Descubre y descarga tus películas y series favoritas.</p>
      </header>

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700/50 backdrop-blur-sm">
        <form onSubmit={handleSearch} className="w-full md:w-1/2 flex">
          <input
            type="text"
            placeholder="Buscar título..."
            className="flex-grow p-3 rounded-l-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-r-lg font-bold text-white transition-colors">
            Buscar
          </button>
        </form>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {['Todos', 'Peliculas', 'Series'].map(cat => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setPage(0);
              }}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                category === cat 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {data.map((item) => (
          <Link to={`/media/${item.id}`} key={item.id} className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 hover:shadow-2xl hover:border-purple-500/50 transition-all duration-300 group flex flex-col">
            <div className="relative h-96 overflow-hidden bg-slate-900">
              <img 
                src={item.poster || 'https://via.placeholder.com/300x450?text=No+Poster'} 
                alt={item.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="text-xl font-bold text-white leading-tight drop-shadow-md">{item.title}</h2>
                <p className="text-sm text-gray-300 mt-1">{item.date} • {item.duration}</p>
              </div>
            </div>
            <div className="p-5 flex-grow flex flex-col">
              <p className="text-gray-400 text-sm line-clamp-3 mb-4 flex-grow">
                {item.sinopsis || "Sin sinopsis disponible."}
              </p>
              <div className="mt-auto pt-2 border-t border-slate-700/50 text-center">
                <span className="text-purple-400 font-semibold group-hover:text-purple-300 transition-colors">
                  Ver Detalles y Descargar &rarr;
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Cargando...</p>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-20 text-gray-500 text-lg bg-slate-800/50 rounded-xl">
          No se encontraron resultados.
        </div>
      )}

      {!loading && hasMore && data.length > 0 && (
        <div className="text-center mt-12">
          <button 
            onClick={() => setPage(p => p + 1)}
            className="px-8 py-3 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:border-purple-500 rounded-full font-bold text-white shadow-lg transition-all"
          >
            Cargar Más Películas y Series
          </button>
        </div>
      )}
    </div>
  );
}
