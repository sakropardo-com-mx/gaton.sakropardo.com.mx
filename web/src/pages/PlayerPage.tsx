import { useEffect, useState, useRef } from 'react';
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

  const { link, index, password, episodeName, cachedUrl } = state;
  const profileId = activeProfile.id;

  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'started' | 'scraping' | 'downloading' | 'extracting' | 'converting' | 'ready' | 'error'>('idle');
  const [streamVideoPath, setStreamVideoPath] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const episodeProgressRef = useRef<Record<string, any>>({});
  
  const pollingInterval = useRef<any>(null);
  const plyrRef = useRef<any>(null);

  // 1. Fetch initial progress
  useEffect(() => {
    const fetchProgress = async () => {
      const { data } = await supabase.from('interactions').select('episode_progress').eq('profile_id', profileId).eq('media_id', id).maybeSingle();
      if (data && data.episode_progress) {
        episodeProgressRef.current = data.episode_progress;
      }
    };
    fetchProgress();
  }, [id, profileId]);

  // 2. Start stream on mount
  useEffect(() => {
    const start = async () => {
      if (cachedUrl) {
        setStreamStatus('ready');
        setStreamVideoPath(cachedUrl);
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
        } else {
          setStreamJobId(data.job_id);
        }
      } catch (e: any) {
        setStreamStatus('error');
        setStreamError(e.message);
      }
    };
    start();
  }, [link, password, cachedUrl]);

  // 3. Poll status
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
            if (data.status === 'ready' || data.status === 'error') clearInterval(pollingInterval.current);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    return () => clearInterval(pollingInterval.current);
  }, [streamJobId, streamStatus]);

  // 4. Plyr sync
  useEffect(() => {
    if (streamStatus === 'ready' && plyrRef.current?.plyr) {
      const player = plyrRef.current.plyr;
      
      const currentProgs = episodeProgressRef.current;
      const savedData = typeof currentProgs[index] === 'object' ? currentProgs[index] : { seen: !!currentProgs[index], time: 0 };
      if (savedData.time && savedData.time > 5) {
        player.currentTime = savedData.time;
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
      
      // Fix for "player.on is not a function" error
      if (typeof player.on === 'function') {
        player.on('timeupdate', onTimeUpdate);
      } else if (typeof player.addEventListener === 'function') {
        player.addEventListener('timeupdate', onTimeUpdate);
      }
      
      return () => {
        if (typeof player.off === 'function') player.off('timeupdate', onTimeUpdate);
        else if (typeof player.removeEventListener === 'function') player.removeEventListener('timeupdate', onTimeUpdate);
      };
    }
  }, [streamStatus, index, profileId, id]);

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col">
       {/* Top Bar Overlay */}
       <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
         <button onClick={() => navigate(-1)} className="text-white text-xl bg-black/50 hover:bg-[#E50914] p-3 px-6 rounded font-bold transition-colors pointer-events-auto flex items-center gap-2">
            ← Volver a {episodeName}
         </button>
       </div>
       
       {/* Fullscreen Player UI */}
       <div className="flex-1 flex items-center justify-center relative w-full h-full">
          {streamStatus === 'ready' && streamVideoPath ? (
             <div className="w-full h-full relative group plyr-container">
                <Plyr 
                  ref={plyrRef} 
                  source={{ type: 'video', sources: [{ src: streamVideoPath, type: 'video/mp4' }] }} 
                  options={{ 
                    autoplay: true, 
                    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'] 
                  }} 
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
                   {streamStatus === 'started' && 'Iniciando conexión...'}
                   {streamStatus === 'scraping' && 'Obteniendo enlace directo...'}
                   {streamStatus === 'downloading' && 'Descargando al servidor...'}
                   {streamStatus === 'extracting' && 'Extrayendo archivo...'}
                   {streamStatus === 'converting' && 'Optimizando formato...'}
                </h2>
                {streamStatus === 'downloading' && (
                  <div className="w-96 h-2 bg-gray-800 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-[#E50914] transition-all duration-300" style={{ width: `${streamProgress}%` }}></div>
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
       `}</style>
    </div>
  );
}
