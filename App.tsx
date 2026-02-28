import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Modal,
  Linking,
  Platform
} from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { supabase } from './lib/supabase';
import {
  Utensils,
  BookOpen,
  Printer,
  GraduationCap,
  User,
  Zap,
  AlertTriangle
} from 'lucide-react-native';

// -------- OneSignal (Native Only) --------
let OneSignal: any = null;
let LogLevel: any = null;

if (Platform.OS !== 'web') {
  const OneSignalImport = require('react-native-onesignal');
  OneSignal = OneSignalImport.OneSignal;
  LogLevel = OneSignalImport.LogLevel;
}

// -------- Screens --------
import MenuScreen from './screens/MenuScreen';
import PrintScreen from './screens/PrintScreen';
import ProfileScreen from './screens/ProfileScreen';
import AuthScreen from './screens/AuthScreen';
import ErrandScreen from './screens/ErrandScreen';
import HomeScreen from './screens/HomeScreen';
import TutorScreen from './screens/TutorScreen';

// -------- Config --------
const ADMIN_EMAILS = ['9066282034@campus.app', '9686050312@campus.app'];
const APP_VERSION = "1.0.1";

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [userRole, setUserRole] = useState('vendor');
  
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');

  const theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#09090b',
      card: '#18181b',
      text: '#FFFFFF',
      primary: '#00E676',
      border: '#27272a',
    },
  };

  useEffect(() => {
    checkVersion();

    // ✅ Only run OneSignal on Android/iOS
    if (Platform.OS !== 'web' && OneSignal) {
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);
      OneSignal.initialize("0e65c351-3716-44e5-8c20-d588d38a54de");
      OneSignal.Notifications.requestPermission(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && ADMIN_EMAILS.includes(session.user.email)) {
  setUserRole('vendor');
} else {
  setUserRole('student');
}

      if (session) {
        checkProfile(session.user.id);

        if (Platform.OS !== 'web' && OneSignal) {
          OneSignal.login(session.user.id);
        }
      } else {
        setLoading(false);

        if (Platform.OS !== 'web' && OneSignal) {
          OneSignal.logout();
        }
      }
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session && ADMIN_EMAILS.includes(session.user.email)) {
  setUserRole('vendor');
} else {
  setUserRole('student');
}

        if (session) {
          checkProfile(session.user.id);

          if (Platform.OS !== 'web' && OneSignal) {
            OneSignal.login(session.user.id);
          }
        } else {
          setLoading(false);

          if (Platform.OS !== 'web' && OneSignal) {
            OneSignal.logout();
          }
        }
      });

    return () => subscription.unsubscribe();
  }, []);

  async function checkVersion() {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('*')
        .single();
        if (data?.role === 'vendor') {
  setUserRole('vendor');
} else {
  setUserRole('student');
}

      if (data && data.latest_version !== APP_VERSION) {
        setUpdateUrl(data.update_url);
        setNeedsUpdate(true);
      }
    } catch (e) {
      console.log("Update check failed", e);
    }
  }

  async function checkProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (
        data &&
        data.full_name &&
        data.phone &&
        data.id_card_url &&
        data.is_email_verified
      ) {
        setIsProfileComplete(true);
      } else {
        setIsProfileComplete(false);
      }
    } catch (e) {
      console.log("Profile check error:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E676" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Update Modal */}
      <Modal visible={needsUpdate} transparent={false} animationType="fade">
        <View style={styles.updateContainer}>
          <AlertTriangle size={64} color="#00E676" />
          <Text style={styles.updateTitle}>Update Required</Text>
          <Text style={styles.updateSub}>
            Your version of SideQuest is outdated.
          </Text>
          <TouchableOpacity
            style={styles.updateBtn}
            onPress={() => Linking.openURL(updateUrl)}
          >
            <Text style={styles.updateBtnText}>
              Download New APK 🚀
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {!session ? (
        <AuthScreen />
      ) : (
        <Tab.Navigator
        
        id="main-tabs"
  screenOptions={{
    headerShown: false,

    tabBarStyle: {
      backgroundColor: '#111',
      borderTopWidth: 0,
      height: 70,
      paddingBottom: 10,
      paddingTop: 10,
    },
    tabBarItemStyle: {
  paddingVertical: 5,
},

    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '600',
    },

    tabBarActiveTintColor: '#00E676',
    tabBarInactiveTintColor: '#777',
  }}
>
          <Tab.Screen
  name="Buzz"
  options={{
    tabBarIcon: ({ color, size }) => (
      <Zap color={color} size={size} />
    ),
  }}
>
            {() => <HomeScreen userEmail={session.user.email} />}
          </Tab.Screen>

          {userRole !== 'vendor' && (
  <Tab.Screen
    name="Food Run"
    options={{
      tabBarIcon: ({ color, size }) => (
        <Utensils color={color} size={size} />
      ),
    }}
  >
    {() => (
      <ErrandScreen
        userId={session.user.id}
        isProfileComplete={isProfileComplete}
      />
    )}
  </Tab.Screen>
)}

          <Tab.Screen
  name="Menus"
  options={{
    tabBarIcon: ({ color, size }) => (
      <BookOpen color={color} size={size} />
    ),
  }}
>
            {() => (
              <MenuScreen
                userId={session.user.id}
                userEmail={session.user.email}
                isProfileComplete={isProfileComplete}
              />
            )}
          </Tab.Screen>

          {userRole !== 'vendor' && (
  <Tab.Screen
    name="Print Shop"
    options={{
      tabBarIcon: ({ color, size }) => (
        <Printer color={color} size={size} />
      ),
    }}
  >
    {() => (
      <PrintScreen
        userId={session.user.id}
        userEmail={session.user.email}
        isProfileComplete={isProfileComplete}
      />
    )}
  </Tab.Screen>
)}
          {userRole !== 'vendor' && (
  <Tab.Screen
    name="Tutors"
    options={{
      tabBarIcon: ({ color, size }) => (
        <GraduationCap color={color} size={size} />
      ),
    }}
  >
    {() => (
      <TutorScreen
        userId={session.user.id}
        isProfileComplete={isProfileComplete}
      />
    )}
  </Tab.Screen>
)}
          <Tab.Screen
  name="Profile"
  options={{
    tabBarIcon: ({ color, size }) => (
      <User color={color} size={size} />
    ),
  }}
>
            {() => <ProfileScreen session={session} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b'
  },
  updateContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  updateTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20
  },
  updateSub: {
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    fontSize: 16
  },
  updateBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 16,
    marginTop: 40,
    width: '100%',
    alignItems: 'center'
  },
  updateBtnText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 18
  }
});