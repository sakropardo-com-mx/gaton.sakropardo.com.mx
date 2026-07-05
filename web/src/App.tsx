import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface MediaItem {
  id: number;
  title: string;
  poster: string;
  date: string;
  duration: string;
  sinopsis: string;
  url: string;
  links: string[] | null;
}

function App() {
  const [data, setData] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos'); // 'Todos', 'Peliculas', 'Series'
  const [showLinksMap, setShowLinksMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: records, error } = await supabase
        .from('all')
        .select('id, title, poster, date, duration, sinopsis, url, links')
        .order('id', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching data:', error);
      } else {
        setData(records as MediaItem[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const toggleLinks = (id: number) => {
    setShowLinksMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredData = data.filter(item => {
    // Basic search filtering
    const matchesSearch = item.title?.toLowerCase().includes(search.toLowerCase());
    
    // Categorization heuristic since everything is in "all".
    // We can guess it's a series if title has "TEMPORADA" or "SERIES".
    const isSeries = item.title?.toLowerCase().includes('temporada');
    
    let matchesCategory = true;
    if (category === 'Peliculas') {
      matchesCategory = !isSeries;
    } else if (category === 'Series') {
      matchesCategory = isSeries;
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-4 drop-shadow-sm">
          Gaton Play Series
        </h1>
        <p className="text-gray-400 text-lg">Descubre y descarga tus películas y series favoritas.</p>
      </header>

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700/50 backdrop-blur-sm">
        <input
          type="text"
          placeholder="Buscar título en tiempo real..."
          className="w-full md:w-1/2 p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-inner"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {['Todos', 'Peliculas', 'Series'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
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

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Cargando catálogo...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredData.map((item) => (
            <div key={item.id} className="bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 hover:shadow-2xl hover:border-purple-500/50 transition-all duration-300 group flex flex-col">
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
                
                <div className="mt-auto">
                  <button 
                    onClick={() => toggleLinks(item.id)}
                    className="w-full py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {showLinksMap[item.id] ? 'Ocultar Enlaces' : 'Mostrar Enlaces de Descarga'}
                  </button>

                  {showLinksMap[item.id] && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {item.links && item.links.length > 0 ? (
                        item.links.map((link, idx) => (
                          <a 
                            key={idx} 
                            href={link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-sm text-blue-400 hover:text-blue-300 truncate hover:underline bg-slate-800 p-2 rounded"
                          >
                            Enlace {idx + 1}
                          </a>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic text-center">No hay enlaces directos. Visita el post original.</p>
                      )}
                      
                      {item.url && (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-sm text-center text-purple-400 hover:text-purple-300 mt-2 hover:underline"
                        >
                          Ver Post Original
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredData.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-500">
              No se encontraron resultados para "{search}".
            </div>
          )}
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}</style>
    </div>
  );
}

export default App;
