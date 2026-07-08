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
  const [streamMultipleVideos, setStreamMultipleVideos] = useState<any[] | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const episodeProgressRef = useRef<Record<string, any>>({});
  
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [autoplayNext, setAutoplayNext] = useState(true);

  // Background downloads queue
  const [downloadQueue, setDownloadQueue] = useState<Record<number, { job_id: string, progress: number, status: string }>>({});
  const [localCache, setLocalCache] = useState<Record<number, boolean>>({});

  const pollingInterval = useRef<any>(null);

  // Auto-hide top bar
  const [isMouseIdle, setIsMouseIdle] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState<Record<string, boolean>>({});
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMouseMove = () => {
      setIsMouseIdle(false);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
      mouseTimeoutRef.current = setTimeout(() => {
        setIsMouseIdle(true);
      }, 3000);
    };

    // Initial timeout
    handleMouseMove();

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, []);

  // Plyr is no longer used, as we stream directly to MPC-HC.

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

      // Verify cache with backend in case of page reload
      const verifyCache = async () => {
        try {
          const urls = allEpisodes.map((ep: any) => ep.link);
          const res = await fetch('/api/check_cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
          });
          if (res.ok) {
            const data = await res.json();
            const newCache: Record<number, boolean> = {};
            allEpisodes.forEach((ep: any) => {
              if (data.cached_urls[ep.link]) {
                newCache[ep.index] = true;
              }
            });
            setLocalCache(prev => ({ ...prev, ...newCache }));
          }
        } catch (e) {
          console.error('Error verifying cache:', e);
        }
      };
      verifyCache();
    }
  }, [allEpisodes]);

  // 2. Start stream on mount or link change
  useEffect(() => {
    setStreamJobId(null);
    setStreamVideoPath(null);
    setStreamError(null);
    setStreamProgress(0);

    const start = async () => {
      // Always fetch from /api/prepare to get the full payload (including multiple_videos)
      // even if cached, because check_cache only returned the string path.

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
          if (data.multiple_videos) setStreamMultipleVideos(data.multiple_videos);
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
            if (data.multiple_videos) setStreamMultipleVideos(data.multiple_videos);
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

  // 4. Progress Tracking & Direct Download
  const recordProgressAndDownload = (videoPath: string, videoName: string) => {
    const currentProgs = episodeProgressRef.current;
    const currentData = typeof currentProgs[index] === 'object' ? currentProgs[index] : { seen: !!currentProgs[index] };
    const newProgress = { ...currentProgs, [index]: { ...currentData, seen: true, time: 10 } };
    episodeProgressRef.current = newProgress;
    
    supabase.from('interactions').upsert({ 
      profile_id: profileId, 
      media_id: id, 
      episode_progress: newProgress, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'profile_id,media_id' }).then();
    
    // Mark as downloaded in UI
    setDownloadedFiles(prev => ({ ...prev, [videoName]: true }));

    // Construct precise TMDB name
    const baseName = mediaDetails?.title || mediaDetails?.name || "GatonPlay";
    const extension = videoName.split('.').pop() || 'mkv';
    
    // Si tiene temporada/capítulo (ej. S01E02), extraerlo para que el archivo quede limpio
    let finalFileName = `${baseName} - ${videoName}`;
    const match = videoName.match(/(?:S0*(\d+)[Ex]0*(\d+))|(?:0*(\d+)\.0*(\d+))/i);
    if (match) {
        const season = match[1] || match[3];
        const ep = match[2] || match[4];
        finalFileName = `${baseName} - S${season.padStart(2, '0')}E${ep.padStart(2, '0')}.${extension}`;
    }

    const streamUrl = `${window.location.origin}${encodeURI(videoPath)}`;
    
    // Trigger direct download
    const a = document.createElement('a');
    a.href = streamUrl;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const groupedVideos = useMemo(() => {
    if (!streamMultipleVideos || streamMultipleVideos.length <= 1) return null;
    const groups: Record<string, any[]> = {};
    let hasSeasons = false;
    
    streamMultipleVideos.forEach(vid => {
      // Matches: 1.1, 01.02, S01E02, S1 E2, etc.
      const match = vid.name.match(/(?:S0*(\d+)[Ex]0*(\d+))|(?:0*(\d+)\.0*(\d+))/i);
      if (match) {
        hasSeasons = true;
        const season = match[1] || match[3];
        const ep = match[2] || match[4];
        const groupName = `Temporada ${season}`;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push({ ...vid, cleanName: `Episodio ${ep} (${vid.name})` });
      } else {
        if (!groups['Otros Extras']) groups['Otros Extras'] = [];
        groups['Otros Extras'].push({ ...vid, cleanName: vid.name });
      }
    });
    
    if (!hasSeasons) return null;
    return groups;
  }, [streamMultipleVideos]);

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
       <div className={`absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none transition-opacity duration-500 ${isMouseIdle && streamStatus === 'ready' && !showEpisodesList ? 'opacity-0' : 'opacity-100'}`}>
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
          <div key={streamVideoPath || 'loading-state'} className="w-full h-full flex items-center justify-center">
            {streamStatus === 'ready' && stream                <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
                  <div className="bg-[#181818] border border-gray-700 p-10 rounded-2xl shadow-2xl flex flex-col items-center max-w-lg text-center">
                    <span className="text-7xl block mb-6 drop-shadow-lg">📥</span>
                    <h3 className="text-3xl font-bold mb-2">Listo para Descargar</h3>
                    <p className="text-gray-400 mb-8 text-sm">Debido al gran tamaño de este formato (MKV 4K/1080p), la descarga directa a tu PC garantiza cero lag y máxima calidad visual.</p>
                    
                    {streamMultipleVideos && streamMultipleVideos.length > 1 ? (
                      <div className="w-full flex flex-col gap-3 mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                        {groupedVideos ? (
                          <>
                            <span className="text-yellow-500 font-bold text-sm mb-2 text-left">Este paquete está estructurado por temporadas:</span>
                            {Object.entries(groupedVideos).map(([seasonName, videos]) => (
                              <div key={seasonName} className="mb-4">
                                <h4 className="text-white font-bold text-lg mb-2 text-left border-b border-gray-600 pb-1">{seasonName}</h4>
                                <div className="flex flex-col gap-2">
                                  {videos.map((vid: any, i: number) => {
                                    const isDownloaded = downloadedFiles[vid.name];
                                    return (
                                      <button 
                                        key={i}
                                        onClick={() => recordProgressAndDownload(vid.path, vid.name)}
                                        className={`w-full py-2 font-bold rounded shadow transition-all text-xs truncate px-4 text-left flex justify-between items-center ${isDownloaded ? 'bg-gray-700 text-gray-300' : 'bg-[#E50914] text-white hover:bg-red-700 hover:scale-[1.02]'}`}
                                      >
                                        <span>{isDownloaded ? '✅ Descargando / Abierto' : `📥 Descargar ${vid.cleanName}`}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            <span className="text-yellow-500 font-bold text-sm mb-2 text-left">Este paquete contiene {streamMultipleVideos.length} capítulos:</span>
                            {streamMultipleVideos.map((vid: any, i: number) => {
                              const isDownloaded = downloadedFiles[vid.name];
                              return (
                                <button 
                                  key={i}
                                  onClick={() => recordProgressAndDownload(vid.path, vid.name)}
                                  className={`w-full py-3 font-bold rounded shadow-lg transition-all text-sm truncate px-4 ${isDownloaded ? 'bg-gray-700 text-gray-300' : 'bg-[#E50914] text-white hover:bg-red-700 hover:scale-[1.02]'}`}
                                >
                                  {isDownloaded ? '✅ Archivo Abierto (Descargando)' : `📥 Descargar ${vid.name}`}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => recordProgressAndDownload(streamVideoPath || '', `Episodio_${index+1}`)}
                        className={`w-full py-4 font-bold text-xl rounded shadow-lg transition-all mb-4 ${downloadedFiles[`Episodio_${index+1}`] ? 'bg-gray-700 text-gray-300' : 'bg-[#E50914] text-white hover:bg-red-700 hover:scale-[1.02]'}`}
                      >
                        {downloadedFiles[`Episodio_${index+1}`] ? '✅ Descarga Iniciada' : '📥 Descargar Capítulo Nativo'}
                      </button>
                    )}
                    
                    <p className="text-gray-500 text-xs mt-2">
                      El archivo se descargará con el nombre de <code className="text-gray-400 bg-black px-1 py-0.5 rounded">{mediaDetails?.title || mediaDetails?.name}</code>. Podrás abrirlo en tu PC sin esperas.
                    </p>
                  </div>
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
