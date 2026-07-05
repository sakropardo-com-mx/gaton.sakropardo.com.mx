import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Details } from './pages/Details';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/media/:id" element={<Details />} />
      </Routes>
    </Router>
  );
}

export default App;
