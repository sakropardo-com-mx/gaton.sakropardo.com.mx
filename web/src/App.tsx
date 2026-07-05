import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { Profiles } from './components/Profiles';
import { Login } from './pages/Login';
import { PlayerPage } from './pages/PlayerPage';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{id: string, name: string, avatar: string} | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('gaton_active_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Basic UUID validation regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (parsed && typeof parsed === 'object' && parsed.id && uuidRegex.test(parsed.id)) {
          setProfile(parsed);
        } else {
          // Invalid or old format (non-uuid), clear it
          localStorage.removeItem('gaton_active_profile');
        }
      } catch (e) {
        localStorage.removeItem('gaton_active_profile');
      }
    }
  }, []);

  const handleProfileSelect = (id: string, name: string, avatar: string) => {
    const newProfile = { id, name, avatar };
    setProfile(newProfile);
    localStorage.setItem('gaton_active_profile', JSON.stringify(newProfile));
  };

  if (loading) return <div className="h-screen bg-black" />;

  if (!session) {
    return <Login />;
  }

  if (!profile) {
    return <Profiles onSelectProfile={handleProfileSelect} userId={session.user.id} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home activeProfile={profile} category="Inicio" />} />
        <Route path="/series" element={<Home activeProfile={profile} category="Series" />} />
        <Route path="/peliculas" element={<Home activeProfile={profile} category="Películas" />} />
        <Route path="/explorar" element={<Home activeProfile={profile} category="Explorar" />} />
        <Route path="/lista" element={<Home activeProfile={profile} category="Mi lista" />} />
        
        <Route path="/media/:modalId" element={<Home activeProfile={profile} category="Inicio" />} />
        <Route path="/series/media/:modalId" element={<Home activeProfile={profile} category="Series" />} />
        <Route path="/peliculas/media/:modalId" element={<Home activeProfile={profile} category="Películas" />} />
        <Route path="/explorar/media/:modalId" element={<Home activeProfile={profile} category="Explorar" />} />
        <Route path="/lista/media/:modalId" element={<Home activeProfile={profile} category="Mi lista" />} />
        
        <Route path="/play/:id" element={<PlayerPage activeProfile={profile} />} />
      </Routes>
    </Router>
  );
}

export default App;
