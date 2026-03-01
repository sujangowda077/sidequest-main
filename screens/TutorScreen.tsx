import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, ScrollView, Image, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { X, Check, MapPin, Plus, Key, DollarSign, Globe, Zap, Trash2, Phone, BookOpen, Cpu, Briefcase } from 'lucide-react-native';

// 🟢 IMPORT OUR PUSH HELPERS
import { notifyAll, notifyUser } from '../lib/push';

interface TutorScreenProps {
  userId: string;
  isProfileComplete: boolean; 
}

export default function TutorScreen({ userId, isProfileComplete }: TutorScreenProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [hiddenRequests, setHiddenRequests] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'market' | 'activity'>('market'); 

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Data Holders
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [otpInput, setOtpInput] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [payAmount, setPayAmount] = useState(0);

  // Form State
  const [topic, setTopic] = useState(''); 
  const [description, setDescription] = useState(''); 
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Math');

  // 🟢 EXPANDED SUBJECTS LIST
  const CATEGORIES = [
    'Math', 'Programming', 'DSA', 'ML', 
    'Circuits', 'Mechanics', 'Thermodynamics', 'Physics',
    'Chemistry', 'Biology', 'Economics', 'Design',
    'Projects', 'Assignments', 'Exam Prep'
  ];

  useEffect(() => {
    fetchRequests();
    const sub = supabase.channel('tutor_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutor_requests' }, fetchRequests)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function fetchRequests() {
    const { data } = await supabase
      .from('tutor_requests')
      .select('*, profiles:student_id(full_name, room_no, phone), tutor:tutor_id(full_name, upi_id, phone)')
      .order('created_at', { ascending: false });

    if (data) setRequests(data);
  }

  // --- ACTIONS ---
  async function postBounty() {
    // 🛑 GATEKEEPER CHECK
    if (!isProfileComplete) {
        Alert.alert("Profile Incomplete 🛑", "Please complete your profile (Name, Phone, ID) first.");
        return;
    }

    if (!topic || !price || !description) { Alert.alert('Missing Info', 'Please fill out all fields.'); return; }
    
    const secretOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const fullTopicString = `[${category}] ${topic} | ${description}`;

    const { error } = await supabase.from('tutor_requests').insert({
      student_id: userId,
      topic: fullTopicString, 
      offer_price: Number(price),
      status: 'open',
      completion_otp: secretOtp
    });

    if (!error) {
      // 🟢 SHOTGUN PUSH: Notify entire campus of new bounty
      await notifyAll("New Tutor Bounty! 📚", `${category}: ${topic} - Earn ₹${price}`);

      setModalVisible(false);
      setTopic(''); setPrice(''); setDescription('');
      setViewMode('activity'); 
      Alert.alert('Bounty Posted!', 'Check "My Activity" for your secret OTP.');
    } else {
      Alert.alert('Error', error.message);
    }
  }

  async function deleteBounty(id: string) {

  const performDelete = async () => {
    const { error } = await supabase
      .from('tutor_requests')
      .delete()
      .eq('id', id)
      .eq('student_id', userId);

    if (!error) {
      Alert.alert("Deleted", "Bounty removed.");
    } else {
      Alert.alert("Error", "Could not delete.");
    }
  };

  // ✅ WEB FIX
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(
      "Delete Bounty?\n\nThis will remove the request permanently."
    );

    if (confirmed) {
      await performDelete();
    }
  } 
  // ✅ MOBILE (APK)
  else {
    Alert.alert(
      "Delete Bounty?",
      "This will remove the request permanently.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete }
      ]
    );
  }
}

  async function acceptBounty(item: any) {
    // 🛑 GATEKEEPER CHECK
    if (!isProfileComplete) {
        Alert.alert("Profile Incomplete 🛑", "Tutors must have a verified profile.");
        return;
    }

    Alert.alert('Accept Bounty', 'Do you want to take this job? Your contact info will be shared.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Accept', 
        onPress: async () => {
          const { error } = await supabase.from('tutor_requests').update({ status: 'accepted', tutor_id: userId }).eq('id', item.id);
          if (!error) {
              // 🟢 SNIPER PUSH: Tell the student a tutor was found
              await notifyUser(item.student_id, "Tutor Found! 👨‍🏫", "Someone accepted your bounty. Check the app!");

              Alert.alert('Success!', 'Job Accepted. Check "My Activity" for student details.');
              setViewMode('activity');
          }
        }
      }
    ]);
  }

  async function verifyOtp() {
    if (!selectedRequest || !otpInput) return;
    if (otpInput === selectedRequest.completion_otp) {
        const { error } = await supabase.from('tutor_requests').update({ status: 'payment_pending' }).eq('id', selectedRequest.id);
        if (!error) {
            // 🟢 SNIPER PUSH: Tell the student the job is done and they need to pay
            await notifyUser(selectedRequest.student_id, "Bounty Completed! ✅", "Your tutor finished the task. Please proceed to payment.");

            setOtpModalVisible(false);
            setOtpInput('');
            Alert.alert("Verified!", "The student can now pay you.");
        }
    } else {
        Alert.alert("Wrong OTP", "Please ask the student for the correct 4-digit code.");
    }
  }

  function openPaymentModal(item: any) {
      if (!item.tutor?.upi_id) { Alert.alert("No UPI", "This tutor hasn't added a UPI ID. Please pay Cash."); return; }
      const amount = item.offer_price;
      const upiLink = `upi://pay?pa=${item.tutor.upi_id}&pn=${encodeURIComponent(item.tutor.full_name)}&am=${amount}&cu=INR`;
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`;
      setSelectedRequest(item); setQrUrl(qr); setPayAmount(amount); setShowQRModal(true);
  }

  async function markPaid() {
      if(!selectedRequest) return;
      const { error } = await supabase.from('tutor_requests').update({ status: 'paid' }).eq('id', selectedRequest.id);
      if(!error) { 
          // 🟢 SNIPER PUSH: Tell the tutor they got paid
          await notifyUser(selectedRequest.tutor_id, "Payment Sent! 💰", "The student has marked the bounty as paid.");

          setShowQRModal(false); 
          Alert.alert("Completed", "Bounty closed successfully!"); 
      }
  }

  function denyBounty(id: string) { setHiddenRequests([...hiddenRequests, id]); }

  const marketData = requests.filter(r => r.status === 'open' && !hiddenRequests.includes(r.id));
  const activityData = requests.filter(r => r.student_id === userId || r.tutor_id === userId);
  const displayData = viewMode === 'market' ? marketData : activityData;

  const parseRequest = (raw: string) => {
    const catMatch = raw.match(/^\[(.*?)\]/);
    const category = catMatch ? catMatch[1] : 'General';
    const rest = raw.replace(/^\[.*?\]\s*/, '');
    const parts = rest.split('|');
    return { category, title: parts[0]?.trim() || 'No Title', desc: parts[1]?.trim() || '' };
  };

  const dialNumber = (phone: string) => {
      if (phone) Linking.openURL(`tel:${phone}`);
      else Alert.alert("No Phone", "Number not provided.");
  };

  return (
    <View style={styles.container}>
      
      <View style={styles.headerContainer}>
          <View>
             <Text style={styles.headerTitle}>Student Bounties 🎯</Text>
             <Text style={styles.headerSubtitle}>Post tasks. Verify work. Pay directly.</Text>
          </View>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.headerAddBtn}>
             <Plus size={28} color="black" />
          </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setViewMode('market')} style={[styles.tab, viewMode === 'market' && styles.activeTab]}>
              <Globe size={18} color={viewMode === 'market' ? 'black' : '#888'} />
              <Text style={[styles.tabText, viewMode === 'market' && styles.activeTabText]}>Market</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setViewMode('activity')} style={[styles.tab, viewMode === 'activity' && styles.activeTab]}>
              <Zap size={18} color={viewMode === 'activity' ? 'black' : '#888'} />
              <Text style={[styles.tabText, viewMode === 'activity' && styles.activeTabText]}>My Activity</Text>
              {activityData.filter(i => i.status !== 'paid').length > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{activityData.filter(i => i.status !== 'paid').length}</Text></View>
              )}
          </TouchableOpacity>
      </View>

      <FlatList 
        data={displayData}
        keyExtractor={item => item.id}
        contentContainerStyle={{paddingBottom: 100, paddingTop: 20}}
        ListEmptyComponent={<Text style={styles.emptyText}>{viewMode === 'market' ? 'No open bounties right now.' : 'No active jobs.'}</Text>}
        renderItem={({ item }) => {
          const { category, title, desc } = parseRequest(item.topic);
          const isMyPost = item.student_id === userId;
          const isMyJob = item.tutor_id === userId;

          return (
            <View style={[styles.card, item.status === 'paid' && styles.paidCard]}>
              <View style={styles.cardHeader}>
                <View style={[styles.tag, { backgroundColor: getCategoryColor(category) }]}>
                    <Text style={styles.tagText}>{category}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>₹{item.offer_price}</Text>
                </View>
              </View>

              <Text style={styles.topicTitle}>{title}</Text>
              {viewMode === 'activity' && <Text style={styles.description} numberOfLines={2}>{desc}</Text>}
              {viewMode === 'market' && desc ? <Text style={styles.description}>{desc}</Text> : null}

              {/* --- ACTIVITY TAB LOGIC --- */}
              {viewMode === 'activity' ? (
                  <View style={styles.footer}>
                      
                      {/* 1. I AM THE STUDENT */}
                      {isMyPost && (
                          <>
                             {/* DELETE BUTTON (Only if Open) */}
                             {item.status === 'open' && (
                                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                    <View style={styles.otpBox}>
                                        <Text style={styles.otpLabel}>⏳ Waiting for Tutor</Text>
                                        <Text style={styles.otpSubLabel}>OTP: {item.completion_otp}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => deleteBounty(item.id)} style={styles.deleteBtn}>
                                        <Trash2 size={20} color="#ff5252" />
                                    </TouchableOpacity>
                                </View>
                             )}
                             
                             {item.status === 'accepted' && (
                                 <View>
                                     <View style={styles.otpBox}>
                                         <Text style={styles.otpLabel}>👨‍🏫 Tutor Assigned: {item.tutor?.full_name}</Text>
                                         <Text style={styles.otpSubLabel}>Give them this code when done:</Text>
                                         <Text style={styles.otpValue}>{item.completion_otp}</Text>
                                     </View>
                                     {item.tutor?.phone && (
                                         <TouchableOpacity onPress={() => dialNumber(item.tutor.phone)} style={styles.contactRow}>
                                              <Phone size={16} color="#00E676" />
                                              <Text style={styles.contactText}>Call Tutor: {item.tutor.phone}</Text>
                                         </TouchableOpacity>
                                     )}
                                 </View>
                             )}

                             {item.status === 'payment_pending' && (
                                 <TouchableOpacity onPress={() => openPaymentModal(item)} style={styles.payBtn}>
                                     <Text style={styles.btnTextBlack}>PAY NOW ₹{item.offer_price}</Text>
                                     <DollarSign size={16} color="black" style={{marginLeft:5}}/>
                                 </TouchableOpacity>
                             )}
                          </>
                      )}

                      {/* 2. I AM THE TUTOR */}
                      {isMyJob && (
                          <>
                             {item.status === 'accepted' && (
                                 <View>
                                     <View style={styles.infoBox}>
                                         <Text style={{color:'#aaa', fontSize:12}}>STUDENT DETAILS</Text>
                                         <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>{item.profiles?.full_name}</Text>
                                         <Text style={{color:'#888'}}>Room: {item.profiles?.room_no}</Text>
                                         {item.profiles?.phone && (
                                             <TouchableOpacity onPress={() => dialNumber(item.profiles.phone)} style={[styles.contactRow, {justifyContent:'flex-start', marginTop:5}]}>
                                                 <Phone size={16} color="#00E676" />
                                                 <Text style={styles.contactText}> {item.profiles.phone}</Text>
                                             </TouchableOpacity>
                                         )}
                                     </View>

                                     <TouchableOpacity onPress={() => { setSelectedRequest(item); setOtpModalVisible(true); }} style={styles.actionBtn}>
                                         <Key size={18} color="black" style={{marginRight: 8}}/>
                                         <Text style={styles.btnTextBlack}>Enter OTP to Finish</Text>
                                     </TouchableOpacity>
                                 </View>
                             )}
                             {item.status === 'payment_pending' && <Text style={styles.statusWait}>⏳ Waiting for student to pay...</Text>}
                          </>
                      )}

                      {item.status === 'paid' && <Text style={styles.statusDone}>✅ Completed & Paid</Text>}
                  </View>
              ) : (
                  // --- MARKET TAB LOGIC ---
                  <View style={styles.footer}>
                      {isMyPost ? (
                          <Text style={styles.statusWait}>You posted this.</Text>
                      ) : (
                          <View style={styles.actionRow}>
                            <TouchableOpacity onPress={() => denyBounty(item.id)} style={styles.denyBtn}><X size={20} color="#ff5252" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => acceptBounty(item)} style={styles.acceptBtn}>
                                <Text style={styles.btnTextBlack}>Accept Job</Text>
                            </TouchableOpacity>
                          </View>
                      )}
                  </View>
              )}
            </View>
          );
        }}
      />

      {/* --- MODALS --- */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Post a Bounty</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 15, maxHeight: 50}}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[styles.chip, category === cat && styles.activeChip]}>
                  <Text style={{color: category === cat ? 'black' : '#888', fontWeight: category === cat ? 'bold' : 'normal'}}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput placeholder="Title (e.g. Help with Thermodynamics)" placeholderTextColor="#666" value={topic} onChangeText={setTopic} style={styles.input} />
            <TextInput placeholder="Description (Details about the assignment/topic)" placeholderTextColor="#666" value={description} onChangeText={setDescription} style={[styles.input, {height: 80, textAlignVertical: 'top'}]} multiline />
            
            <View style={styles.priceInputContainer}>
              <Text style={{fontSize: 18, marginRight: 10, fontWeight:'bold', color: '#FFF'}}>₹</Text>
              <TextInput placeholder="200" placeholderTextColor="#666" value={price} onChangeText={setPrice} keyboardType="numeric" style={{flex:1, fontSize: 18, color: '#00E676', fontWeight: 'bold'}} />
            </View>

            <TouchableOpacity onPress={postBounty} style={styles.modalBtn}><Text style={styles.btnTextBlack}>Post Bounty</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop:15, alignItems:'center'}}><Text style={{color:'#ff5252'}}>Cancel</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={otpModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Verify Completion</Text>
                  <Text style={{color:'#888', marginBottom: 20}}>Ask the student for the 4-digit OTP.</Text>
                  <TextInput placeholder="0000" placeholderTextColor="#666" value={otpInput} onChangeText={setOtpInput} keyboardType="numeric" maxLength={4} style={[styles.input, {textAlign:'center', fontSize: 32, letterSpacing: 5, fontWeight:'bold'}]} />
                  <TouchableOpacity onPress={verifyOtp} style={styles.modalBtn}><Text style={styles.btnTextBlack}>Verify & Unlock Payment</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setOtpModalVisible(false)} style={{marginTop:15, alignItems:'center'}}><Text style={{color:'#ff5252'}}>Cancel</Text></TouchableOpacity>
              </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {alignItems:'center'}]}>
                <Text style={{fontSize: 22, fontWeight:'bold', color: '#FFF', marginBottom:5}}>Pay Tutor</Text>
                <Text style={{color:'#00E676', fontWeight:'bold', fontSize: 18, marginBottom: 15}}>₹{payAmount}</Text>
                <View style={{padding: 10, borderRadius: 10, backgroundColor: 'white'}}><Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} /></View>
                <Text style={{textAlign:'center', color:'#888', marginVertical: 20}}>Paying: {selectedRequest?.tutor?.full_name}</Text>
                <View style={{flexDirection:'row', gap: 10, width:'100%'}}>
                    <TouchableOpacity onPress={() => setShowQRModal(false)} style={{flex:1, padding:15, backgroundColor:'#333', borderRadius:10, alignItems:'center'}}><Text style={{color:'#FFF'}}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity onPress={markPaid} style={{flex:1, padding:15, backgroundColor:'#00E676', borderRadius:10, alignItems:'center'}}><Text style={styles.btnTextBlack}>Done</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}

function getCategoryColor(cat: string) {
  if (['Math', 'Physics', 'Circuits'].includes(cat)) return '#3f51b5'; 
  if (['Programming', 'DSA', 'ML'].includes(cat)) return '#009688'; 
  if (['Design', 'Projects'].includes(cat)) return '#e91e63'; 
  return '#607d8b'; 
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 20 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 14, color: '#888', marginTop: 5 },
  headerAddBtn: { backgroundColor: '#00E676', padding: 10, borderRadius: 14 },
  
  // Tabs
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#1E1E1E', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  activeTab: { backgroundColor: '#00E676' },
  tabText: { fontWeight: 'bold', marginLeft: 8, color: '#888' },
  activeTabText: { color: 'black' },
  badge: { backgroundColor: '#ff5252', borderRadius: 10, paddingHorizontal: 6, marginLeft: 5 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  card: { backgroundColor: '#1E1E1E', marginHorizontal: 20, marginBottom: 15, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#333' },
  paidCard: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  priceTag: { backgroundColor: 'rgba(0, 230, 118, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.3)' },
  priceText: { color: '#00E676', fontWeight: 'bold' },
  topicTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 5 },
  description: { fontSize: 14, color: '#BBB', marginBottom: 15, lineHeight: 20 },
  
  footer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' },
  statusWait: { color: '#888', fontStyle: 'italic', textAlign:'center' },
  statusDone: { color: '#00E676', fontWeight:'bold', textAlign:'center' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 },

  // Activity Specifics
  otpBox: { flex:1, backgroundColor: '#333', padding: 10, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#666', marginBottom: 10 },
  otpLabel: { color: '#00E676', marginBottom: 2, fontSize: 12, fontWeight: 'bold' },
  otpSubLabel: { color: '#888', marginBottom: 5, fontSize: 10 },
  otpValue: { color: '#FFF', fontSize: 24, fontWeight: 'bold', letterSpacing: 3 },
  
  contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, padding: 5 },
  contactText: { color: '#00E676', fontWeight: 'bold', marginLeft: 8, textDecorationLine: 'underline' },
  infoBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, marginBottom: 10 },
  deleteBtn: { padding: 10, backgroundColor: 'rgba(255,82,82,0.1)', borderRadius: 8, marginLeft: 10 },

  payBtn: { backgroundColor: '#FFD700', padding: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  actionBtn: { backgroundColor: '#00E676', padding: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  
  actionRow: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#00E676', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 10 },
  denyBtn: { width: 50, backgroundColor: 'rgba(255, 82, 82, 0.1)', justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 82, 82, 0.3)' },
  
  btnTextBlack: { color: 'black', fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1E1E1E', padding: 25, borderRadius: 24, width:'100%', borderWidth: 1, borderColor: '#333' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#FFF' },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#333', marginRight: 8, borderWidth: 1, borderColor: '#444' },
  activeChip: { backgroundColor: '#00E676', borderColor: '#00E676' },
  input: { backgroundColor: '#2C2C2C', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16, color: '#FFF' },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2C', padding: 15, borderRadius: 12, marginBottom: 20 },
  modalBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 12, alignItems: 'center' }
});