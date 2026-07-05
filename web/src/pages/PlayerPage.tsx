import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
// @ts-ignore
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';

export function PlayerPage({ activeProfile }: { activeProfile: any }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;

  if (!state || !state.link) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-4">Error: No se proporcionó enlace.</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#E50914] rounded font-bold hover:bg-red-700">Volver</button>
      </div>
    );
  }

  const { link, index, password, episodeName, cachedUrl, allEpisodes } = state;
  const profileId = activeProfile.id;

  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'started' | 'scraping' | 'downloading' | 'extracting' | 'converting' | 'ready' | 'error'>('idle');
  const [streamVideoPath, setStreamVideoPath] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const episodeProgressRef = useRef<Record<string, any>>({});
  
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);

  // Background downloads queue
  const [downloadQueue, setDownloadQueue] = useState<Record<number, { job_id: string, progress: number, status: string }>>({});
  const [localCache, setLocalCache] = useState<Record<number, boolean>>({});

  const pollingInterval = useRef<any>(null);
  const plyrRef = useRef<any>(null);
  const hasSeekedInitialRef = useRef<Record<number, boolean>>({});

  const plyrSource = useMemo(() => ({
    type: 'video',
    sources: [{ src: streamVideoPath || '', type: 'video/mp4' }]
  }), [streamVideoPath]);

  const plyrOptions = useMemo(() => ({
    autoplay: true, 
    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen']
  }), []);

  // 1. Fetch initial progress and init cache
  useEffect(() => {
    const fetchProgress = async () => {
      const { data } = await supabase.from('interactions').select('episode_progress').eq('profile_id', profileId).eq('media_id', id).maybeSingle();
      if (data && data.episode_progress) {
        episodeProgressRef.current = data.episode_progress;
      }
    };
    fetchProgress();
  }, [id, profileId]);

  useEffect(() => {
    if (allEpisodes) {
      const initialCache: Record<number, boolean> = {};
      allEpisodes.forEach((ep: any) => {
        if (ep.isCached) initialCache[ep.index] = true;
      });
      setLocalCache(initialCache);
    }
  }, [allEpisodes]);

  // 2. Start stream on mount or link change
  useEffect(() => {
    setStreamJobId(null);
    setStreamVideoPath(null);
    setStreamError(null);
    setStreamProgress(0);

    const start = async () => {
      // If it's cached from previous page, just start it.
      if (cachedUrl) {
        setStreamStatus('ready');
        setStreamVideoPath(cachedUrl);
        setLocalCache(prev => ({...prev, [index]: true}));
        return;
      }

      setStreamStatus('started');
      try {
        const res = await fetch('/api/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link, password: password || '' })
        });
        if (!res.ok) throw new Error("Error al iniciar stream");
        const data = await res.json();
        
        if (data.status === 'ready') {
          setStreamStatus('ready');
          setStreamVideoPath(data.video_path);
          setLocalCache(prev => ({...prev, [index]: true}));
        } else {
          setStreamJobId(data.job_id);
        }
      } catch (e: any) {
        setStreamStatus('error');
        setStreamError(e.message);
      }
    };
    start();
  }, [link, password, cachedUrl, index]);

  // 3. Poll status for current stream
  useEffect(() => {
    if (streamJobId && streamStatus !== 'ready' && streamStatus !== 'error') {
      pollingInterval.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${streamJobId}`);
          if (res.ok) {
            const data = await res.json();
            setStreamStatus(data.status);
            if (data.progress) setStreamProgress(data.progress);
            if (data.video_path) setStreamVideoPath(data.video_path);
            if (data.message) setStreamError(data.message);
            if (data.status === 'ready') {
              setLocalCache(prev => ({...prev, [index]: true}));
            }
            if (data.status === 'ready' || data.status === 'error') clearInterval(pollingInterval.current);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    return () => clearInterval(pollingInterval.current);
  }, [streamJobId, streamStatus, index]);

  // Background queue polling
  useEffect(() => {
    const activeJobs = Object.entries(downloadQueue).filter(([_, job]) => job.status !== 'ready' && job.status !== 'error');
    if (activeJobs.length > 0) {
      const interval = setInterval(() => {
        activeJobs.forEach(async ([epIndexStr, job]) => {
          const epIndex = parseInt(epIndexStr);
          try {
            const res = await fetch(`/api/status/${job.job_id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'ready') {
                setLocalCache(prev => ({ ...prev, [epIndex]: true }));
                setDownloadQueue(prev => { const q = {...prev}; delete q[epIndex]; return q; });
              } else if (data.status === 'error') {
                setDownloadQueue(prev => { const q = {...prev}; delete q[epIndex]; return q; });
              } else {
                setDownloadQueue(prev => ({ ...prev, [epIndex]: { ...prev[epIndex], status: data.status, progress: data.progress || 0 } }));
              }
            }
          } catch (e) {
            console.error(e);
          }
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [downloadQueue]);

  const startBackgroundDownload = async (ep: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ep.link, password: password || '' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ready') {
          setLocalCache(prev => ({ ...prev, [ep.index]: true }));
        } else if (data.job_id) {
          setDownloadQueue(prev => ({ ...prev, [ep.index]: { job_id: data.job_id, status: data.status, progress: 0 } }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Plyr sync and Autoplay
  useEffect(() => {
    if (streamStatus === 'ready' && plyrRef.current?.plyr) {
      const player = plyrRef.current.plyr;
      
      const currentProgs = episodeProgressRef.current;
      const savedData = typeof currentProgs[index] === 'object' ? currentProgs[index] : { seen: !!currentProgs[index], time: 0 };
      if (!hasSeekedInitialRef.current[index] && savedData.time && savedData.time > 5) {
        player.currentTime = savedData.time;
        hasSeekedInitialRef.current[index] = true;
      }

      let lastSavedTime = player.currentTime;
      const onTimeUpdate = () => {
        const time = player.currentTime;
        if (Math.abs(time - lastSavedTime) > 10) {
          lastSavedTime = time;
          const currentData = typeof episodeProgressRef.current[index] === 'object' ? episodeProgressRef.current[index] : { seen: !!episodeProgressRef.current[index] };
          const newProgress = { ...episodeProgressRef.current, [index]: { ...currentData, time, seen: true } };
          episodeProgressRef.current = newProgress;
          supabase.from('interactions').upsert({ profile_id: profileId, media_id: id, episode_progress: newProgress, updated_at: new Date().toISOString() }, { onConflict: 'profile_id,media_id' }).then();
        }
      };

      const onEnded = () => {
        if (autoplayNext && allEpisodes && index < allEpisodes.length - 1) {
          playEpisode(allEpisodes[index + 1]);
        }
      };
      
      // Fix for "player.on is not a function" error
      if (typeof player.on === 'function') {
        player.on('timeupdate', onTimeUpdate);
        player.on('ended', onEnded);
      } else if (typeof player.addEventListener === 'function') {
        player.addEventListener('timeupdate', onTimeUpdate);
        player.addEventListener('ended', onEnded);
      }
      
      return () => {
        if (typeof player.off === 'function') {
          player.off('timeupdate', onTimeUpdate);
          player.off('ended', onEnded);
        } else if (typeof player.removeEventListener === 'function') {
          player.removeEventListener('timeupdate', onTimeUpdate);
          player.removeEventListener('ended', onEnded);
        }
      };
    }
  }, [streamStatus, index, profileId, id, autoplayNext, allEpisodes]);

  const playEpisode = (ep: any) => {
    navigate(`/play/${id}`, {
      replace: true,
      state: {
        ...state,
        link: ep.link,
        index: ep.index,
        episodeName: ep.episodeName,
        cachedUrl: localCache[ep.index] ? (ep.cachedUrl || null) : null
      }
    });
    setShowEpisodesList(false);
  };

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col font-sans">
       {/* Top Bar Overlay */}
       <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
         <button onClick={() => navigate(-1)} className="text-white text-xl bg-black/50 hover:bg-[#E50914] p-3 px-6 rounded font-bold transition-colors pointer-events-auto flex items-center gap-2">
            ← Volver a {episodeName}
         </button>

         {allEpisodes && allEpisodes.length > 0 && (
           <button onClick={() => setShowEpisodesList(!showEpisodesList)} className="text-white text-lg bg-black/50 hover:bg-gray-800 p-3 px-6 rounded font-bold transition-colors pointer-events-auto flex items-center gap-2 shadow-lg">
              Episodios ☰
           </button>
         )}
       </div>

       {/* Episodes Sidebar */}
       {showEpisodesList && (
         <div className="absolute top-0 right-0 bottom-0 w-80 md:w-[450px] bg-[#181818]/95 backdrop-blur-md z-[60] shadow-2xl flex flex-col animate-slide-in-right">
           <div className="p-6 flex justify-between items-center border-b border-gray-700">
             <h3 className="text-white text-xl font-bold">Episodios</h3>
             <button onClick={() => setShowEpisodesList(false)} className="text-gray-400 hover:text-white text-2xl font-bold">✕</button>
           </div>
           
           <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-black/20">
             <span className="text-gray-300 text-sm font-bold">Autoreproducir Siguiente</span>
             <label className="relative inline-flex items-center cursor-pointer">
               <input type="checkbox" className="sr-only peer" checked={autoplayNext} onChange={() => setAutoplayNext(!autoplayNext)} />
               <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E50914]"></div>
             </label>
           </div>

           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
             {allEpisodes?.map((ep: any) => {
               const isCurrent = ep.index === index;
               const currentProgs = episodeProgressRef.current;
               const epProg = typeof currentProgs[ep.index] === 'object' ? currentProgs[ep.index] : { seen: !!currentProgs[ep.index] };
               const isSeen = epProg.seen;
               const isCachedLocally = localCache[ep.index];
               const dlJob = downloadQueue[ep.index];

               return (
                 <div 
                   key={ep.index} 
                   onClick={() => !isCurrent && playEpisode(ep)}
                   className={`p-4 rounded-lg flex items-center gap-4 transition-all cursor-pointer ${isCurrent ? 'bg-[#E50914]/20 border border-[#E50914]' : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent'}`}
                 >
                   <span className={`text-2xl font-light w-8 text-center ${isCurrent ? 'text-[#E50914]' : 'text-gray-500'}`}>{ep.displayNumber}</span>
                   <div className="flex-1">
                     <p className={`font-bold text-sm flex items-center gap-2 ${isCurrent ? 'text-white' : 'text-gray-200'}`}>
                       {ep.episodeName}
                     </p>
                     <div className="flex gap-2 mt-2 items-center flex-wrap">
                       {isCachedLocally && !isCurrent && <span className="bg-green-600/30 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-bold">⚡ Listo</span>}
                       {isSeen && !isCurrent && <span className="bg-blue-600/30 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-bold">✓ Visto</span>}
                       {isCurrent && <span className="text-[#E50914] text-xs font-bold">Reproduciendo</span>}

                       {!isCurrent && !isCachedLocally && !dlJob && (
                          <button onClick={(e) => startBackgroundDownload(ep, e)} className="bg-gray-700 hover:bg-gray-600 text-white text-[10px] px-2 py-1 rounded font-bold ml-auto transition-colors shadow-lg">
                            ⬇ Descargar al Servidor
                          </button>
                       )}
                       {!isCurrent && !isCachedLocally && dlJob && (
                          <div className="ml-auto flex items-center gap-2 bg-black/40 px-2 py-1 rounded">
                            <span className="text-gray-300 text-[10px] font-bold">{dlJob.progress}%</span>
                            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                               <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: `${dlJob.progress}%` }}></div>
                            </div>
                          </div>
                       )}
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       )}
       
       {/* Fullscreen Player UI */}
       <div className="flex-1 flex items-center justify-center relative w-full h-full">
          {streamStatus === 'ready' && streamVideoPath ? (
             <div className="w-full h-full relative group plyr-container">
                <Plyr 
                  ref={plyrRef} 
                  source={plyrSource as any} 
                  options={plyrOptions as any} 
                />
             </div>
          ) : streamStatus === 'error' ? (
             <div className="text-center text-white">
                <span className="text-6xl block mb-4">⚠️</span>
                <h3 className="text-2xl font-bold">Error al procesar el video</h3>
                <p className="text-gray-400 mt-2">{streamError}</p>
             </div>
          ) : (
             <div className="text-center text-white flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#E50914] border-opacity-50 mb-6"></div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-[#E50914]">
                   {streamStatus === 'started' && 'Conectando al servidor...'}
                   {streamStatus === 'scraping' && 'Resolviendo enlace seguro...'}
                   {streamStatus === 'downloading' && 'Acelerando descarga P2P...'}
                   {streamStatus === 'extracting' && 'Desempaquetando archivo...'}
                   {streamStatus === 'converting' && 'Sincronizando pistas de audio...'}
                </h2>
                {streamStatus === 'downloading' && (
                  <div className="w-96 h-2 bg-gray-800 rounded-full mt-6 overflow-hidden relative">
                    <div className="absolute inset-0 bg-[#E50914]/20 animate-pulse"></div>
                    <div className="h-full bg-[#E50914] transition-all duration-300 relative z-10" style={{ width: `${streamProgress}%` }}></div>
                  </div>
                )}
             </div>
          )}
       </div>
       <style>{`
         .plyr-container .plyr {
           height: 100%;
           width: 100%;
         }
         .plyr-container .plyr__video-wrapper {
           height: 100%;
           width: 100%;
           display: flex;
           align-items: center;
           justify-content: center;
           background: black;
         }
         .plyr-container video {
           height: 100% !important;
           width: 100% !important;
           object-fit: contain;
         }
         
         .custom-scrollbar::-webkit-scrollbar { width: 6px; }
         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
         .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 10px; }
         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #606060; }
         
         @keyframes slideInRight {
           from { transform: translateX(100%); }
           to { transform: translateX(0); }
         }
         .animate-slide-in-right {
           animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
         }
       `}</style>
    </div>
  );
}
