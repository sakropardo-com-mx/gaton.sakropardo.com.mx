import { useState } from 'react';
import { supabase } from '../supabase';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Revisa tu correo para confirmar tu cuenta.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 opacity-50">
        <img 
          src="https://assets.nflxext.com/ffe/siteui/vlv3/9d3533b2-0e2b-40b2-95e0-eca79790c5fe/1e07b8a5-d861-419b-a0d0-fb1fae62a149/MX-es-20240415-popsignuptwoweeks-perspective_alpha_website_large.jpg" 
          alt="background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-8 py-6">
        <h1 className="text-4xl font-extrabold text-[#E50914] tracking-wider drop-shadow-md">GATON</h1>
      </div>

      {/* Login Box */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-4">
        <div className="bg-black/80 p-12 md:p-16 rounded-md w-full max-w-[450px]">
          <h2 className="text-white text-3xl font-bold mb-8">
            {isLogin ? 'Iniciar sesión' : 'Registrarse'}
          </h2>

          {error && <div className="bg-[#e87c03] text-white text-sm p-4 rounded mb-4">{error}</div>}
          {message && <div className="bg-green-600 text-white text-sm p-4 rounded mb-4">{message}</div>}

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="Email o número de teléfono" 
              className="bg-[#333] text-white px-4 py-3 rounded-sm w-full outline-none focus:bg-[#444]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              className="bg-[#333] text-white px-4 py-3 rounded-sm w-full outline-none focus:bg-[#444]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <button 
              type="submit" 
              disabled={loading}
              className="bg-[#E50914] text-white font-bold py-3 rounded-sm mt-4 hover:bg-[#c11119] transition-colors"
            >
              {loading ? 'Cargando...' : (isLogin ? 'Iniciar sesión' : 'Registrarse')}
            </button>
          </form>

          <div className="mt-16 text-gray-400">
            {isLogin ? '¿Primera vez en Gaton?' : '¿Ya tienes una cuenta?'}
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
              className="text-white ml-2 hover:underline"
            >
              {isLogin ? 'Suscríbete ahora.' : 'Inicia sesión.'}
            </button>
          </div>
          
          <p className="mt-4 text-xs text-gray-500">
            Esta página está protegida por reCAPTCHA para comprobar que no eres un robot.
          </p>
        </div>
      </div>
    </div>
  );
}
