import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export function Details() {
  const { id } = useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  return (
    <div className="min-h-screen p-4 md:p-10 max-w-6xl mx-auto font-sans">
      <Link to="/" className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors group">
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">&larr;</span> Volver al Catálogo
      </Link>

      <div className="bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col md:flex-row">
        {/* Poster Section */}
        <div className="w-full md:w-1/3 relative bg-slate-900">
          <img 
            src={item.poster || 'https://via.placeholder.com/400x600?text=No+Poster'} 
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80 md:hidden"></div>
        </div>

        {/* Content Section */}
        <div className="w-full md:w-2/3 p-8 md:p-12 flex flex-col">
          <div className="flex-grow">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
              {item.title}
            </h1>
            
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-gray-300 mb-8">
              {item.date && (
                <span className="px-3 py-1 bg-slate-700 rounded-full border border-slate-600">
                  📅 Año: {item.date}
                </span>
              )}
              {item.duration && (
                <span className="px-3 py-1 bg-slate-700 rounded-full border border-slate-600">
                  ⏱ {item.duration}
                </span>
              )}
            </div>

            <div className="mb-10">
              <h3 className="text-xl font-bold text-purple-400 mb-3">Sinopsis</h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                {item.sinopsis || "No hay sinopsis disponible para este título."}
              </p>
            </div>
          </div>

          {/* Links Section */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span>📥</span> Enlaces de Descarga
            </h3>
            
            {item.links && item.links.length > 0 ? (
              <div className="flex flex-col gap-3">
                {item.links.map((link: string, index: number) => (
                  <a 
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-slate-800 rounded-lg hover:bg-purple-900/40 border border-slate-700 hover:border-purple-500 transition-all text-gray-300 hover:text-white text-sm break-all"
                  >
                    <span className="font-bold text-purple-400 mr-2">[{index + 1}]</span>
                    {link}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 italic mb-4">No se encontraron enlaces directos extraídos.</p>
            )}

            {item.url && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <a 
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-bold text-white shadow-lg transition-all"
                >
                  Visitar Post Original
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
