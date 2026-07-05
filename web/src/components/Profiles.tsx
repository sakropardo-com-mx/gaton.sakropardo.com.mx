export function Profiles({ onSelectProfile }: { onSelectProfile: (name: string, avatar: string) => void }) {
  const profiles = [
    { name: "Usuario", avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" },
    { name: "Niños", avatar: "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-vnl1thqhqcgvq4ru.jpg" },
    { name: "Invitado", avatar: "https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-qo9h82134t9nv0j0.jpg" }
  ];

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center font-sans">
      <h1 className="text-white text-3xl md:text-5xl font-medium mb-8">¿Quién está viendo ahora?</h1>
      
      <div className="flex gap-4 md:gap-8 flex-wrap justify-center">
        {profiles.map((p, idx) => (
          <div 
            key={idx} 
            className="flex flex-col items-center group cursor-pointer"
            onClick={() => onSelectProfile(p.name, p.avatar)}
          >
            <div className="w-24 h-24 md:w-36 md:h-36 rounded-md overflow-hidden border-2 border-transparent group-hover:border-white transition-all">
              <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
            </div>
            <span className="text-gray-400 mt-4 group-hover:text-white transition-colors">{p.name}</span>
          </div>
        ))}
        
        <div className="flex flex-col items-center group cursor-pointer">
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-md border-2 border-transparent group-hover:border-white transition-all flex items-center justify-center group-hover:bg-gray-800">
            <span className="text-gray-400 text-5xl group-hover:text-white">+</span>
          </div>
          <span className="text-gray-400 mt-4 group-hover:text-white transition-colors">Agregar perfil</span>
        </div>
      </div>
      
      <button className="mt-16 border border-gray-500 text-gray-500 hover:border-white hover:text-white px-6 py-2 uppercase tracking-widest text-sm transition-colors">
        Administrar perfiles
      </button>
    </div>
  );
}
