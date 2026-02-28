import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  RefreshControl, Dimensions, Linking, TextInput, Modal 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { MapPin, Clock, Bike, CheckCircle, Package, Timer, Phone, Store, Coffee, Plus } from 'lucide-react-native';

// 🟢 IMPORT OUR PUSH HELPERS
import { notifyUser } from '../lib/push';

interface ErrandScreenProps {
  userId: string;
  isProfileComplete: boolean; 
}

const { width } = Dimensions.get('window');

export default function ErrandScreen({ userId, isProfileComplete }: ErrandScreenProps) {
    const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');

function showAlert(title: string, message: string) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertVisible(true);
}
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'available' | 'mine'>('available');
  const [errands, setErrands] = useState<any[]>([]);
  const [myErrands, setMyErrands] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // OTP State
  const [otpInputs, setOtpInputs] = useState<{[key: string]: string}>({});

  useFocusEffect(
    useCallback(() => {
      fetchErrands();
    }, [])
  );

  // 🟢 FIXED: REALTIME GLOBAL LISTENERS
  // This ensures that when ANYONE adds an order, it pops up here instantly.
  useEffect(() => {
    const channel = supabase.channel('global_errands')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'errands' }, 
        (payload) => {
          console.log('Realtime change detected:', payload);
          fetchErrands(); // Auto-refresh data on any change
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchErrands() {
    setRefreshing(true);
    
    // 1. Fetch Available (No Runner yet)
    const { data: available } = await supabase
      .from('errands')
      .select('*, profiles:student_id(phone)') 
      .is('runner_id', null)
      .eq('order_type', 'delivery')
      .neq('status', 'cancelled')
      .neq('status', 'delivered')
      .in('status', ['cooking', 'ready']) 
      .order('created_at', { ascending: false });

    if (available) setErrands(available);

    // 2. Fetch MY Active Quests
    const { data: mine } = await supabase
      .from('errands')
      .select('*, profiles:student_id(phone)') 
      .eq('runner_id', userId)
      .eq('order_type', 'delivery')
      .neq('status', 'cancelled')
      .neq('status', 'delivered') 
      .order('created_at', { ascending: false });

    if (mine) setMyErrands(mine);
    
    setRefreshing(false);
  }

  // --- ACTIONS ---

  function confirmAccept(item: any) {
      if (!isProfileComplete) {
          showAlert("Profile Incomplete 🛑", "Runners must be verified. Go to Profile tab.");
          return;
      }

      setAlertTitle("⚠️ Accept Delivery?");
setAlertMessage(`Earn ₹20\n\nTask: Deliver ${item.item_description} from ${item.shop_name}`);
setAlertVisible(true);
  }

  async function acceptErrand(item: any) {
      const { error } = await supabase.from('errands').update({ runner_id: userId }).eq('id', item.id);
      
      if (error) {
          showAlert("Error", "Delivery already taken by another runner!");
      } else { 
          // 🟢 FIXED: Ensure notification is awaited properly
          try {
              await notifyUser(item.student_id, "Runner Assigned! 🏃‍♂️", `A runner is heading to ${item.shop_name} to pick up your order!`);
          } catch (e) {
              console.log("Notification failed, but order accepted", e);
          }

          showAlert("Accepted! 🎮", "Pick up the order and deliver it to get paid."); 
          fetchErrands(); 
          setActiveTab('mine'); 
      }
  }

  function callStudent(phone: string) {
      if (!phone) {
          showAlert("Error", "Phone number hidden.");
          return;
      }
      Linking.openURL(`tel:${phone}`);
  }

  async function verifyAndComplete(item: any) {
      const enteredOtp = otpInputs[item.id];

      if (!enteredOtp || enteredOtp.length !== 4) {
          showAlert("Invalid OTP", "Enter the 4-digit code from the student.");
          return;
      }

      if (enteredOtp !== item.delivery_otp) {
          showAlert("Wrong Code ❌", "Ask the student for the correct 4-digit OTP.");
          return;
      }

      const { error } = await supabase.from('errands').update({ status: 'delivered' }).eq('id', item.id);
      
      if (!error) {
        try {
            await notifyUser(item.student_id, "Order Delivered! ✅", `Your food from ${item.shop_name} has arrived. Enjoy!`);
        } catch (e) { console.log("Notif error", e); }

        showAlert("Delivery Complete! 💰", `You earned ₹20. Check the Payouts tab in the vendor's dashboard.`);
        fetchErrands();
      } else {
        showAlert("Error", "Network error.");
      }
  }

  // --- RENDERERS ---

  const getShopBadge = (shopName: string) => {
      if (shopName === 'Five Star') return { color: '#FF9800', icon: <Store size={16} color="#FF9800" />, bg: 'rgba(255, 152, 0, 0.1)' };
      if (shopName === 'Ground View Cafe') return { color: '#795548', icon: <Coffee size={16} color="#795548" />, bg: 'rgba(121, 85, 72, 0.1)' };
      return { color: '#2979FF', icon: <Package size={16} color="#2979FF" />, bg: 'rgba(41, 121, 255, 0.1)' }; 
  };

  const renderAvailable = ({ item }: { item: any }) => {
    const shopStyle = getShopBadge(item.shop_name);

    return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
                <View>
                    <View style={[styles.badge, {backgroundColor: shopStyle.bg, flexDirection:'row', alignItems:'center', gap:5}]}>
                        {shopStyle.icon}
                        <Text style={{color: shopStyle.color, fontWeight:'bold', fontSize: 12}}>{item.shop_name.toUpperCase()}</Text>
                    </View>
                    {item.delivery_address && (
                        <View style={{flexDirection:'row', alignItems:'center', marginTop: 8}}>
                            <MapPin size={12} color="#00E676" />
                            <Text style={{color: '#ccc', fontSize: 12, marginLeft: 5}}>{item.delivery_address}</Text>
                        </View>
                    )}
                </View>
                <View style={{alignItems:'flex-end'}}>
                    <View style={[styles.badge, {backgroundColor: 'rgba(0,230,118,0.1)'}]}>
                        <Text style={{color:'#00E676', fontWeight:'bold', fontSize: 10}}>EARN ₹20</Text>
                    </View>
                </View>
            </View>
            <View style={styles.divider} />
            <View style={{flexDirection:'row', alignItems:'center', marginBottom: 15}}>
                 <Text style={{color: '#ccc', marginLeft: 8, flex: 1, fontSize: 16}}>{item.item_description}</Text>
            </View>
            
            <TouchableOpacity onPress={() => confirmAccept(item)} style={styles.acceptBtn}>
                <Bike size={20} color="black" />
                <Text style={{color:'black', fontWeight:'bold', marginLeft: 10}}>Accept Delivery</Text>
            </TouchableOpacity>
        </View>

    );
  };

  const renderMine = ({ item }: { item: any }) => {
    const shopStyle = getShopBadge(item.shop_name);

    return (
        <View style={[styles.card, { backgroundColor: '#1a1a1a', borderColor: item.status === 'ready' ? '#00E676' : '#333', borderWidth: 1 }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333'}}>
                <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                    {shopStyle.icon}
                    <Text style={{fontSize: 16, fontWeight:'bold', color: shopStyle.color}}>{item.shop_name}</Text>
                </View>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <Clock size={14} color='#00E676' />
                    <Text style={{color: '#00E676', marginLeft: 5, fontWeight:'bold'}}>ACTIVE</Text>
                </View>
            </View>

            <Text style={{color: '#ccc', marginBottom: 15, fontSize: 16}}>{item.item_description}</Text>
            
            <View style={{backgroundColor: '#252525', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <View style={{flex: 1}}>
                    <Text style={{color:'#888', fontSize: 12, marginBottom: 2}}>Location 📍</Text>
                    <Text style={{color:'white', fontWeight:'bold', fontSize: 15}} numberOfLines={2}>{item.delivery_address || 'No Address'}</Text>
                </View>
                <TouchableOpacity onPress={() => callStudent(item.profiles?.phone)} style={{backgroundColor:'#2e7d32', padding: 10, borderRadius: 25, marginLeft: 10}}>
                    <Phone size={20} color="white" />
                </TouchableOpacity>
            </View>

            {item.status === 'ready' ? (
                 <View style={{backgroundColor: '#002e14', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#004d21'}}>
                     <Text style={{color:'#00E676', marginBottom: 10, fontSize: 13, fontWeight:'bold'}}>Verify Completion Code:</Text>
                     <View style={{flexDirection:'row', gap: 10}}>
                         <TextInput 
                            style={styles.otpInput}
                            placeholder="OTP"
                            placeholderTextColor="#666"
                            keyboardType="number-pad"
                            maxLength={4}
                            value={otpInputs[item.id] || ''}
                            onChangeText={(text) => setOtpInputs(prev => ({...prev, [item.id]: text}))}
                         />
                         <TouchableOpacity onPress={() => verifyAndComplete(item)} style={[styles.acceptBtn, {flex: 1, padding: 0, height: 50}]}>
                            <CheckCircle size={20} color="black" />
                            <Text style={{color:'black', fontWeight:'bold', marginLeft: 5}}>Complete</Text>
                         </TouchableOpacity>
                     </View>
                 </View>
            ) : (
                 <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', padding: 15, backgroundColor: '#333', borderRadius: 12}}>
                    <Timer size={20} color="#aaa" />
                    <Text style={{color:'#aaa', fontWeight:'bold', marginLeft: 10}}>Pick up food at {item.shop_name}...</Text>
                 </View>
            )}
        </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Food Runs 🍔</Text>
        
        {/* 🟢 CUSTOM QUESTS DISABLED: NOW SHOWS COMING SOON */}
        <TouchableOpacity 
            onPress={() => showAlert("Coming Soon 🚀", "Custom Errands and peer-to-peer tasks are dropping in the next update!")} 
            style={{backgroundColor: '#00E676', padding: 10, borderRadius: 20}}
        >
            <Plus size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setActiveTab('available')} style={[styles.tab, activeTab === 'available' && styles.activeTab]}>
              <Text style={[styles.tabText, activeTab === 'available' && {color: 'black'}]}>Find Runs 🛵</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('mine')} style={[styles.tab, activeTab === 'mine' && styles.activeTab]}>
              <Text style={[styles.tabText, activeTab === 'mine' && {color: 'black'}]}>My Runs 📜</Text>
              {myErrands.length > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
      </View>
      <Modal visible={alertVisible} transparent animationType="fade">
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }}>
    <View style={{
      backgroundColor: colors.card,
      padding: 20,
      borderRadius: 16,
      width: '100%'
    }}>
      <Text style={{
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 10
      }}>
        {alertTitle}
      </Text>

      <Text style={{
        color: '#888',
        marginBottom: 20
      }}>
        {alertMessage}
      </Text>

      <TouchableOpacity
        onPress={() => setAlertVisible(false)}
        style={{
          backgroundColor: '#00E676',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'black', fontWeight: 'bold' }}>
          OK
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

      <FlatList
        data={activeTab === 'available' ? errands : myErrands}
        keyExtractor={item => item.id}
        renderItem={activeTab === 'available' ? renderAvailable : renderMine}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchErrands} tintColor="#00E676" />}
        ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 50, opacity: 0.5}}>
                <Bike size={50} color="#666" />
                <Text style={{color:'#666', marginTop: 15, fontSize: 16}}>
                    {activeTab === 'available' ? "No delivery runs available right now." : "You haven't accepted any delivery runs."}
                </Text>
            </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 10 },
  tab: { marginRight: 15, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  activeTab: { backgroundColor: '#00E676', borderColor: '#00E676' },
  tabText: { color: '#888', fontWeight: 'bold' },
  dot: { position:'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: 'red', borderWidth: 2, borderColor: '#121212' },

  card: { padding: 20, borderRadius: 20, marginBottom: 15 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 5 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  
  acceptBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  
  otpInput: {
      backgroundColor: 'black',
      color: 'white',
      borderWidth: 1,
      borderColor: '#00E676',
      borderRadius: 10,
      width: 80,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: 'bold',
      letterSpacing: 2,
      height: 50
  }
});