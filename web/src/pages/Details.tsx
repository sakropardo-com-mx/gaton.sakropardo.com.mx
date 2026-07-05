import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export function Details() {
  const { id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [rating, setRating] = useState<number>(0);

  useEffect(() => {
    // Load saved states from local storage
    if (id) {
      const watchedState = localStorage.getItem(`watched_${id}`);
      if (watchedState) setIsWatched(JSON.parse(watchedState));
      
      const savedRating = localStorage.getItem(`rating_${id}`);
      if (savedRating) setRating(parseInt(savedRating, 10));
    }

    async function fetchDetails() {
      if (!id) return;
      const { data, error } = await supabase
        .from('all')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error('Error fetching details:', error);
      } else {
        setItem(data);
      }
      setLoading(false);
    }
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-sans">
        <h2 className="text-3xl text-gray-400 mb-4">No se encontró el contenido.</h2>
        <Link to="/" className="text-purple-500 hover:text-purple-400 font-bold underline">
          &larr; Volver al inicio
        </Link>
      </div>
    );
  }

  const toggleWatched = () => {
    const newState = !isWatched;
    setIsWatched(newState);
    localStorage.setItem(`watched_${id}`, JSON.stringify(newState));
  };

  const handleRate = (stars: number) => {
    setRating(stars);
    localStorage.setItem(`rating_${id}`, stars.toString());
  };

  return (
    <div className="min-h-screen relative font-sans overflow-hidden bg-[#141414]">
      {/* Immersive Blurred Background */}
      {item.poster && (
        <div className="absolute inset-0 z-0">
          <img 
            src={item.poster} 
            alt="background" 
            className="w-full h-full object-cover opacity-20 blur-3xl scale-110"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/50 via-[#141414]/80 to-[#141414]"></div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="relative z-10 p-4 md:p-10 max-w-5xl mx-auto pt-8">
        <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-white mb-6 transition-colors group bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
          <span className="mr-2 group-hover:-translate-x-1 transition-transform">&larr;</span> Volver al Catálogo
        </Link>

        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row">
          {/* Poster Section */}
          <div className="w-full md:w-72 shrink-0 bg-black relative">
            <img 
              src={item.poster || 'https://via.placeholder.com/400x600?text=No+Poster'} 
              alt={item.title}
              className="w-full h-full md:h-[450px] object-cover"
              onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x600?text=No+Poster'; }}
            />
          {isWatched && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
              ✓ Visto
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="w-full p-6 md:p-8 flex flex-col">
          <div className="flex-grow">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">
              {item.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-300 mb-4">
              {item.date && (
                <span className="px-2 py-1 bg-slate-700 rounded-md border border-slate-600">
                  📅 {item.date}
                </span>
              )}
              {item.duration && (
                <span className="px-2 py-1 bg-slate-700 rounded-md border border-slate-600">
                  ⏱ {item.duration}
                </span>
              )}
              <div className="flex gap-1 ml-auto">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => handleRate(star)}
                    className={`text-lg transition-colors ${rating >= star ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400/50'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-700 pb-4">
              <button 
                onClick={toggleWatched}
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${isWatched ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                {isWatched ? '✓ Marcado como visto' : '👁 Marcar como visto'}
              </button>
              {item.url && (
                <a 
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-sm font-bold text-white transition-all flex items-center"
                >
                  Post Original &rarr;
                </a>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Sinopsis</h3>
              <p className="text-gray-300 text-sm leading-relaxed max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {item.sinopsis || "No hay sinopsis disponible."}
              </p>
            </div>
          </div>

          {/* Links Section */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>📥</span> Enlaces de Descarga
            </h3>
            
            {item.links && item.links.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {item.links.map((link: string, index: number) => (
                  <a 
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex p-2 bg-slate-800 rounded-md hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500 transition-all text-gray-300 hover:text-white text-xs items-center"
                  >
                    <span className="font-bold text-purple-400 min-w-[30px]">[{index + 1}]</span>
                    <span className="truncate">{link}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs italic">No se encontraron enlaces directos.</p>
            )}
          </div>
        </div>
      </div>
      
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `}</style>
    </div>
  );
}
