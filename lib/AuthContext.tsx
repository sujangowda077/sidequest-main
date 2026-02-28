import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Alert } from 'react-native';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for Login/Logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) setProfile(data);
    setLoading(false);
  };

  // 🛡️ THE GATEKEEPER FUNCTION
  const requireApproval = (action: () => void) => {
    if (!profile) {
      Alert.alert("Loading...", "Please wait while we check your profile.");
      return;
    }
    // Check if they have uploaded ID and Phone
    if (!profile.full_name || !profile.phone || !profile.id_card_url) {
       Alert.alert("Profile Incomplete 🛑", "You must upload your Student ID and Phone Number in the Profile tab before you can do this.");
       return;
    }
    // Check if Admin has approved them (Optional: Add 'is_verified' column to Supabase)
    if (profile.is_verified === false) {
       Alert.alert("Pending Approval ⏳", "Your ID is currently being reviewed by our team. You can browse, but cannot perform actions yet.");
       return;
    }

    // If all good, run the action!
    action();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, requireApproval, refreshProfile: () => user && fetchProfile(user.id) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);