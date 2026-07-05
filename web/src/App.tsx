import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { Profiles } from './components/Profiles';

function App() {
  const [profile, setProfile] = useState<{name: string, avatar: string} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('netflix_profile');
    if (saved) setProfile(JSON.parse(saved));
  }, []);

  const handleProfileSelect = (name: string, avatar: string) => {
    const newProfile = { name, avatar };
    setProfile(newProfile);
    localStorage.setItem('netflix_profile', JSON.stringify(newProfile));
  };

  if (!profile) {
    return <Profiles onSelectProfile={handleProfileSelect} />;
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
