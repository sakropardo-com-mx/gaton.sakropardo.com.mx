import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { Profiles } from './components/Profiles';
import { Login } from './pages/Login';
import { supabase } from './supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{name: string, avatar: string} | null>(null);

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
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  const handleProfileSelect = (name: string, avatar: string) => {
    const newProfile = { name, avatar };
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
        <Route path="/" element={<Home activeProfile={profile} />} />
        <Route path="/media/:modalId" element={<Home activeProfile={profile} />} />
      </Routes>
    </Router>
  );
}

export default App;
