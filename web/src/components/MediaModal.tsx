import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
// @ts-ignore
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';

export function MediaModal({ id, profileId, onClose }: { id: number; profileId: string; onClose: () => void }) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, boolean>>({});
  const [showVideo, setShowVideo] = useState(false);

  // Streaming State
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'started' | 'scraping' | 'downloading' | 'extracting' | 'converting' | 'ready' | 'error'>('idle');
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamVideoPath, setStreamVideoPath] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamMetadata, setStreamMetadata] = useState<{index: number, number: string | number, isSeason: boolean, episodeName: string} | null>(null);
  const [tmdbEpisodes, setTmdbEpisodes] = useState<any[]>([]);
  const [serverCache, setServerCache] = useState<Record<string, string>>({});
  const pollingInterval = useRef<any>(null);
  const plyrRef = useRef<any>(null);

  // Sync plyr time to supabase
  useEffect(() => {
    if (streamStatus === 'ready' && plyrRef.current?.plyr) {
      const player = plyrRef.current.plyr;
      const index = streamMetadata?.index;
      
      // Load previous time if exists
      if (index !== undefined) {
        const savedData: any = typeof episodeProgress[index] === 'object' ? episodeProgress[index] : { seen: !!episodeProgress[index], time: 0 };
        if (savedData.time && savedData.time > 5) {
          player.currentTime = savedData.time;
        }
      }

      // Save time every 10 seconds
      let lastSavedTime = player.currentTime;
      const onTimeUpdate = () => {
        if (index === undefined) return;
        const time = player.currentTime;
        if (Math.abs(time - lastSavedTime) > 10) {
          lastSavedTime = time;
          setEpisodeProgress(prev => {
            const prevData = typeof prev[index] === 'object' ? prev[index] : { seen: !!prev[index] };
            const newProgress = { ...prev, [index]: { ...prevData, time } };
            
            // Fire and forget save
            supabase.from('interactions').upsert({
              profile_id: profileId,
              media_id: id,
              episode_progress: newProgress,
              updated_at: new Date().toISOString()
            }, { onConflict: 'profile_id,media_id' }).then();
            
            return newProgress;
          });
        }
      };
      
      player.on('timeupdate', onTimeUpdate);
      return () => {
        if (player) player.off('timeupdate', onTimeUpdate);
      };
    }
  }, [streamStatus, streamMetadata]);

  const cleanTitleText = (rawTitle: string) => {
    return rawTitle
      .replace(/(Temporada|Season)\s*\d+/i, '')
      .replace(/\[.*?\]/g, '')
      .replace(/(MEDIAFIRE|MEGA|1080p|720p|4K|Latino|Ingles|Subtitulado|\.rar|\.zip|\.mkv|\.mp4)/gi, '')
      .replace(/[/\\?%*:|"<>]/g, '') // Remove invalid file chars
      .trim();
  };

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
        
        // Fetch TMDB Episodes
        const fetchTMDBData = async (title: string) => {
          const apiKey = '6880d99ba4f1cb396d71d0e364493702';
          // Extraer número de temporada (por defecto 1)
          let seasonNumber = 1;
          const seasonMatch = title.match(/Temporada\s*(\d+)/i);
          if (seasonMatch) seasonNumber = parseInt(seasonMatch[1]);
          
          const cleanTitle = cleanTitleText(title);
          
          try {
            const searchRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=es-MX&query=${encodeURIComponent(cleanTitle)}`);
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
              const showId = searchData.results[0].id;
              const seasonRes = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${apiKey}&language=es-MX`);
              const seasonData = await seasonRes.json();
              if (seasonData.episodes) {
                setTmdbEpisodes(seasonData.episodes);
              }
            }
          } catch (e) {
            console.error("TMDB Error", e);
          }
        };
        fetchTMDBData(mediaData.title);
        
        // Check which links are already cached on the server
        if (mediaData.links && mediaData.links.length > 0) {
          fetch('/api/check_cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: mediaData.links })
          })
          .then(r => r.json())
          .then(data => {
            if (data.cached_urls) {
              setServerCache(data.cached_urls);
            }
          })
          .catch(err => console.error("Cache check error:", err));
        }
      }

      // Fetch user interaction
      if (profileId) {
        const { data: interactionData } = await supabase
          .from('interactions')
          .select('*')
          .eq('profile_id', profileId)
          .eq('media_id', id)
          .maybeSingle();
          
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

  // Polling for stream status
  useEffect(() => {
    if (streamJobId && !['ready', 'error', 'idle'].includes(streamStatus)) {
      pollingInterval.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${streamJobId}`);
          if (res.ok) {
            const data = await res.json();
            setStreamStatus(data.status);
            if (data.progress !== undefined) setStreamProgress(data.progress);
            if (data.video_path) setStreamVideoPath(data.video_path);
            if (data.message) setStreamError(data.message);
            
            // If job succeeds, clear interval immediately
            if (data.status === 'ready' || data.status === 'error') {
              if (data.status === 'ready' && data.video_path) {
                setServerCache(prev => ({...prev, [streamJobId]: data.video_path})); // streamJobId is MD5, but cache uses URL. We need URL!
              }
              clearInterval(pollingInterval.current);
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
    }
    return () => clearInterval(pollingInterval.current);
  }, [streamJobId, streamStatus]);

  const startStream = async (url: string, index: number, displayNumber: string | number, isSeason: boolean, episodeName: string, e: React.MouseEvent) => {
    e.preventDefault();
    setStreamError(null);
    setStreamVideoPath(null);
    setStreamProgress(0);
    setStreamStatus('started');
    setStreamMetadata({ index, number: displayNumber, isSeason, episodeName });
    
    // Clear any previous job
    if (streamJobId) {
      await fetch(`/api/clean/${streamJobId}`, { method: 'DELETE' }).catch(() => {});
    }
    
    try {
      const res = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, password: item?.contrasena || '' })
      });
      if (!res.ok) throw new Error("Error al iniciar stream");
      const data = await res.json();
      
      if (data.status === 'ready') {
        setStreamStatus('ready');
        setStreamVideoPath(data.video_path || serverCache[url]);
        setStreamJobId(data.job_id);
      } else {
        setStreamJobId(data.job_id);
      }
    } catch (e: any) {
      setStreamStatus('error');
      setStreamError(e.message);
    }
  };

  const cleanStream = async () => {
    if (streamJobId) {
      await fetch(`/api/clean/${streamJobId}`, { method: 'DELETE' }).catch(() => {});
      setStreamJobId(null);
      setStreamStatus('idle');
      setStreamVideoPath(null);
    }
  };

  const toggleWatched = async () => {
    const newState = !isWatched;
    setIsWatched(newState);
    
    const { error } = await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: newState,
      rating: rating,
      episode_progress: episodeProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id,media_id' });
    if (error) console.error("Error toggling watched:", error);
  };

  const toggleEpisode = async (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const prevData = typeof episodeProgress[index] === 'object' ? episodeProgress[index] : { seen: !!episodeProgress[index] };
    const newProgress = { ...episodeProgress, [index]: { ...prevData, seen: !prevData.seen } };
    setEpisodeProgress(newProgress);

    const { error } = await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: isWatched,
      rating: rating,
      episode_progress: newProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id,media_id' });
    if (error) console.error("Error toggling episode:", error);
  };

  const handleRate = async (stars: number) => {
    setRating(stars);
    
    const { error } = await supabase.from('interactions').upsert({
      profile_id: profileId,
      media_id: id,
      is_in_list: isWatched,
      rating: stars,
      episode_progress: episodeProgress,
      updated_at: new Date().toISOString()
    }, { onConflict: 'profile_id,media_id' });
    if (error) console.error("Error rating:", error);
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
        <div className="relative w-full h-[50vh] md:h-[60vh] bg-black overflow-hidden flex flex-col justify-center items-center">
          
          {streamStatus !== 'idle' ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black relative z-10">
              {streamStatus === 'ready' && streamVideoPath ? (
                <div className="w-full h-full relative group plyr-container">
                  <Plyr 
                    ref={plyrRef}
                    source={{
                      type: 'video',
                      sources: [{ src: streamVideoPath, type: 'video/mp4' }]
                    }}
                    options={{
                      autoplay: true,
                      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen']
                    }}
                  />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={streamVideoPath} 
                      download={streamMetadata ? `${cleanTitleText(item.title)} - E${streamMetadata.number} ${streamMetadata.episodeName}.mp4` : 'video.mp4'}
                      className="bg-[#E50914] text-white px-4 py-2 rounded font-bold hover:bg-red-700 transition flex items-center gap-2 text-sm shadow-lg"
                    >
                      ⬇ Descargar a PC
                    </a>
                    <button 
                      onClick={cleanStream}
                      className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-700 transition flex items-center gap-2 text-sm border border-gray-600 shadow-lg"
                    >
                      🗑 Limpiar Servidor
                    </button>
                  </div>
                </div>
              ) : streamStatus === 'error' ? (
                <div className="text-center text-white">
                  <span className="text-4xl mb-4 block">⚠️</span>
                  <h3 className="text-xl font-bold mb-2">Error al preparar el video</h3>
                  <p className="text-gray-400">{streamError}</p>
                  <button onClick={() => setStreamStatus('idle')} className="mt-4 px-6 py-2 bg-gray-800 rounded text-white hover:bg-gray-700">Volver</button>
                </div>
              ) : (
                <div className="text-center text-white flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#E50914] border-opacity-50 mb-4"></div>
                  <h3 className="text-xl font-bold uppercase tracking-widest text-[#E50914]">
                    {streamStatus === 'started' && 'Iniciando...'}
                    {streamStatus === 'scraping' && 'Obteniendo enlace...'}
                    {streamStatus === 'downloading' && 'Descargando al servidor...'}
                    {streamStatus === 'extracting' && 'Extrayendo video...'}
                    {streamStatus === 'converting' && 'Optimizando audio para web...'}
                  </h3>
                  {streamStatus === 'downloading' && (
                    <div className="w-64 h-2 bg-gray-800 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: `${streamProgress}%` }}></div>
                    </div>
                  )}
                  {streamStatus === 'downloading' && <p className="text-sm mt-2 text-gray-400">{streamProgress}%</p>}
                </div>
              )}
            </div>
          ) : (
            <>
              {showVideo ? (
                 <div className="absolute inset-0 bg-black flex items-center justify-center text-gray-500 overflow-hidden">
                   <img 
                     src={item.poster} 
                     alt={item.title} 
                     className="w-full h-full object-cover scale-110 origin-center animate-ken-burns opacity-40 transform-gpu" 
                     onError={(e) => { e.currentTarget.style.display = 'none'; }}
                   />
                 </div>
              ) : (
                <img 
                  src={item.poster || 'https://via.placeholder.com/1920x1080?text=No+Poster'} 
                  alt={item.title}
                  className="w-full h-full object-cover opacity-80"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/1920x1080?text=No+Poster'; }}
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent pointer-events-none"></div>
              
              <div className="absolute bottom-6 left-10 right-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 drop-shadow-lg leading-tight w-3/4">
                  {item.title}
                </h1>
                <div className="flex items-center gap-3">
                  <button className="px-8 py-2 md:py-3 bg-white text-black font-bold rounded-md hover:bg-white/80 transition flex items-center gap-2 text-lg">
                    <span className="text-xl">▶</span> Ver Detalles
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
            </>
          )}
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
                    
                    // Intentar extraer el número real del capítulo desde la URL
                    let displayNumber: string | number = index + 1;
                    const match = link.match(/(?:_|-|\.|episodio|cap|capitulo)\s*0*(\d+)(?:\.rar|\.zip|\.mp4|\.mkv|\.avi|\/|$)/i);
                    if (match && match[1] && parseInt(match[1]) > index) {
                      displayNumber = match[1];
                    }
                    
                    const tmdbEpisode = tmdbEpisodes.find(e => e.episode_number == displayNumber);
                    const episodeName = tmdbEpisode ? tmdbEpisode.name : (isSeason ? `Temporada o Pack ${displayNumber}` : `Episodio ${displayNumber}`);
                    
                    const isCached = !!serverCache[link];
                    
                    const progressData = typeof episodeProgress[index] === 'object' ? episodeProgress[index] : { seen: !!episodeProgress[index] };
                    const isSeen = progressData.seen;

                    return (
                    <div key={index} className="flex flex-col mb-4">
                      <div className="flex gap-2 items-center group">
                        <button 
                          onClick={(e) => toggleEpisode(index, e)}
                          className={`w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center transition-colors flex-shrink-0 ${isSeen ? 'bg-green-600 border-green-500 text-white' : 'hover:border-white text-transparent hover:text-white'}`}
                          title={isSeen ? "Marcar como no visto" : "Marcar como visto"}
                        >
                          ✓
                        </button>
                        <button 
                          onClick={(e) => startStream(link, index, displayNumber, isSeason, episodeName, e)}
                          className={`flex-1 flex justify-between items-center p-4 bg-[#2f2f2f] hover:bg-[#404040] rounded-md transition-colors ${isSeen ? 'opacity-50' : ''} text-gray-200 text-left`}
                        >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-light text-gray-500 group-hover:text-white transition-colors min-w-[2rem] text-center">{displayNumber}</span>
                          <div>
                            <p className="font-bold text-white text-sm flex items-center gap-2">
                              {episodeName}
                              {isCached ? (
                                <span className="bg-green-600 text-xs px-2 py-0.5 rounded text-white font-bold ml-2 flex items-center gap-1">
                                  ⚡ Listo
                                </span>
                              ) : (
                                <span className="bg-[#E50914] text-xs px-2 py-0.5 rounded text-white font-bold ml-2">
                                  ▶ Play
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px] md:max-w-xs">{link}</p>
                          </div>
                        </div>
                      </button>
                      </div>
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
