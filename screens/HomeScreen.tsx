import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  RefreshControl, Modal, TextInput, ScrollView, Image, Dimensions, Linking 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { 
  X, Zap, Store, Coffee, Lock, Trash2, CheckCircle, Bug 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- THEME FOR ADS ---
const VIBES: any = {
  'spicy': { id: 'spicy', label: 'Hot Deal', colors: ['#FF512F', '#DD2476'], icon: Zap, textColor: 'white' },
  'chill': { id: 'chill', label: 'Cool', colors: ['#4FACFE', '#00F2FE'], icon: Coffee, textColor: 'white' },
  'flash': { id: 'flash', label: 'Flash', colors: ['#F7971E', '#FFD200'], icon: Zap, textColor: 'black' }
};

export default function HomeScreen({ userEmail }: { userEmail: string }) {
  const { colors } = useTheme();
  const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');

function showAlert(title: string, message: string) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertVisible(true);
}

  // --- CONFIG ---
  const MY_UPI = "minecraftsreyash@oksbi"; 
  const AD_PRICE = 80; 
  const ADMIN_MAP: { [key: string]: string } = {
      '9066282034@campus.app': 'Five Star',
      '9686050312@campus.app': 'Ground View Cafe'
  };
  const safeEmail = userEmail ? userEmail.toLowerCase().trim() : '';
  const myShop = ADMIN_MAP[safeEmail];
  const isAdmin = !!myShop;

  // --- STATE ---
  const [profile, setProfile] = useState<any>({ id: null, full_name: 'Student', mana_balance: 0 });
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [shopStates, setShopStates] = useState<{[key: string]: boolean}>({}); 
  const [loading, setLoading] = useState(false);

  // Ad Creation State
  const [showModal, setShowModal] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adDesc, setAdDesc] = useState('');
  const [selectedVibe, setSelectedVibe] = useState('spicy');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [pendingTotal, setPendingTotal] = useState(0);
  const [adUtr, setAdUtr] = useState(''); // 🟢 NEW: UTR State for Ads
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
  setRefreshing(true);

  // 🔥 Call your fetch function here
  await fetchData();   // replace with your actual fetch function

  setRefreshing(false);
};

  useFocusEffect(
    useCallback(() => {
      fetchData();
      
      // 🟢 AUTO-CLEANUP TIMER: Re-runs every minute to automatically hide 5-min old finished orders
      const interval = setInterval(() => {
          fetchData();
      }, 60000); 

      return () => clearInterval(interval);
    }, [])
  );

  // 🟢 REALTIME LISTENER: AUTO-UPDATE BOARD
  useEffect(() => {
    const channel = supabase
      .channel('public:errands')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'errands' },
        (payload) => {
          fetchData(); 
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, mana_balance')
        .eq('email', safeEmail)
        .single();
    if (userData) setProfile(userData);

    // 🟢 FETCH LOGIC: Get Cooking, Ready, AND recently Finished orders
    const { data: orders } = await supabase
        .from('errands')
        .select('token_no, status, shop_name, student_id, updated_at')
        .in('status', ['cooking', 'ready', 'picked_up', 'delivered'])
        .order('updated_at', { ascending: false });
        
    if (orders) {
        const now = Date.now();
        const validLiveOrders = orders.filter(o => {
            if (o.status === 'cooking' || o.status === 'ready') return true;
            
            // 🟢 If finished (picked_up/delivered), keep it on board for exactly 5 minutes
            const updatedTime = new Date(o.updated_at).getTime();
            return (now - updatedTime) <= (5 * 60 * 1000); 
        });
        setLiveOrders(validLiveOrders);
    }

    const { data: ads } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (ads) setPromos(ads);

    const { data: shops } = await supabase.from('shops').select('name, is_open');
    if (shops) {
        const map: any = {};
        shops.forEach(s => map[s.name] = s.is_open);
        setShopStates(map);
    }
  }

  // --- ACTIONS ---

  async function handlePostAd() {
    if (!adTitle || !adDesc) { showAlert("Missing Info", "Please add details."); return; }
    const randomPaisa = Math.floor(Math.random() * 90) + 10;
    const uniqueAmount = (AD_PRICE + (randomPaisa / 100)).toFixed(2);
    const upiLink = `upi://pay?pa=${MY_UPI}&pn=CampusConnectAd&am=${uniqueAmount}&cu=INR`;
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`;
    setQrUrl(qrImage);
    setPendingTotal(parseFloat(uniqueAmount));
    setAdUtr('');
    setShowQRModal(true);
  }

  async function finalizeAdPost() {
      // 🟢 UTR GATEKEEPER
      if (!adUtr || adUtr.length < 4) {
          showAlert("Invalid UTR", "Please enter the last 4 digits of your payment reference.");
          return;
      }

      setShowQRModal(false);
      const { error } = await supabase.from('promotions').insert({ 
          shop_name: myShop, title: adTitle, description: adDesc, bg_color: selectedVibe, is_active: true
      });
      if (!error) { 
          showAlert("Success", "Ad posted!"); 
          setShowModal(false); 
          setAdTitle(''); 
          setAdDesc(''); 
          setAdUtr('');
          fetchData(); 
      }
  }

  const handleDeleteAd = (id: string) => {
    Alert.alert("Remove?", "Delete this ad?", [
        { text: "Cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            await supabase.from('promotions').delete().eq('id', id);
            fetchData();
        }}
    ]);
  };

  const handleReportBug = () => {
      const subject = "SideQuest Bug Report";
      const body = "Please describe the issue you are facing:";
      Linking.openURL(`mailto:office.sidequest26@gmail.com?subject=${subject}&body=${body}`);
  };

  // --- COMPONENTS ---

  const OrderColumn = ({ title, color, orders }: { title: string, color: string, orders: any[] }) => (
      <View style={{flex: 1, paddingHorizontal: 5}}>
          <Text style={{color: color, fontWeight:'bold', fontSize: 12, marginBottom: 8, textAlign:'center', letterSpacing:1}}>{title}</Text>
          {orders.length === 0 ? (
              <Text style={{color:'#333', textAlign:'center', fontSize: 10}}>-</Text>
          ) : (
              orders.map((o, i) => {
                  const isMine = o.student_id === profile.id;
                  return (
                    <View key={i} style={isMine ? styles.myTokenBadge : null}>
                        <Text style={{
                            color: isMine ? 'black' : 'white', 
                            fontSize: 22, 
                            fontWeight:'bold', 
                            textAlign:'center', 
                            marginBottom: 4
                        }}>
                            {o.token_no.replace('#', '')}
                        </Text>
                        {isMine && <Text style={{color:'black', fontSize:8, textAlign:'center', fontWeight:'bold'}}>YOU</Text>}
                    </View>
                    
                  )
              })
          )}
      </View>
  );

  const ShopMonitor = ({ name, dbName, icon }: { name: string, dbName: string, icon: any }) => {
      const isOpen = shopStates[dbName] !== false;
      
      // 🟢 DATA ROUTING FOR MONITORS
      const shopOrders = liveOrders.filter(o => o.shop_name === dbName);
      const cooking = shopOrders.filter(o => o.status === 'cooking');
      // Ready column shows 'ready' + recently finished orders
      const ready = shopOrders.filter(o => ['ready', 'picked_up', 'delivered'].includes(o.status));

      return (
          <View style={[styles.monitorContainer, !isOpen && {borderColor: '#d32f2f', borderWidth: 2}]}>
              <View style={[styles.monitorHeader, !isOpen && {backgroundColor: '#ffcdd2'}]}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                      {icon}
                      <Text style={{color:'black', fontWeight:'bold', marginLeft: 8, fontSize: 18}}>{name.toUpperCase()}</Text>
                  </View>
                  {!isOpen && <Text style={{color:'#d32f2f', fontWeight:'bold', fontSize: 12, borderWidth:1, borderColor:'#d32f2f', paddingHorizontal:6, borderRadius:4}}>CLOSED</Text>}
              </View>
              
              {!isOpen ? (
                  <View style={{flex: 1, justifyContent:'center', alignItems:'center', minHeight: 100, backgroundColor: '#1a1a1a'}}>
                      <Lock size={32} color="#ef5350" />
                      <Text style={{color:'#ef5350', fontWeight:'bold', fontSize: 16, marginTop: 10, letterSpacing: 2}}>CLOSED</Text>
                  </View>
              ) : (
                  <View style={{flexDirection:'row', paddingTop: 15, paddingBottom: 15}}>
                      <OrderColumn title="PREPARING" color="#FF9800" orders={cooking} />
                      <View style={{width: 1, backgroundColor:'#333'}} />
                      <OrderColumn title="READY" color="#00E676" orders={ready} />
                  </View>
              )}
          </View>
      );
  };

  const PromoCard = ({ item }: { item: any }) => {
    const theme = VIBES[item.bg_color] || VIBES['spicy'];
    const isOwner = myShop === item.shop_name; 

    return (
      <View style={styles.cardContainer}>
          <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
             <View style={styles.cardHeader}>
                <View style={styles.shopBadge}>
                    <Text style={[styles.shopText, {color: theme.textColor}]}>{item.shop_name}</Text>
                </View>
                {isOwner && (
                    <TouchableOpacity onPress={() => handleDeleteAd(item.id)} style={styles.deleteBtn}>
                        <Trash2 size={18} color={theme.textColor} />
                    </TouchableOpacity>
                )}
             </View>
             <Text style={[styles.cardTitle, {color: theme.textColor}]} numberOfLines={2}>{item.title}</Text>
             <Text style={[styles.cardDesc, {color: theme.textColor}]} numberOfLines={2}>{item.description}</Text>
          </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
          <View>
              <Text style={{color: '#888', fontSize: 14}}>Welcome back,</Text>
              <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>
                  {profile.full_name ? profile.full_name.split(' ')[0] : 'User'}
              </Text>
          </View>
          <View style={styles.manaBadge}>
              <Zap size={16} color="#FFD700" fill="#FFD700" />
              <Text style={styles.manaText}>{profile.mana_balance || 0}</Text>
          </View>
      </View>

      <ScrollView 
        contentContainerStyle={{paddingBottom: 100}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
          {/* LIVE ORDER BOARD */}
          <View style={{paddingHorizontal: 20, marginBottom: 25}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                  <Text style={{color:'#888', fontWeight:'bold', fontSize: 12, letterSpacing: 1}}>LIVE ORDER BOARD</Text>
                  <View style={{flexDirection:'row', gap:10}}>
                      <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, borderRadius:4, backgroundColor:'#FF9800', marginRight:4}}/><Text style={{color:'#666', fontSize:10}}>Cooking</Text></View>
                      <View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, borderRadius:4, backgroundColor:'#00E676', marginRight:4}}/><Text style={{color:'#666', fontSize:10}}>Ready</Text></View>
                  </View>
              </View>
              
              <View style={{flexDirection:'column', gap: 20}}>
                  <ShopMonitor name="Five Star" dbName="Five Star" icon={<Store size={20} color="black"/>} />
                  <ShopMonitor name="Ground View" dbName="Ground View Cafe" icon={<Coffee size={20} color="black"/>} />
              </View>
          </View>

          {/* CAMPUS BUZZ */}
          <View style={{paddingHorizontal: 20}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                  <Text style={{color: colors.text, fontWeight:'bold', fontSize: 18}}>Campus Buzz ⚡</Text>
                  {isAdmin && (
                      <TouchableOpacity onPress={() => setShowModal(true)}>
                          <Text style={{color: colors.primary, fontWeight:'bold'}}>+ Post Ad</Text>
                      </TouchableOpacity>
                  )}
              </View>

              {promos.length === 0 ? (
                  <Text style={{color:'#666', fontStyle:'italic'}}>Quiet day on campus...</Text>
              ) : (
                  promos.map(item => <PromoCard key={item.id} item={item} />)
              )}
          </View>

          {/* BUG REPORT */}
          <View style={{paddingHorizontal: 20, marginTop: 30}}>
              <TouchableOpacity onPress={handleReportBug} style={styles.bugReportBtn}>
                  <Bug size={16} color="#666" style={{marginRight: 8}} />
                  <Text style={{color: '#666', fontSize: 12, fontWeight: 'bold'}}>Report a Bug</Text>
              </TouchableOpacity>
          </View>

      </ScrollView>

      {/* ADMIN POST MODAL */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalContent, {backgroundColor: colors.background}]}>
              <View style={styles.modalHeader}><Text style={{fontSize: 20, fontWeight: 'bold', color: colors.text}}>Create Promotion</Text><TouchableOpacity onPress={() => setShowModal(false)}><X size={24} color={colors.text}/></TouchableOpacity></View>
              <ScrollView>
                  <PromoCard item={{ shop_name: myShop, title: adTitle || 'Title', description: adDesc || 'Desc', bg_color: selectedVibe }} />
                  <View style={{flexDirection:'row', marginVertical: 20}}>
                      {Object.values(VIBES).map((vibe: any) => (
                          <TouchableOpacity key={vibe.id} onPress={() => setSelectedVibe(vibe.id)} style={[styles.vibeBtn, {borderColor: selectedVibe === vibe.id ? colors.primary : '#333'}]}>
                              <Text style={{color: vibe.colors[0], fontWeight:'bold'}}>{vibe.label}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
                  <TextInput value={adTitle} onChangeText={setAdTitle} style={[styles.input, {color: colors.text, borderColor: colors.border}]} placeholder="Headline" placeholderTextColor="#666" maxLength={25}/>
                  <TextInput value={adDesc} onChangeText={setAdDesc} multiline style={[styles.input, {color: colors.text, borderColor: colors.border, height: 80, marginTop:10}]} placeholder="Details" placeholderTextColor="#666"/>
                  
                  <TouchableOpacity onPress={handlePostAd} style={[styles.payBtn, {backgroundColor: colors.primary}]}><Text style={{fontWeight:'bold', fontSize: 18, color: 'black'}}>Pay ₹{AD_PRICE} & Post</Text></TouchableOpacity>
              </ScrollView>
          </View>
      </Modal>

      {/* 🟢 AD UTR PAYMENT MODAL */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.qrBox, {backgroundColor: 'white'}]}>
                <Text style={{fontSize: 22, fontWeight:'bold', color: 'black', marginBottom:10}}>Scan to Pay</Text>
                <View style={{padding: 10, borderWidth: 2, borderColor: 'black', borderRadius: 10}}><Image source={{ uri: qrUrl }} style={{ width: 250, height: 250 }} /></View>
                <Text style={{fontSize: 24, fontWeight:'bold', color: '#00E676', marginVertical: 15}}>₹{pendingTotal.toFixed(2)}</Text>
                
                {/* 🟢 UTR GATEKEEPER INPUT */}
                <View style={{width: '100%', marginBottom: 15}}>
                    <Text style={{color: '#333', fontWeight:'bold', marginBottom: 5}}>Verify Payment:</Text>
                    <TextInput 
                        placeholder="Enter Last 4 digits of UPI Ref No." 
                        placeholderTextColor="#999" 
                        value={adUtr} 
                        onChangeText={setAdUtr} 
                        maxLength={12} 
                        keyboardType="numeric" 
                        style={[styles.input, {color: 'black', backgroundColor: '#f9f9f9', borderColor: '#ccc', textAlign: 'center'}]}
                    />
                </View>

                <View style={{flexDirection:'row', gap: 10, width:'100%'}}>
                    <TouchableOpacity onPress={() => setShowQRModal(false)} style={{flex:1, padding:15, backgroundColor:'#eee', borderRadius:10, alignItems:'center'}}><Text style={{color:'black'}}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={finalizeAdPost} style={{flex:1, padding:15, backgroundColor:'black', borderRadius:10, alignItems:'center'}}><Text style={{color:'white', fontWeight:'bold'}}>Submit</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  manaBadge: { flexDirection:'row', alignItems:'center', backgroundColor: 'rgba(142, 45, 226, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(142, 45, 226, 0.5)' },
  manaText: { color: '#E0AAFF', fontWeight: 'bold', marginLeft: 6, fontSize: 16 },
  
  // Monitor Styles
  monitorContainer: { backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#333', overflow: 'hidden', width: '100%' },
  monitorHeader: { flexDirection:'row', alignItems:'center', backgroundColor: '#ddd', padding: 12, justifyContent:'space-between', paddingHorizontal: 20 },
  
  // My Token Highlight
  myTokenBadge: { backgroundColor: '#2196f3', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },

  cardContainer: { marginBottom: 20, borderRadius: 20, shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  cardGradient: { padding: 20, borderRadius: 20, minHeight: 120, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  shopBadge: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10, alignSelf:'flex-start' },
  deleteBtn: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 20, marginBottom: 10 },
  shopText: { fontWeight: 'bold', fontSize: 10 },
  cardTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  cardDesc: { fontSize: 14, marginTop: 5, fontWeight: '500', opacity: 0.9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 25, padding: 25, flex: 1 },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  vibeBtn: { padding: 10, borderRadius: 10, marginRight: 10, borderWidth: 2 },
  payBtn: { marginTop: 20, padding: 16, borderRadius: 16, alignItems: 'center' },
  qrBox: { borderRadius: 25, padding: 25, alignItems: 'center' },
  bugReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: '#333' }
});