import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔒 The Master Key
const DEV_ID = '7020672841';

export const isDevUser = (email: string) => email?.includes(DEV_ID);

export async function setDevMode(enabled: boolean) {
  try {
    await AsyncStorage.setItem('DEV_MODE', enabled ? 'true' : 'false');
  } catch (e) { console.error("Dev Mode Error", e); }
}

export async function getDevMode() {
  try {
    const val = await AsyncStorage.getItem('DEV_MODE');
    return val === 'true';
  } catch { return false; }
}