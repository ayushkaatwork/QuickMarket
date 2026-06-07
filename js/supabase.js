import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase Connection Configuration
const SUPABASE_URL = 'https://yujsfdqtcsbojjukvoyg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1anNmZHF0Y3Nib2pqdWt2b3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM1MTEsImV4cCI6MjA5NjA1OTUxMX0.HKvJMSS8HU3syoaYWacVjqd003DnsPqbdqcvAC4cnqQ'

let supabase

try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} catch (err) {
  console.error("Failed to initialize Supabase client:", err)
}

export { supabase }
