import React, { useState, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
const hints = new Map();

hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.AZTEC
]);
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  RefreshControl, Modal, TextInput, ScrollView, Image, Dimensions, Linking, Platform, ImageBackground 
} from 'react-native';

import { supabase } from '../lib/supabase';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { 
  X, Zap, Store, Coffee, Lock, Trash2, CheckCircle, Bug, ScanBarcode, Ticket 
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;

// 🟢 THE CUSTOM AURORA V EVENT BACKGROUNDS
const BANNER_BG_URI = 'https://qcbjxivexhpxdxdvoekp.supabase.co/storage/v1/object/public/images/Screenshot%202026-03-05%20015450.png';
const ENTRY_TICKET_BG_URI = 'https://qcbjxivexhpxdxdvoekp.supabase.co/storage/v1/object/public/images/Screenshot%202026-03-05%20015713.png';
const FOOD_TICKET_BG_URI = 'https://qcbjxivexhpxdxdvoekp.supabase.co/storage/v1/object/public/images/image_2026-03-05_020007011.png';

// --- THEME FOR ADS ---
const VIBES: any = {
  'spicy': { id: 'spicy', label: 'Hot Deal', colors: ['#FF512F', '#DD2476'], icon: Zap, textColor: 'white' },
  'chill': { id: 'chill', label: 'Cool', colors: ['#4FACFE', '#00F2FE'], icon: Coffee, textColor: 'white' },
  'flash': { id: 'flash', label: 'Flash', colors: ['#F7971E', '#FFD200'], icon: Zap, textColor: 'black' }
};

export default function HomeScreen({ userEmail }: { userEmail: string }) {
  const { colors } = useTheme();

  // --- CONFIG ---
  const MY_UPI = "minecraftsreyash@oksbi"; 
  const AD_PRICE = 80; 
  const ADMIN_MAP: { [key: string]: string } = {
      '9066282034@campus.app': 'Five Star',
      '9686050312@campus.app': 'Ground View Cafe'
  };
  const [manualUSN, setManualUSN] = useState('');
  const safeEmail = userEmail ? userEmail.toLowerCase().trim() : '';
  const myShop = ADMIN_MAP[safeEmail];
  function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
  
   
  const isAdmin = !!myShop;

  // --- STATE ---
  const [profile, setProfile] = useState<any>({ id: null, full_name: 'Student', mana_balance: 0, is_aiml_verified: false, has_entered: false, food_claimed: false });
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
  const [adUtr, setAdUtr] = useState(''); 

  // 🟢 AURORA V EVENT STATE
  const [showAimlModal, setShowAimlModal] = useState(false);
  const [aimlName, setAimlName] = useState('');
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [isVerifyingAiml, setIsVerifyingAiml] = useState(false);
  const [isDecryptingRation, setIsDecryptingRation] = useState(false);
  

  useFocusEffect(
    useCallback(() => {
      fetchData();
      const interval = setInterval(() => { fetchData(); }, 60000); 
      return () => clearInterval(interval);
    }, [])
  );
  useEffect(() => {

if (Platform.OS === "web" && isScanningBarcode) {

const codeReader = new BrowserMultiFormatReader(hints, 800);

let controls: any;

codeReader.listVideoInputDevices().then((devices) => {

const backCamera = devices.find(d =>
  d.label.toLowerCase().includes("back")
);

const deviceId = backCamera
  ? backCamera.deviceId
  : devices[0]?.deviceId;

codeReader
.decodeFromVideoDevice(deviceId, "qr-reader", (result, err) => {

if (result) {

if (controls) controls.stop();

handleBarcodeScanned({
type: "barcode",
data: result.getText()
});

}

if (err && err.name !== "NotFoundException") {
console.error(err);
}

})
.then(ctrl => {
controls = ctrl;
});

});
return () => {
if (controls) {
controls.stop();
}
};

}

}, [isScanningBarcode]);

  useEffect(() => {
    const channel = supabase
      .channel('public:errands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'errands' }, (payload) => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    // 🟢 1. GET BASE PROFILE
    const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, mana_balance')
        .eq('email', safeEmail)
        .single();
        
    if (!userData) return;

    // 🟢 2. GET EVENT TICKET DATA (NEW TABLE)
    const { data: ticketData } = await supabase
        .from('aurora_tickets')
        .select('*')
        .eq('profile_id', userData.id)
        .single();

    // 🟢 3. MERGE STATE
    setProfile({
        id: userData.id,
        mana_balance: userData.mana_balance,
        full_name: ticketData ? ticketData.full_name : userData.full_name,
        is_aiml_verified: !!ticketData, // If row exists, they are verified
        has_entered: ticketData ? ticketData.has_entered : false,
        food_claimed: ticketData ? ticketData.food_claimed : false
    });

    const { data: orders } = await supabase
        .from('errands')
        .select('token_no, status, shop_name, student_id, updated_at')
        .in('status', ['cooking', 'ready', 'picked_up', 'delivered'])
        .order('updated_at', { ascending: false });
        
    if (orders) {
        const now = Date.now();
        const validLiveOrders = orders.filter(o => {
            if (o.status === 'cooking' || o.status === 'ready') return true;
            return (now - new Date(o.updated_at).getTime()) <= (5 * 60 * 1000); 
        });
        setLiveOrders(validLiveOrders);
    }

    const { data: ads } = await supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false });
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
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        await supabase.from('promotions').delete().eq('id', id);
        fetchData();
      }
    }
  ]);
};

  const handleReportBug = () => {
      const subject = "SideQuest Bug Report";
      const body = "Please describe the issue you are facing:\n\n";
      Linking.openURL(`mailto:office.sidequest@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // 🟢 EVENT ACTIONS
  const handleProceedToScanner = () => {

  if (!aimlName || aimlName.trim().length === 0) {
    showAlert(
      "Name Required",
      "Please enter your name before scanning your ID card."
    );
    return;
  }

  setIsScanningBarcode(true);

};

  const handleBarcodeScanned = async ({ type, data }: { type: string, data: string }) => {
      if (isVerifyingAiml) return; 
      setIsVerifyingAiml(true);
      const scannedData = data.toUpperCase().trim();

const usnPattern = /^[0-9]NC[0-9]{2}CI[0-9]{3}$/;

if (!usnPattern.test(scannedData)) {
  showAlert(
"Invalid USN",
"Example:\n1NC23CI057\n1NC24CI057"
);
return;
}

      try {
          if (profile.is_aiml_verified) {
              // 🚪 DOOR NODE SCANNING LOGIC (UPDATED TABLE)
              if (scannedData.includes("AIML_NODE_UPLINK_99")) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await supabase.from('aurora_tickets').update({ has_entered: true }).eq('profile_id', profile.id);
                  setProfile((prev: any) => ({ ...prev, has_entered: true }));
                  setIsScanningBarcode(false);
                  showAlert("ENTRY SECURED", "Welcome to the Fresher's Party.");
              } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  setIsScanningBarcode(false);
                  showAlert("INVALID DOOR NODE", "This is not the correct entry QR code.");
              }
          } else {
              // 🆔 ID CARD BARCODE LOGIC 
              if (scannedData.includes("CI")) {
                  
                  // 🟢 THE ANTI-CHEAT DATABASE LOCK (INSERT NEW ROW)
                  const { error } = await supabase.from('aurora_tickets').insert({ 
                      profile_id: profile.id,
                      usn: scannedData,
                      full_name: aimlName,
                      has_entered: false, 
                      food_claimed: false 
                  });

                  if (error) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      setIsScanningBarcode(false);
                      // 23505 is the Postgres code for Unique Constraint Violation!
                      if (error.code === '23505') {
                          showAlert("SECURITY ALERT 🚨", "This ID Card has already been claimed by another device!");
                      } else {
                          showAlert("Database Error", "Network failed. Try again.");
                      }
                      setIsVerifyingAiml(false);
                      return;
                  }

                  // If insert succeeds:
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setProfile((prev: any) => ({ 
                      ...prev, 
                      is_aiml_verified: true, 
                      full_name: aimlName,
                      has_entered: false,
                      food_claimed: false 
                  }));
                  
                  setIsScanningBarcode(false);
                  showAlert("ACCESS GRANTED", `Verified USN: ${scannedData}\n\nPass Generated Successfully.`);
              } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  setIsScanningBarcode(false); 
                  showAlert("ACCESS DENIED", "Non-AIML entity detected.");
              }
          }
      } catch (e: any) { showAlert("Error", "Network failed. Try again."); }
      setIsVerifyingAiml(false);
  };
  async function handleManualUSNSubmit() {

  const usn = manualUSN.toUpperCase().trim();

  const usnPattern = /^[0-9]NC[0-9]{2}CI[0-9]{3}$/;

  if (!usnPattern.test(usn)) {
    showAlert(
      "Invalid USN",
      "Example:\n1NC23CI057\n1NC24CI057"
    );
    return;
  }

  const { data } = await supabase
    .from("aurora_tickets")
    .select("usn")
    .eq("usn", usn)
    .single();

  if (data) {
    showAlert(
      "USN Already Exists",
      "Please enter correct USN"
    );
    return;
  }

  const { error } = await supabase
    .from("aurora_tickets")
    .insert({
      profile_id: profile.id,
      usn: usn,
      full_name: aimlName,
      has_entered: false,
      food_claimed: false
    });

  if (error) {
    showAlert("Database error", "Failed to generate pass.");
    return;
  }

  showAlert("Pass generated successfully", "Your pass has been generated successfully.");

  setProfile((prev:any)=>({
    ...prev,
    is_aiml_verified:true,
    full_name:aimlName
  }));

  setManualUSN("");
}

  const handleClaimFood = async () => {
      Alert.alert("REDEEM MEAL VOUCHER?", "Do not activate this until you are at the food counter. This action burns your ticket.", [
          { text: "CANCEL", style: "cancel" },
          { text: "REDEEM", style: "destructive", onPress: async () => {
              setIsDecryptingRation(true);
              for(let i=0; i<3; i++) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); await new Promise(r => setTimeout(r, 400)); }
              try {
                  // 🟢 BURN TICKET IN NEW TABLE
                  const { error } = await supabase.from('aurora_tickets').update({ food_claimed: true }).eq('profile_id', profile.id);
                  if (error) throw error;
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setProfile((prev: any) => ({ ...prev, food_claimed: true }));
              } catch (e: any) { showAlert("Error", "Network failed."); }
              setIsDecryptingRation(false);
          }}
      ]);
  };

  // --- COMPONENTS ---

  const OrderColumn = ({ title, color, orders }: { title: string, color: string, orders: any[] }) => (
      <View style={{flex: 1, paddingHorizontal: 5}}>
          <Text style={{color: color, fontWeight:'bold', fontSize: 12, marginBottom: 8, textAlign:'center', letterSpacing:1}}>{title}</Text>
          {orders.length === 0 ? <Text style={{color:'#333', textAlign:'center', fontSize: 10}}>-</Text> : orders.map((o, i) => {
              const isMine = o.student_id === profile.id;
              return (
                  <View key={i} style={isMine ? styles.myTokenBadge : null}>
                      <Text style={{color: isMine ? 'black' : 'white', fontSize: 22, fontWeight:'bold', textAlign:'center', marginBottom: 4}}>{o.token_no.replace('#', '')}</Text>
                      {isMine && <Text style={{color:'black', fontSize:8, textAlign:'center', fontWeight:'bold'}}>YOU</Text>}
                  </View>
              )
          })}
      </View>
  );

  const ShopMonitor = ({ name, dbName, icon }: { name: string, dbName: string, icon: any }) => {
      const isOpen = shopStates[dbName] !== false;
      const shopOrders = liveOrders.filter(o => o.shop_name === dbName);
      const cooking = shopOrders.filter(o => o.status === 'cooking');
      const ready = shopOrders.filter(o => ['ready', 'picked_up', 'delivered'].includes(o.status));
      return (
          <View style={[styles.monitorContainer, !isOpen && {borderColor: '#d32f2f', borderWidth: 2}]}>
              <View style={[styles.monitorHeader, !isOpen && {backgroundColor: '#ffcdd2'}]}>
                  <View style={{flexDirection:'row', alignItems:'center'}}>{icon}<Text style={{color:'black', fontWeight:'bold', marginLeft: 8, fontSize: 18}}>{name.toUpperCase()}</Text></View>
                  {!isOpen && <Text style={{color:'#d32f2f', fontWeight:'bold', fontSize: 12, borderWidth:1, borderColor:'#d32f2f', paddingHorizontal:6, borderRadius:4}}>CLOSED</Text>}
              </View>
              {!isOpen ? <View style={{flex: 1, justifyContent:'center', alignItems:'center', minHeight: 100, backgroundColor: '#1a1a1a'}}><Lock size={32} color="#ef5350" /><Text style={{color:'#ef5350', fontWeight:'bold', fontSize: 16, marginTop: 10, letterSpacing: 2}}>CLOSED</Text></View> : <View style={{flexDirection:'row', paddingTop: 15, paddingBottom: 15}}><OrderColumn title="PREPARING" color="#FF9800" orders={cooking} /><View style={{width: 1, backgroundColor:'#333'}} /><OrderColumn title="READY" color="#00E676" orders={ready} /></View>}
          </View>
      );
  };

  const PromoCard = ({ item }: { item: any }) => {
    const theme = VIBES[item.bg_color] || VIBES['spicy'];
    const isOwner = myShop === item.shop_name; 
    return (
      <View style={styles.cardContainer}>
          <LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
             <View style={styles.cardHeader}><View style={styles.shopBadge}><Text style={[styles.shopText, {color: theme.textColor}]}>{item.shop_name}</Text></View>{isOwner && (<TouchableOpacity onPress={() => handleDeleteAd(item.id)} style={styles.deleteBtn}><Trash2 size={18} color={theme.textColor} /></TouchableOpacity>)}</View>
             <Text style={[styles.cardTitle, {color: theme.textColor}]} numberOfLines={2}>{item.title}</Text>
             <Text style={[styles.cardDesc, {color: theme.textColor}]} numberOfLines={2}>{item.description}</Text>
          </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
          <View>
              <Text style={{color: '#888', fontSize: 14}}>Welcome back,</Text>
              <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.text}}>{profile.full_name ? profile.full_name.split(' ')[0] : 'User'}</Text>
          </View>
          <View style={styles.manaBadge}><Zap size={16} color="#FFD700" fill="#FFD700" /><Text style={styles.manaText}>{profile.mana_balance || 0}</Text></View>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 100}} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => {setLoading(true); fetchData(); setLoading(false);}} tintColor={colors.primary} />}>
          
          <View style={{paddingHorizontal: 20, marginBottom: 25}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                  <Text style={{color:'#888', fontWeight:'bold', fontSize: 12, letterSpacing: 1}}>LIVE ORDER BOARD</Text>
                  <View style={{flexDirection:'row', gap:10}}><View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, borderRadius:4, backgroundColor:'#FF9800', marginRight:4}}/><Text style={{color:'#666', fontSize:10}}>Cooking</Text></View><View style={{flexDirection:'row', alignItems:'center'}}><View style={{width:8, height:8, borderRadius:4, backgroundColor:'#00E676', marginRight:4}}/><Text style={{color:'#666', fontSize:10}}>Ready</Text></View></View>
              </View>
              <View style={{flexDirection:'column', gap: 20}}>
                  <ShopMonitor name="Five Star" dbName="Five Star" icon={<Store size={20} color="black"/>} />
                  <ShopMonitor name="Ground View" dbName="Ground View Cafe" icon={<Coffee size={20} color="black"/>} />
              </View>
          </View>

          <View style={{paddingHorizontal: 20}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                  <Text style={{color: colors.text, fontWeight:'bold', fontSize: 18}}>Campus Buzz ⚡</Text>
                  {isAdmin && (<TouchableOpacity onPress={() => setShowModal(true)}><Text style={{color: colors.primary, fontWeight:'bold'}}>+ Post Ad</Text></TouchableOpacity>)}
              </View>

              {/* 🟢 REDESIGNED AURORA BANNER */}
              <TouchableOpacity onPress={() => setShowAimlModal(true)} style={styles.eventBannerBtn} activeOpacity={0.8}>
                  <ImageBackground source={{ uri: BANNER_BG_URI }} style={styles.eventBannerBg} imageStyle={{ borderRadius: 16 }}>
                      <View style={styles.eventBannerOverlay}>
                          <Ticket size={32} color="#FFF" />
                          <View style={{marginLeft: 15, flex: 1}}>
                              <Text style={styles.eventBannerTitle}>AURORA V : FRESHER'S EVENT</Text>
                              <Text style={styles.eventBannerSub}>Tap to access your event passes</Text>
                          </View>
                      </View>
                  </ImageBackground>
                  
              </TouchableOpacity>

              {promos.length === 0 ? <Text style={{color:'#666', fontStyle:'italic', marginTop: 15}}>Quiet day on campus...</Text> : <View style={{marginTop: 15}}>{promos.map(item => <PromoCard key={item.id} item={item} />)}</View>}
          </View>

          {/* BUG REPORT */}
          <View style={{paddingHorizontal: 20, marginTop: 15, alignItems:'flex-end'}}>
              <TouchableOpacity onPress={handleReportBug} style={styles.bugReportBtn}>
                  <Bug size={16} color="#666" style={{marginRight: 8}} />
                  <Text style={{color: '#666', fontSize: 12, fontWeight: 'bold'}}>Report a Bug</Text>
              </TouchableOpacity>
          </View>
      </ScrollView>

      {/* 🟢 REDESIGNED EVENT TICKET MODAL */}
      <Modal visible={showAimlModal} transparent animationType="slide" onRequestClose={() => {setShowAimlModal(false); setIsScanningBarcode(false);}}>
          <View style={styles.modalBackdrop}>
              <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalHeaderTitle}>EVENT PORTAL</Text>
                  <TouchableOpacity onPress={() => {setShowAimlModal(false); setIsScanningBarcode(false);}}><X size={28} color="#FFF" /></TouchableOpacity>
              </View>

              {isScanningBarcode ? (
                  <View style={styles.scannerContainer}>
                      <View style={{ width: "100%", height: 320 }}>
                        <video
id="qr-reader"
playsInline
muted
style={{
width: "100%",
height: "320px",
objectFit: "cover",
maxWidth: "100%"
}}
/>
</View>
                      <View style={styles.scannerTarget} />
                      <TouchableOpacity onPress={() => setIsScanningBarcode(false)} style={styles.cancelScanBtn}><Text style={styles.cancelScanText}>CANCEL SCAN</Text></TouchableOpacity>
                  </View>
              ) : (profile.has_entered && profile.is_aiml_verified) ? (
                  /* 🟢 PHASE 3 & 4: HORIZONTAL MEAL VOUCHER TICKET */
                  <View style={styles.ticketWrapper}>
                      <ImageBackground source={{ uri: FOOD_TICKET_BG_URI }} style={styles.ticketBg} imageStyle={{ borderRadius: 16 }}>
                          <View style={[styles.ticketTint, { backgroundColor: profile.food_claimed ? 'rgba(0,0,0,0.85)' : 'rgba(150, 100, 0, 0.4)' }]} />
                          
                          {/* Stub Left */}
                          <View style={styles.ticketStub}>
                              <Text style={[styles.stubText, {color: profile.food_claimed ? '#555' : '#FFD700'}]}>
                                  {profile.food_claimed ? 'VOID - VOID' : 'VALID - VALID'}
                              </Text>
                          </View>

                          {/* Dashed Line & Punches */}
                          <View style={styles.ticketDivider}>
                              <View style={styles.punchHoleTop} />
                              <View style={styles.punchHoleBottom} />
                          </View>

                          {/* Body Right */}
                          <View style={styles.ticketBody}>
                              <Text style={styles.ticketCollegeText}>AURORA V</Text>
                              <Text style={[styles.ticketMainTitle, { color: profile.food_claimed ? '#666' : '#FFF', fontSize: 24 }]}>MEAL VOUCHER</Text>
                              <Text style={styles.ticketSubTitle}>1 NUTRITIONAL UNIT</Text>
                              
                              <View style={{ marginTop: 'auto' }}>
                                  <Text style={styles.ticketLabel}>ISSUED TO</Text>
                                  <Text style={[styles.ticketValue, {color: profile.food_claimed ? '#666' : '#FFF'}]}>{profile.full_name}</Text>
                              </View>

                              {profile.food_claimed && (
                                  <View style={styles.redeemedStamp}><Text style={styles.redeemedStampText}>REDEEMED</Text></View>
                              )}
                          </View>
                      </ImageBackground>

                      {!profile.food_claimed ? (
                          <TouchableOpacity onPress={handleClaimFood} disabled={isDecryptingRation} style={styles.goldActionBtn}>
                              <Text style={styles.goldActionText}>{isDecryptingRation ? "PROCESSING..." : "REDEEM AT FOOD COUNTER"}</Text>
                          </TouchableOpacity>
                      ) : (
                          <Text style={styles.bottomWarningRed}>This voucher has been consumed.</Text>
                      )}
                  </View>

              ) : profile.is_aiml_verified ? (
                  /* 🟢 PHASE 2: HORIZONTAL ENTRY TICKET */
                  <View style={styles.ticketWrapper}>
                      <ImageBackground source={{ uri: ENTRY_TICKET_BG_URI }} style={styles.ticketBg} imageStyle={{ borderRadius: 16 }}>
                          <View style={styles.ticketTint} />
                          
                          {/* Stub Left */}
                          <View style={styles.ticketStub}>
                              <Text style={styles.stubText}>NCET CSE(AI&ML)</Text>
                          </View>

                          {/* Dashed Line & Punches */}
                          <View style={styles.ticketDivider}>
                              <View style={styles.punchHoleTop} />
                              <View style={styles.punchHoleBottom} />
                          </View>

                          {/* Body Right */}
                          <View style={styles.ticketBody}>
                              <Text style={styles.ticketCollegeText}>Department of CSE(AI&ML) Presents</Text>
                              <Text style={styles.ticketMainTitle}>AURORA V</Text>
                              <Text style={styles.ticketSubTitle}>6th MARCH 2026</Text>
                              
                              <View style={styles.ticketDataRow}>
                                  <View>
                                      <Text style={styles.ticketLabel}>GUEST</Text>
                                      <Text style={styles.ticketValue}>{profile.full_name}</Text>
                                  </View>
                                  <View style={styles.statusBadge}>
                                      <Text style={styles.statusBadgeText}>PENDING CHECK-IN</Text>
                                  </View>
                              </View>
                          </View>
                      </ImageBackground>

                      <TouchableOpacity onPress={() => setIsScanningBarcode(true)} style={styles.primaryActionBtn}>
                          <ScanBarcode size={20} color="black" style={{marginRight: 10}} />
                          <Text style={styles.primaryActionText}>SCAN DOOR QR TO ENTER</Text>
                      </TouchableOpacity>
                  </View>

              ) : (
                  /* 🟢 PHASE 1: REGISTRATION CARD */
                  <View style={styles.registrationCard}>
  <ImageBackground
    source={{ uri: BANNER_BG_URI }}
    style={styles.ticketBg}
    imageStyle={{ borderRadius: 16 }}
  >

    <View style={[styles.ticketTint, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />

    <ScrollView contentContainerStyle={{ padding: 25 }}>

      <Text style={styles.ticketMainTitle}>INITIALIZE UPLINK</Text>

      <Text style={[styles.ticketSubTitle, { marginBottom: 20 }]}>
        Enter credentials to generate your pass.
      </Text>

      <Text style={styles.inputLabel}>STUDENT NAME</Text>

      <TextInput
autoFocus
style={styles.elegantInput}
value={aimlName}
onChangeText={setAimlName}
placeholderTextColor="#888"
placeholder="e.g. Sreyash"
/>

      <TouchableOpacity
        onPress={handleProceedToScanner}
        style={[styles.primaryActionBtn, { marginTop: 20 }]}
      >
        <ScanBarcode size={20} color="black" style={{ marginRight: 10 }} />
        <Text style={styles.primaryActionText}>SCAN ID CARD</Text>
      </TouchableOpacity>

      <Text style={{ color: "#CCC", marginTop: 20 }}>
        Emergency Manual USN Entry
      </Text>

      <TextInput
        value={manualUSN}
        onChangeText={setManualUSN}
        placeholder="Example: 1NC23CI057"
        placeholderTextColor="#888"
        autoCapitalize="characters"
        style={styles.elegantInput}
      />

      <TouchableOpacity
        onPress={handleManualUSNSubmit}
        style={[styles.primaryActionBtn, { marginTop: 10 }]}
      >
        <Text style={styles.primaryActionText}>SUBMIT USN</Text>
      </TouchableOpacity>

    </ScrollView>

  </ImageBackground>
</View>
              )}
          </View>
      </Modal>

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
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  manaBadge: { flexDirection:'row', alignItems:'center', backgroundColor: 'rgba(142, 45, 226, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(142, 45, 226, 0.5)' },
  manaText: { color: '#E0AAFF', fontWeight: 'bold', marginLeft: 6, fontSize: 16 },
  
  // 🟢 REDESIGNED EVENT BANNER
  eventBannerBtn: { shadowColor: '#4FACFE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, marginBottom: 5 },
  eventBannerBg: { height: 90, width: '100%', borderRadius: 16 },
  eventBannerOverlay: { flex: 1, backgroundColor: 'rgba(0,10,30,0.65)', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  eventBannerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  eventBannerSub: { color: '#CCC', fontSize: 12, fontWeight: '500', marginTop: 4 },

  // 🟢 REDESIGNED MODAL OVERLAY
  modalBackdrop: { flex: 1, backgroundColor: '#050A1F', padding: 20 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 50, marginBottom: 40 },
  modalHeaderTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 3, opacity: 0.8 },

  // 🟢 THE HORIZONTAL TICKET UI
  ticketWrapper: { alignItems: 'center', width: '100%' },
  ticketBg: { width: '100%', height: 220, borderRadius: 16, flexDirection: 'row', overflow: 'hidden' },
  ticketTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,10,40,0.5)' },
  
  ticketStub: { width: 60, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0 },
  stubText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', letterSpacing: 4, width: 200, textAlign: 'center', transform: [{ rotate: '-90deg' }], opacity: 0.7 },
  
  ticketDivider: { width: 2, height: '100%', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', position: 'relative', zIndex: 10 },
  punchHoleTop: { position: 'absolute', top: -12, left: -11, width: 24, height: 24, borderRadius: 12, backgroundColor: '#050A1F' },
  punchHoleBottom: { position: 'absolute', bottom: -12, left: -11, width: 24, height: 24, borderRadius: 12, backgroundColor: '#050A1F' },
  
  ticketBody: { flex: 1, padding: 20, justifyContent: 'center' },
  ticketCollegeText: { color: '#CCC', fontSize: 10, letterSpacing: 1, fontWeight: '600' },
  ticketMainTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  ticketSubTitle: { color: '#4FACFE', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
  
  ticketDataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' },
  ticketLabel: { color: '#AAA', fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  ticketValue: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  statusBadge: { backgroundColor: 'rgba(255, 215, 0, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FFD700' },
  statusBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  // Redemeed Stamp
  redeemedStamp: { position: 'absolute', right: 20, bottom: 20, transform: [{ rotate: '-15deg' }], borderWidth: 3, borderColor: '#FF003C', padding: 8, borderRadius: 8 },
  redeemedStampText: { color: '#FF003C', fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  // Buttons & Inputs
  primaryActionBtn: { backgroundColor: '#FFF', width: '100%', padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  primaryActionText: { color: 'black', fontWeight: '900', letterSpacing: 1, fontSize: 14 },
  
  goldActionBtn: { backgroundColor: '#FFD700', width: '100%', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 30, shadowColor: '#FFD700', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  goldActionText: { color: 'black', fontWeight: '900', letterSpacing: 1, fontSize: 14 },

  registrationCard: { width: '100%',  borderRadius: 16, overflow: 'hidden' },
  inputLabel: { color: '#CCC', fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  elegantInput: {
  color: '#FFF',
  borderBottomWidth: 1,
  borderColor: 'rgba(255,255,255,0.6)',
  paddingVertical: 12,
  fontSize: 16,
  backgroundColor: 'transparent'
},

  bottomWarningRed: { color: '#FF003C', fontSize: 12, textAlign: 'center', marginTop: 20, fontWeight: 'bold', letterSpacing: 1 },

  // Scanner
  scannerContainer: { height: 400, width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#4FACFE' },
  scannerTarget: { position: 'absolute', top: '25%', left: '10%', width: '80%', height: '50%', borderWidth: 2, borderColor: 'rgba(79, 172, 254, 0.6)', borderStyle: 'dashed', borderRadius: 12 },
  cancelScanBtn: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 20, borderWidth: 1, borderColor: '#FFF' },
  cancelScanText: { color: '#FFF', fontWeight: 'bold', letterSpacing: 1 },

  // Generic
  monitorContainer: { backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#333', overflow: 'hidden', width: '100%' },
  monitorHeader: { flexDirection:'row', alignItems:'center', backgroundColor: '#ddd', padding: 12, justifyContent:'space-between', paddingHorizontal: 20 },
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