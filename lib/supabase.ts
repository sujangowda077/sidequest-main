import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ✅ I got this URL from your screenshot
const supabaseUrl = 'https://campus-proxy.minecraftsreyash.workers.dev/';

// ⚠️ PASTE YOUR "Publishable key" BELOW (The one starting with sb_publishable...)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjYmp4aXZleGhweGR4ZHZvZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTY0ODIsImV4cCI6MjA4NTkzMjQ4Mn0.YKq6BXnt1igwGdofp7_BzKu_Gvs1cvmsJat7WTDoTMU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});