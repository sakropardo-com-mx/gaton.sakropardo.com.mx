import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const DEFAULT_AVATARS = [
  "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png",
  "https://mir-s3-cdn-cf.behance.net/project_modules/disp/366be133850498.56ba69ac36858.png",
  "https://mir-s3-cdn-cf.behance.net/project_modules/disp/84c20033850498.56ba69ac290ea.png",
  "https://mir-s3-cdn-cf.behance.net/project_modules/disp/64623a33850498.56ba69ac2a6f7.png",
  "https://mir-s3-cdn-cf.behance.net/project_modules/disp/1bdc9a33850498.56ba69ac2ba5b.png"
];

export function Profiles({ onSelectProfile, userId }: { onSelectProfile: (name: string, avatar: string) => void, userId: string }) {
  const [profiles, setProfiles] = useState<{name: string, avatar: string}[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfiles() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
        
      if (data && data.length > 0) {
        setProfiles(data);
      } else {
        // If no profiles, user can create one.
        setProfiles([]);
      }
      setLoading(false);
    }
    fetchProfiles();
  }, [userId]);

  const handleSaveProfile = async () => {
    if (newName.trim() === "") return;
    
    // Save to Supabase
    const { data } = await supabase
      .from('profiles')
      .insert([
        { user_id: userId, name: newName, avatar: selectedAvatar }
      ])
      .select();
      
    if (data) {
      setProfiles([...profiles, data[0]]);
      setIsAdding(false);
      setNewName("");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#141414] flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#E50914] border-opacity-50"></div></div>;

  if (isAdding) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center font-sans text-white p-4">
        <h1 className="text-4xl md:text-5xl font-medium mb-10">Agregar perfil</h1>
        
        <div className="flex flex-col md:flex-row items-center gap-8 bg-[#1f1f1f] p-8 rounded-lg">
          <div className="flex flex-col gap-4 items-center">
            <div className="w-32 h-32 rounded-md overflow-hidden border-2 border-white">
              <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            
            <div className="flex gap-2 mt-4">
              {DEFAULT_AVATARS.map((ava, i) => (
                <img 
                  key={i} 
                  src={ava} 
                  alt="avatar_option"
                  className={`w-10 h-10 rounded-sm cursor-pointer border-2 transition-all ${selectedAvatar === ava ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  onClick={() => setSelectedAvatar(ava)}
                />
              ))}
            </div>
          </div>
          
          <div className="flex flex-col w-full md:w-64">
            <input 
              type="text" 
              placeholder="Nombre" 
              className="bg-[#333] text-white px-4 py-3 rounded-sm w-full outline-none focus:bg-[#444] text-lg mb-8"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
            />
            
            <div className="flex gap-4">
              <button 
                onClick={handleSaveProfile}
                className="bg-white text-black font-bold px-6 py-2 flex-1 hover:bg-gray-200 transition-colors"
              >
                Continuar
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="border border-gray-500 text-gray-400 font-bold px-6 py-2 flex-1 hover:text-white hover:border-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center font-sans">
      <h1 className="text-white text-3xl md:text-5xl font-medium mb-12 drop-shadow-md">¿Quién está viendo ahora?</h1>
      
      <div className="flex gap-6 md:gap-10 flex-wrap justify-center">
        {profiles.map((p, idx) => (
          <div 
            key={idx} 
            className="flex flex-col items-center group cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.1}s` }}
            onClick={() => onSelectProfile(p.name, p.avatar)}
          >
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-md overflow-hidden border-2 border-transparent group-hover:border-white transition-all transform group-hover:scale-105 shadow-xl">
              <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
            </div>
            <span className="text-gray-400 mt-4 text-xl group-hover:text-white transition-colors">{p.name}</span>
          </div>
        ))}
        
        {profiles.length < 5 && (
          <div 
            className="flex flex-col items-center group cursor-pointer animate-fade-in-up" 
            style={{ animationDelay: `${profiles.length * 0.1}s` }}
            onClick={() => setIsAdding(true)}
          >
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-md border-2 border-transparent group-hover:border-white group-hover:bg-gray-800 transition-all flex items-center justify-center transform group-hover:scale-105">
              <span className="text-gray-400 text-6xl group-hover:text-white transition-colors">+</span>
            </div>
            <span className="text-gray-400 mt-4 text-xl group-hover:text-white transition-colors">Agregar perfil</span>
          </div>
        )}
      </div>
      
      <button 
        onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('netflix_profile'); }}
        className="mt-20 border border-gray-500 text-gray-400 hover:border-white hover:text-white px-8 py-2 uppercase tracking-widest text-lg transition-colors"
      >
        Cerrar sesión
      </button>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
