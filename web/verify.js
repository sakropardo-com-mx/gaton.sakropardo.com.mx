import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Lee el .env manualmente
const envFile = fs.readFileSync('.env', 'utf-8');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';

envFile.split('\n').forEach(line => {
    if(line.startsWith('VITE_SUPABASE_URL')) VITE_SUPABASE_URL = line.split('=')[1].replace(/"/g, '').trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
  db: { schema: 'gatonplayseries' }
});

async function run() {
  const { data: movies, error: mErr } = await supabase.from('movies').select('*');
  const { data: series, error: sErr } = await supabase.from('series').select('*');
  
  if (mErr) {
      console.error("ERROR MOVIES:", mErr);
  } else {
      console.log(`✅ EXITO: ${movies.length} movies encontradas.`);
  }
  
  if (sErr) {
      console.error("ERROR SERIES:", sErr);
  } else {
      console.log(`✅ EXITO: ${series.length} series encontradas.`);
  }
}
run();
