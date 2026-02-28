import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Switch, 
  TextInput, Linking, Modal, ScrollView, Image, RefreshControl, Platform, KeyboardAvoidingView, ActivityIndicator,
  Dimensions
} from 'react-native';
import { supabase } from '../lib/supabase';
import { LogOut, User, Shield, CreditCard, X, Save, Upload, CheckCircle, AlertCircle, UserCheck, Ban, Unlock, Lock, Instagram } from 'lucide-react-native';
import { isDevUser, setDevMode, getDevMode } from '../lib/devMode';
import TermsModal from '../components/TermsModal'; 
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useRef } from 'react';
import { useTheme } from '@react-navigation/native';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



export default function ProfileScreen({ session, isLockdown }: { session: any, isLockdown?: boolean }) {
  const { colors } = useTheme();
  // 🔔 Custom Alert State
const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');

const confirmActionRef = useRef<null | (() => void)>(null);

function showAlert(
  title: string,
  message: string,
  onConfirm?: () => void
) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertVisible(true);

  if (onConfirm) {
    confirmActionRef.current = onConfirm;
  } else {
    confirmActionRef.current = null;
  }
}
  const [profile, setProfile] = useState<any>(null);
  const [devEnabled, setDevEnabled] = useState(false);
  
  // Modals
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showTerms, setShowTerms] = useState(false); 
  const [uploading, setUploading] = useState(false);
  
  // Email Verification States
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');

  // ID Verification State
  const [ocrAttempts, setOcrAttempts] = useState(0);

  // MANA STATE
  const [showStoryTask, setShowStoryTask] = useState(false);
  const [tempUpi, setTempUpi] = useState('');

  // ADMIN STATE
  const [showVerifications, setShowVerifications] = useState(false);
  const [showBannedList, setShowBannedList] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [viewIdImage, setViewIdImage] = useState<string | null>(null);

  // Form State
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempRecoveryEmail, setTempRecoveryEmail] = useState('');

  const isDev = isDevUser(session?.user?.email || '');

  useEffect(() => {
    fetchProfile();
    loadDevSettings();
    if (isDev) { fetchVerifications(); fetchBannedUsers(); }
    checkIntro();
  }, []);

  async function fetchProfile() {
    if (!session?.user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) {
        setProfile(data);
        setTempName(data.full_name || '');
        setTempPhone(data.phone || '');
        setTempRecoveryEmail(data.recovery_email || '');
        setTempUpi(data.upi_id || '');
        
        // Update lockdown check to require is_email_verified instead of phone verification
        if (isLockdown && (!data.full_name || !data.phone || !data.recovery_email || !data.is_email_verified)) {
            setShowEditProfile(true);
        }
    }
  }

  async function checkIntro() {
      const { data } = await supabase.from('profiles').select('has_seen_intro').eq('id', session.user.id).single();
      if (data && !data.has_seen_intro) {
          setTimeout(() => setShowStoryTask(true), 1500);
      }
  }

  async function markStoryTaskDone() {
      setShowStoryTask(false);
      const { error } = await supabase.from('profiles').update({ has_seen_intro: true }).eq('id', session.user.id);
      if (!error) {
          showAlert("Awesome! 🚀", "Admin will verify your DM and add Mana soon.");
          fetchProfile();
      }
  }

  async function loadDevSettings() {
    const enabled = await getDevMode();
    setDevEnabled(enabled);
  }

  async function toggleDevMode(val: boolean) {
    setDevEnabled(val);
    await setDevMode(val);
    showAlert(val ? "Dev Mode ON 👨‍💻" : "Dev Mode OFF 🚫", val ? "Payments bypassed." : "Real payments active.");
  }

  async function fetchVerifications() {
      const { data } = await supabase.from('profiles').select('*').not('id_card_url', 'is', null).eq('is_verified', false).eq('is_banned', false);      
      if (data) setPendingVerifications(data);
  }

  async function fetchBannedUsers() {
      const { data } = await supabase.from('profiles').select('*').eq('is_banned', true);
      if (data) setBannedUsers(data);
  }

  async function verifyStudent(studentId: string, approve: boolean) {
      if (approve) {
          await supabase.from('profiles').update({ is_verified: true, is_banned: false }).eq('id', studentId);
          showAlert("Verified", "Student verified successfully! ✅");
      } else {
          await supabase.from('profiles').update({ id_card_url: null, is_verified: false, is_banned: true }).eq('id', studentId);
          showAlert("Banned", "ID Rejected. User BANNED. 🚫");
      }
      fetchVerifications(); fetchBannedUsers(); setViewIdImage(null);
  }

  async function unbanStudent(studentId: string) {
      await supabase.from('profiles').update({ is_banned: false, is_verified: false, id_card_url: null }).eq('id', studentId);
      showAlert("Unbanned", "User unbanned. They must upload ID again to order.");
      fetchBannedUsers(); fetchVerifications();
  }

  async function pickAndUploadID() {
      if (profile?.is_banned) { showAlert("Account Banned", "You cannot upload an ID while banned. Appeal via Chat."); return; }
      if (profile?.is_verified) { showAlert("Verified", "Your ID is already verified. You cannot change it."); return; }

      const result = await ImagePicker.launchImageLibraryAsync({ 
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          allowsEditing: true, 
          quality: 1, 
          base64: true 
      });

      if (result.canceled || !result.assets) return;
      
      const image = result.assets[0];
      if (!image.base64) { showAlert("Error", "Could not process image data."); return; }
      
      if ((image.base64.length * 0.75) / (1024 * 1024) > 2) { 
          showAlert("File Too Large", "Max 2MB allowed."); 
          return; 
      }

      setUploading(true);
      // Web-safe: Skip OCR, always send for manual verification
      const isWeb = Platform.OS === 'web';
      let isAiVerified = false;
      if (!isWeb) {
   // Only run OCR on mobile
   // You can re-add your TextRecognition logic here later
   // For now, we'll just mark all uploads as needing manual review
   
}
      
      try {
          

          const fileName = `${session.user.id}_${Date.now()}.jpg`;
          const { error } = await supabase.storage.from('id_cards').upload(fileName, decode(image.base64), { contentType: 'image/jpeg' });
          if (error) throw error;
          
          const { data: urlData } = supabase.storage.from('id_cards').getPublicUrl(fileName);
          
          await supabase.from('profiles').update({ 
              id_card_url: urlData.publicUrl, 
              is_verified: isAiVerified 
          }).eq('id', session.user.id);

          showAlert("Uploaded 📤", "ID Uploaded for Admin Verification.");

          fetchProfile();
      } catch (e: any) { 
          showAlert("Upload Failed", e.message); 
      } finally { 
          setUploading(false); 
      }
  }

  // 🟢 100% FREE SUPABASE EMAIL OTP LOGIC
  const sendEmailOtp = async () => {
      setSendingEmail(true);
      
      // Sends a 6-digit OTP to their logged-in email
      const { error } = await supabase.auth.signInWithOtp({ 
          email: session.user.email,
          options: { shouldCreateUser: false }
      });
      
      setSendingEmail(false);
      
      if (error) {
          showAlert("Failed to send OTP", error.message);
      } else {
          setEmailSent(true);
          showAlert("OTP Sent 📧", `Check your email (${session.user.email}) for the 6-digit code.`);
      }
  };

  const verifyEmailOtp = async () => {
      if (!emailCode || emailCode.length < 6) {
          showAlert("Invalid Code", "Please enter the 6-digit OTP from your email.");
          return;
      }
      
      setVerifyingEmail(true);
      
      // Verify the code
      const { error } = await supabase.auth.verifyOtp({ 
          email: session.user.email, 
          token: emailCode, 
          type: 'email' 
      });

      if (error) {
          setVerifyingEmail(false);
          showAlert("Verification Failed", "Incorrect or expired OTP.");
      } else {
          // Success! Mark account as verified
          await supabase.from('profiles').update({ 
              is_email_verified: true 
          }).eq('id', session.user.id);
          
          setVerifyingEmail(false);
          showAlert("Success! ✅", "Account securely verified and locked.");
          fetchProfile();
      }
  };

  async function saveProfile() {
      if (!tempName.trim()) { showAlert("Error", "Name is required."); return; }
      if (!tempPhone.trim() || tempPhone.length < 10) { showAlert("Error", "A valid Phone Number is required."); return; }
      if (!tempRecoveryEmail.trim() || !tempRecoveryEmail.includes('@')) { showAlert("Error", "A valid Recovery Email is required."); return; }
      
      const updateData: any = { 
          full_name: tempName,
          phone: tempPhone,
          recovery_email: tempRecoveryEmail.trim().toLowerCase()
      };

      const { error } = await supabase.from('profiles').update(updateData).eq('id', session.user.id);
      
      if (error) showAlert("Error", error.message);
      else { 
          showAlert("Success", "Profile Updated! ✅"); 
          if (profile?.is_email_verified) setShowEditProfile(false); 
          fetchProfile(); 
      }
  }

  async function savePayment() {
      if (!tempUpi.trim()) { showAlert("Error", "Enter valid UPI ID."); return; }
      const { error } = await supabase.from('profiles').update({ upi_id: tempUpi }).eq('id', session.user.id);
      if (error) showAlert("Error", error.message);
      else { showAlert("Success", "Payment Method Saved! 💳"); setShowPayment(false); fetchProfile(); }
  }

  const handleSignOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showAlert("Error", error.message);
  }
};

  async function handleWithdraw() {
      if ((profile?.mana_balance || 0) < 1000) {
          showAlert("Low Balance", "You need at least 1000 Mana to withdraw.");
          return;
      }

      const newBalance = (profile?.mana_balance || 0) - 1000;
      const { error } = await supabase.from('profiles').update({ mana_balance: newBalance }).eq('id', session.user.id);

      if (error) {
          showAlert("Error", "Could not deduct Mana.");
          return;
      }

      await supabase.from('withdrawals').insert({
          user_id: session.user.id,
          amount_mana: 1000,
          amount_rupees: 10,
          upi_id: profile?.phone || 'Unknown' 
      });

      const email = "office.sidequest26@gmail.com";
      const subject = "Mana Withdrawal";
      const body = `add mana to account ${profile.phone}`;
      const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      Linking.openURL(url).catch(err => {
          showAlert("Error", "Could not open mail app. Please manually email office.sidequest26@gmail.com");
      });

      showAlert("Success", "1000 Mana deducted. Email draft created.");
      fetchProfile();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Profile</Text>
        <TouchableOpacity 
            onPress={() => {
  showAlert(
    "Sign Out",
    "Are you sure you want to sign out?",
    handleSignOut
  );
}}
            style={{ padding: 10, backgroundColor: 'rgba(255, 71, 87, 0.1)', borderRadius: 12 }}
        >
            <LogOut size={22} color="#ff4757" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        
        {isLockdown && (
            <View style={{backgroundColor: '#FF9800', padding: 15, borderRadius: 12, marginBottom: 20, flexDirection:'row', alignItems:'center'}}>
                <Lock color="black" size={24} />
                <View style={{marginLeft: 10, flex: 1}}>
                    <Text style={{color: 'black', fontWeight: 'bold', fontSize: 16}}>Action Required</Text>
                    <View style={{ marginTop: 5 }}>
                        {!profile?.full_name && <Text style={{color: 'black', fontSize: 13}}>• Enter your Name</Text>}
                        {!profile?.phone && <Text style={{color: 'black', fontSize: 13}}>• Add Phone Number</Text>}
                        {!profile?.recovery_email && <Text style={{color: 'black', fontSize: 13}}>• Add Recovery Email</Text>}
                        {!profile?.is_email_verified && <Text style={{color: 'black', fontSize: 13}}>• Verify Account Email</Text>}
                        {!profile?.id_card_url && <Text style={{color: 'black', fontSize: 13}}>• Upload Student ID</Text>}
                    </View>
                </View>
            </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.avatar}><Text style={{ fontSize: 30 }}>{profile?.avatar_url ? '😎' : '👤'}</Text></View>
          <View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>{profile?.full_name || 'New Student'}</Text>
            <Text style={{ color: '#888' }}>{session?.user?.email}</Text>
            {profile?.is_banned && <Text style={{ color: '#ff4757', fontWeight: 'bold', marginTop: 5 }}>🚫 ACCOUNT BANNED</Text>}
          </View>
        </View>

        <View style={{backgroundColor: '#8E2DE2', padding: 20, borderRadius: 20, marginBottom: 20, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <View>
                <Text style={{color:'white', fontSize: 12, fontWeight:'bold', opacity: 0.8}}>MANA BALANCE</Text>
                <Text style={{color:'white', fontSize: 32, fontWeight:'bold'}}>⚡ {profile?.mana_balance || 0}</Text>
                <Text style={{color:'rgba(255,255,255,0.8)', fontSize: 12}}>≈ ₹{(profile?.mana_balance || 0) / 100}</Text>
            </View>
            <TouchableOpacity onPress={handleWithdraw} style={{backgroundColor:'white', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12}}>
                <Text style={{color:'#8E2DE2', fontWeight:'bold'}}>Withdraw</Text>
            </TouchableOpacity>
        </View>

        {isDev && (
          <View style={{marginBottom: 20}}>
              <TouchableOpacity onPress={() => { fetchVerifications(); setShowVerifications(true); }} style={[styles.card, { backgroundColor: 'rgba(255, 152, 0, 0.1)', borderColor: '#FF9800', borderWidth: 1, justifyContent:'space-between', marginBottom: 10 }]}>
                  <View style={{flexDirection:'row', alignItems:'center'}}><UserCheck size={24} color="#FF9800" /><View style={{marginLeft: 15}}><Text style={{fontSize: 18, fontWeight:'bold', color: '#FF9800'}}>Verify Students</Text><Text style={{color: '#FF9800', opacity: 0.8}}>{pendingVerifications.length} Pending</Text></View></View>
                  {pendingVerifications.length > 0 && <View style={{width:10, height:10, borderRadius:5, backgroundColor:'red'}} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { fetchBannedUsers(); setShowBannedList(true); }} style={[styles.card, { backgroundColor: 'rgba(244, 67, 54, 0.1)', borderColor: '#f44336', borderWidth: 1, justifyContent:'space-between' }]}>
                  <View style={{flexDirection:'row', alignItems:'center'}}><Ban size={24} color="#f44336" /><View style={{marginLeft: 15}}><Text style={{fontSize: 18, fontWeight:'bold', color: '#f44336'}}>Restricted Users</Text><Text style={{color: '#f44336', opacity: 0.8}}>{bannedUsers.length} Banned</Text></View></View>
              </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, flexDirection: 'column', alignItems: 'stretch', borderColor: (!profile?.id_card_url && isLockdown) ? '#FF9800' : 'transparent', borderWidth: (!profile?.id_card_url && isLockdown) ? 1 : 0 }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                <Text style={{fontSize: 16, fontWeight:'bold', color: colors.text}}>Student ID</Text>
                {profile?.is_banned ? (<View style={{flexDirection:'row', alignItems:'center'}}><Ban size={16} color="#f44336"/><Text style={{color:'#f44336', fontWeight:'bold', marginLeft:5}}>BANNED</Text></View>) : profile?.is_verified ? (<View style={{flexDirection:'row', alignItems:'center'}}><CheckCircle size={16} color="#00E676"/><Text style={{color:'#00E676', fontWeight:'bold', marginLeft:5}}>Verified</Text></View>) : profile?.id_card_url ? (<View style={{flexDirection:'row', alignItems:'center'}}><AlertCircle size={16} color="#FF9800"/><Text style={{color:'#FF9800', fontWeight:'bold', marginLeft:5}}>Pending</Text></View>) : (<View style={{flexDirection:'row', alignItems:'center'}}><AlertCircle size={16} color="#F44336"/><Text style={{color:'#F44336', fontWeight:'bold', marginLeft:5}}>Required</Text></View>)}
            </View>
            
            {profile?.is_banned ? (
                <View style={{backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: 15, borderRadius: 10}}><Text style={{color: '#f44336', fontWeight: 'bold', textAlign: 'center'}}>Your account is restricted.</Text><Text style={{color: '#f44336', textAlign: 'center', fontSize: 12, marginTop: 5}}>You cannot upload ID or place orders. Please contact support to appeal.</Text></View>
            ) : profile?.id_card_url ? (
                <View>
                    <Image source={{uri: profile.id_card_url}} style={{width: '100%', height: 150, borderRadius: 10, marginBottom: 10, opacity: 0.8}} resizeMode="cover" />
                    {!profile.is_verified && (
                        <TouchableOpacity onPress={pickAndUploadID} style={[styles.uploadBtn, {backgroundColor: '#333'}]}>
                            <Text style={{color: 'white'}}>Re-upload ID</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <TouchableOpacity onPress={pickAndUploadID} style={styles.uploadBtn}>
                    {uploading ? <ActivityIndicator color="black" /> : <Upload size={20} color="black" />}
                    <Text style={{color: 'black', fontWeight:'bold', marginLeft: 10}}>{uploading ? 'Uploading...' : 'Upload ID Card (Max 2MB)'}</Text>
                </TouchableOpacity>
            )}
        </View>

        <TouchableOpacity onPress={() => setShowEditProfile(true)} style={[styles.option, { borderBottomColor: '#333', backgroundColor: (isLockdown && (!profile?.full_name || !profile?.phone || !profile?.recovery_email || !profile?.is_email_verified)) ? 'rgba(255,152,0,0.1)' : 'transparent', borderRadius: 10 }]}>
            <User size={20} color={colors.text} />
            <View>
                <Text style={[styles.optionText, { color: colors.text }]}>Edit Profile</Text>
                {isLockdown && (!profile?.full_name || !profile?.phone || !profile?.recovery_email || !profile?.is_email_verified) && <Text style={{marginLeft: 15, color: '#FF9800', fontSize: 10}}>Required for access</Text>}
            </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowPayment(true)} style={[styles.option, { borderBottomColor: '#333' }]}><CreditCard size={20} color={colors.text} /><View><Text style={[styles.optionText, { color: colors.text }]}>Payment Methods</Text>{profile?.upi_id && <Text style={{marginLeft: 15, color: '#00E676', fontSize: 10}}>Linked: {profile.upi_id}</Text>}</View></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowTerms(true)} style={[styles.option, { borderBottomColor: '#333' }]}><Shield size={20} color={colors.text} /><Text style={[styles.optionText, { color: colors.text }]}>Terms & Conditions</Text></TouchableOpacity>
        
        {isDev && (<View style={[styles.card, { backgroundColor: 'rgba(255, 87, 34, 0.1)', borderColor: '#FF5722', borderWidth: 1, marginTop: 20 }]}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex:1 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Shield size={24} color="#FF5722" /><View style={{ marginLeft: 15 }}><Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FF5722' }}>God Mode</Text><Text style={{ color: '#FF5722', fontSize: 12, opacity: 0.8 }}>Bypass Payments</Text></View></View><Switch value={devEnabled} onValueChange={toggleDevMode} trackColor={{ false: "#767577", true: "#FF5722" }} thumbColor={devEnabled ? "#fff" : "#f4f3f4"} /></View></View>)}
      </ScrollView>

      {/* Modals */}
      <Modal visible={showVerifications} animationType="slide" presentationStyle="pageSheet"><View style={[styles.container, {backgroundColor: colors.background}]}><View style={styles.header}><Text style={{fontSize: 24, fontWeight:'bold', color: colors.text}}>Verify Students</Text><TouchableOpacity onPress={() => setShowVerifications(false)}><X size={24} color={colors.text}/></TouchableOpacity></View><FlatList data={pendingVerifications} keyExtractor={item => item.id} contentContainerStyle={{padding: 20}} ListEmptyComponent={<Text style={{textAlign:'center', color:'#888', marginTop:50}}>No pending verifications.</Text>} renderItem={({item}) => (<View style={[styles.card, {backgroundColor: colors.card, flexDirection:'column', alignItems:'stretch'}]}><View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}><View><Text style={{fontSize: 18, fontWeight:'bold', color: colors.text}}>{item.full_name || 'No Name'}</Text><Text style={{color:'#888'}}>{item.phone || 'No Phone'}</Text></View><View style={{backgroundColor:'#FF9800', paddingHorizontal:8, paddingVertical:4, borderRadius:6, alignSelf:'flex-start'}}><Text style={{color:'black', fontSize:10, fontWeight:'bold'}}>PENDING</Text></View></View><TouchableOpacity onPress={() => setViewIdImage(item.id_card_url)} style={{height: 150, backgroundColor:'#000', borderRadius:10, marginBottom: 15, justifyContent:'center', alignItems:'center'}}>{item.id_card_url ? (<Image source={{uri: item.id_card_url}} style={{width:'100%', height:'100%', borderRadius:10}} resizeMode="contain" />) : <Text style={{color:'white'}}>Image Error</Text>}</TouchableOpacity><View style={{flexDirection:'row', gap: 10}}><TouchableOpacity onPress={() => verifyStudent(item.id, false)} style={{flex:1, padding:12, borderRadius:8, borderWidth:1, borderColor:'#f44336', alignItems:'center'}}><Text style={{color:'#f44336', fontWeight:'bold'}}>Reject ❌</Text></TouchableOpacity><TouchableOpacity onPress={() => verifyStudent(item.id, true)} style={{flex:1, padding:12, borderRadius:8, backgroundColor:'#4caf50', alignItems:'center'}}><Text style={{color:'white', fontWeight:'bold'}}>Approve ✅</Text></TouchableOpacity></View></View>)} /></View></Modal>
      <Modal visible={showBannedList} animationType="slide" presentationStyle="pageSheet"><View style={[styles.container, {backgroundColor: colors.background}]}><View style={styles.header}><Text style={{fontSize: 24, fontWeight:'bold', color: '#f44336'}}>Restricted Users</Text><TouchableOpacity onPress={() => setShowBannedList(false)}><X size={24} color={colors.text}/></TouchableOpacity></View><FlatList data={bannedUsers} keyExtractor={item => item.id} contentContainerStyle={{padding: 20}} ListEmptyComponent={<Text style={{textAlign:'center', color:'#888', marginTop:50}}>No banned users.</Text>} renderItem={({item}) => (<View style={[styles.card, {backgroundColor: 'rgba(244, 67, 54, 0.1)', borderColor: '#f44336', borderWidth: 1, justifyContent:'space-between'}]}><View><Text style={{fontSize: 18, fontWeight:'bold', color: '#f44336'}}>{item.full_name || 'Unknown'}</Text><Text style={{color:'#f44336', opacity:0.8}}>{item.phone || 'No Phone'}</Text></View><TouchableOpacity onPress={() => unbanStudent(item.id)} style={{backgroundColor:'#f44336', padding:10, borderRadius:8}}><Unlock size={20} color="white" /></TouchableOpacity></View>)} /></View></Modal>
      <Modal visible={!!viewIdImage} transparent animationType="fade"><View style={{flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center'}}><TouchableOpacity onPress={() => setViewIdImage(null)} style={{position:'absolute', top:50, right:20, zIndex:10}}><X size={30} color="white" /></TouchableOpacity>{viewIdImage && <Image source={{uri: viewIdImage}} style={{width:SCREEN_WIDTH, height:500}} resizeMode="contain" />}</View></Modal>
      
      {/* 🟢 ENHANCED EDIT PROFILE MODAL */}
      <Modal visible={showEditProfile} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={[styles.modalContent, {backgroundColor: colors.card}]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 20}}>
                    <Text style={{fontSize: 22, fontWeight:'bold', color: colors.text}}>Edit Profile</Text>
                    <TouchableOpacity onPress={() => setShowEditProfile(false)}><X size={24} color={colors.text}/></TouchableOpacity>
                </View>
                
                <Text style={styles.label}>Full Name</Text>
                <TextInput 
                    value={tempName} 
                    onChangeText={setTempName} 
                    style={[styles.input, {color: colors.text, borderColor: colors.border}]} 
                    placeholder="e.g. Rahul Sharma" 
                    placeholderTextColor="#666"
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput 
                    value={tempPhone} 
                    onChangeText={setTempPhone} 
                    keyboardType="phone-pad" 
                    style={[styles.input, {color: colors.text, borderColor: colors.border}]} 
                    placeholder="e.g. 9999999999" 
                    placeholderTextColor="#666"
                />

                <Text style={styles.label}>Recovery Email *Required</Text>
                <TextInput 
                    value={tempRecoveryEmail} 
                    onChangeText={setTempRecoveryEmail} 
                    style={[styles.input, {color: colors.text, borderColor: colors.border, marginBottom: 30}]} 
                    placeholder="For password resets" 
                    placeholderTextColor="#666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <Text style={styles.label}>Account Email Verification</Text>
                {profile?.is_email_verified ? (
                    <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: '#00E676', borderRadius: 12, padding: 15, marginBottom: 20}}>
                        <CheckCircle size={20} color="#00E676" />
                        <Text style={{color: '#00E676', marginLeft: 10, fontWeight: 'bold', fontSize: 16}}>{session?.user?.email}</Text>
                        <Lock size={14} color="#00E676" style={{marginLeft: 'auto'}} />
                    </View>
                ) : (
                    <View style={{marginBottom: 20}}>
                        {!emailSent ? (
                            <TouchableOpacity onPress={sendEmailOtp} disabled={sendingEmail} style={{backgroundColor: '#0087FF', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                                {sendingEmail ? <ActivityIndicator color="white" /> : <Text style={{color: 'white', fontWeight: 'bold'}}>Verify Email: {session?.user?.email}</Text>}
                            </TouchableOpacity>
                        ) : (
                            <View>
                                <TextInput 
                                    value={emailCode} 
                                    onChangeText={setEmailCode} 
                                    keyboardType="number-pad" 
                                    style={[styles.input, {color: colors.text, borderColor: '#00E676', borderWidth: 2, marginBottom: 10, textAlign: 'center', fontSize: 24, letterSpacing: 5}]} 
                                    placeholder="000000" 
                                    placeholderTextColor="#666"
                                    maxLength={6}
                                />
                                <TouchableOpacity onPress={verifyEmailOtp} disabled={verifyingEmail} style={{backgroundColor: '#00E676', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                                    {verifyingEmail ? <ActivityIndicator color="black" /> : <Text style={{color: 'black', fontWeight: 'bold'}}>Verify Code</Text>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                
                <TouchableOpacity onPress={saveProfile} style={styles.saveBtn}>
                    <Save size={20} color="black" />
                    <Text style={{color:'black', fontWeight:'bold', marginLeft: 10}}>Save Changes</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPayment} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: colors.card}]}><View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 20}}><Text style={{fontSize: 22, fontWeight:'bold', color: colors.text}}>Payment Methods</Text><TouchableOpacity onPress={() => setShowPayment(false)}><X size={24} color={colors.text}/></TouchableOpacity></View><Text style={{color: '#888', marginBottom: 15}}>Add your UPI ID for refunds or payouts.</Text><Text style={styles.label}>UPI ID (VPA)</Text><TextInput value={tempUpi} onChangeText={setTempUpi} style={[styles.input, {color: colors.text, borderColor: colors.border}]} placeholder="e.g. rahul@okaxis" placeholderTextColor="#666" autoCapitalize="none"/><TouchableOpacity onPress={savePayment} style={styles.saveBtn}><CreditCard size={20} color="black" /><Text style={{color:'black', fontWeight:'bold', marginLeft: 10}}>Link UPI ID</Text></TouchableOpacity></View></KeyboardAvoidingView></Modal>
      
      <Modal visible={showStoryTask} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card, alignItems:'center'}]}>
                <View style={{width:60, height:60, borderRadius:30, backgroundColor:'#E1306C', justifyContent:'center', alignItems:'center', marginBottom:15}}>
                    <Instagram color="white" size={32} />
                </View>
                <Text style={{fontSize: 22, fontWeight:'bold', color: colors.text, textAlign:'center'}}>Get 200 Mana</Text>
                <Text style={{color:'#888', textAlign:'center', marginTop: 10, marginBottom: 20, lineHeight: 22}}>
                    1. Post our Reel to your Story.{'\n'}
                    2. Take a screenshot.{'\n'}
                    3. DM it to <Text style={{fontWeight:'bold', color:'#E1306C'}}>@side_quest26</Text>.
                </Text>
                <TouchableOpacity onPress={markStoryTaskDone} style={{backgroundColor:'#E1306C', padding: 15, borderRadius: 12, width:'100%', alignItems:'center'}}>
                    <Text style={{color:'white', fontWeight:'bold'}}>I have sent the DM</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowStoryTask(false)} style={{marginTop: 15}}>
                    <Text style={{color:'#888'}}>Remind me later</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
      {/* 🔔 Custom Alert Modal */}
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
      onPress={() => {
        setAlertVisible(false);
        if (confirmActionRef.current) {
            confirmActionRef.current();
        }
    }}
      >
        <Text style={{ color: 'black', fontWeight: 'bold' }}>
          OK
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} showAgreeButton={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { padding: 20, borderRadius: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
  optionText: { fontSize: 16, marginLeft: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, minHeight: 350 },
  label: { color: '#888', marginBottom: 5, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  saveBtn: { backgroundColor: '#00E676', padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  uploadBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }
});