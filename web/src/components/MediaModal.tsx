import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function MediaModal({ id, profileId, onClose }: { id: number; profileId: string; onClose: () => void }) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, boolean>>({});
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = 'unset'; 
      document.documentElement.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    async function fetchDetailsAndInteractions() {
      // Fetch media details
      const { data: mediaData } = await supabase.from('all').select('*').eq('id', id).single();
      if (mediaData) {
        setItem(mediaData);
        setTimeout(() => setShowVideo(true), 1500);
      }

      // Fetch user interaction
      if (profileId) {
        const { data: interactionData } = await supabase
          .from('interactions')
          .select('*')
          .eq('profile_id', profileId)
          .eq('media_id', id)
          .single();
          
        if (interactionData) {
          setIsWatched(interactionData.is_in_list || false);
          setRating(interactionData.rating || 0);
          setEpisodeProgress(interactionData.episode_progress || {});
        }
      }

      setLoading(false);
    }
    fetchDetailsAndInteractions();
  }, [id, profileId]);

  const toggleWatched = async () => {
    const newState = !isWatched;
    setIsWatched(newState);
    
    await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: newState,
      rating: rating,
      episode_progress: episodeProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id, media_id' });
  };

  const toggleEpisode = async (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newProgress = { ...episodeProgress, [index]: !episodeProgress[index] };
    setEpisodeProgress(newProgress);

    await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: isWatched,
      rating: rating,
      episode_progress: newProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id, media_id' });
  };

  const handleRate = async (stars: number) => {
    setRating(stars);
    
    await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: isWatched,
      rating: stars,
      episode_progress: episodeProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id, media_id' });
  };

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#E50914] border-opacity-50"></div>
    </div>
  );
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-start overflow-y-auto bg-black/90 p-4 md:p-10 pt-10 no-scrollbar overscroll-contain" onClick={onClose}>
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl bg-[#181818] rounded-xl overflow-hidden shadow-2xl animate-fade-in-up transform-gpu" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 bg-[#181818]/90 hover:bg-white/10 rounded-full flex items-center justify-center text-white text-xl transition-colors"
        >
          ✕
        </button>

        {/* Hero Video/Poster Section */}
        <div className="relative w-full h-[50vh] md:h-[60vh] bg-black">
          {showVideo ? (
             <div className="absolute inset-0 bg-black flex items-center justify-center text-gray-500 overflow-hidden">
               <img 
                 src={item.poster} 
                 alt={item.title} 
                 className="w-full h-full object-cover scale-110 origin-center animate-ken-burns opacity-40 transform-gpu" 
                 onError={(e) => { e.currentTarget.style.display = 'none'; }}
               />
               <span className="absolute text-sm font-bold tracking-widest uppercase text-white/50">Reproduciendo Tráiler...</span>
             </div>
          ) : (
            <img 
              src={item.poster || 'https://via.placeholder.com/1920x1080?text=No+Poster'} 
              alt={item.title}
              className="w-full h-full object-cover opacity-80"
              onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/1920x1080?text=No+Poster'; }}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent"></div>
          
          <div className="absolute bottom-6 left-10 right-10">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 drop-shadow-lg leading-tight w-3/4">
              {item.title}
            </h1>
            <div className="flex items-center gap-3">
              <button className="px-8 py-2 md:py-3 bg-white text-black font-bold rounded-md hover:bg-white/80 transition flex items-center gap-2 text-lg">
                <span className="text-xl">▶</span> Reproducir
              </button>
              <button 
                onClick={toggleWatched}
                className="w-10 h-10 md:w-12 md:h-12 border-2 border-gray-400 hover:border-white rounded-full flex items-center justify-center text-white text-xl hover:bg-white/10 transition group relative"
              >
                {isWatched ? '✓' : '+'}
                <span className="absolute -top-10 bg-white text-black text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  {isWatched ? 'Quitar de Mi lista' : 'Agregar a Mi lista'}
                </span>
              </button>
              <button className="w-10 h-10 md:w-12 md:h-12 border-2 border-gray-400 hover:border-white rounded-full flex items-center justify-center text-white text-xl hover:bg-white/10 transition relative group">
                👍
                <span className="absolute -top-10 bg-white text-black text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  Calificar
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-10 flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-2/3">
            <div className="flex items-center gap-3 text-sm md:text-base font-semibold text-gray-300 mb-6">
              <span className="text-green-500 font-bold">{Math.floor(Math.random() * 20 + 80)}% para ti</span>
              <span>{item.date}</span>
              <span className="border border-gray-600 px-1 text-xs">HD</span>
              <span>{item.duration || '2h 10m'}</span>
            </div>

            <p className="text-gray-200 text-sm md:text-base leading-relaxed mb-8">
              {item.sinopsis || "Descubre esta increíble obra disponible ahora mismo en el catálogo."}
            </p>

            <div className="mt-8 border-t border-gray-700 pt-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Descargas y Capítulos
              </h3>
              
              {item.links && item.links.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {item.links.map((link: string, index: number) => {
                    const isSeason = link.toLowerCase().includes('temporada');
                    const isSeen = episodeProgress[index];
                    return (
                    <div key={index} className="flex gap-2 items-center group">
                      <button 
                        onClick={(e) => toggleEpisode(index, e)}
                        className={`w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center transition-colors flex-shrink-0 ${isSeen ? 'bg-green-600 border-green-500 text-white' : 'hover:border-white text-transparent hover:text-white'}`}
                        title={isSeen ? "Marcar como no visto" : "Marcar como visto"}
                      >
                        ✓
                      </button>
                      <a 
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-1 flex justify-between items-center p-4 bg-[#2f2f2f] hover:bg-[#404040] rounded-md transition-colors ${isSeen ? 'opacity-50' : ''} text-gray-200`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-light text-gray-500 group-hover:text-white transition-colors">{index + 1}</span>
                          <div>
                            <p className="font-bold text-white text-sm">
                              {isSeason ? `Temporada o Pack ${index + 1}` : `Episodio / Parte ${index + 1}`}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px] md:max-w-xs">{link}</p>
                          </div>
                        </div>
                        <span className="text-gray-400 group-hover:text-white transition-colors">⬇</span>
                      </a>
                    </div>
                  )})}
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">No se encontraron enlaces directos.</p>
              )}
            </div>
          </div>

          <div className="w-full md:w-1/3 flex flex-col gap-4 text-sm text-gray-400">
            <p>
              <span className="text-gray-500">Elenco: </span> 
              N/A
            </p>
            <p>
              <span className="text-gray-500">Géneros: </span> 
              Acción, Aventura, Drama
            </p>
            <p>
              <span className="text-gray-500">Calificación personal: </span> 
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => handleRate(star)}
                    className={`text-lg transition-colors ${rating >= star ? 'text-[#E50914]' : 'text-gray-600 hover:text-[#E50914]/50'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </p>
          </div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #808080; }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(50px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes kenBurns {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.15); }
        }
        .animate-ken-burns {
          animation: kenBurns 15s ease-out infinite alternate;
        }
      `}</style>
    </div>
  );
}
