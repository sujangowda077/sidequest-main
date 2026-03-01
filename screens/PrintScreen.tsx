import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, 
  ScrollView, Linking, FlatList, KeyboardAvoidingView, Platform, RefreshControl, Modal, Image, ActivityIndicator 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { PDFDocument } from 'pdf-lib';
import { 
  FileText, Printer, X, Trash2, History, PlusCircle, Settings, AlertTriangle
} from 'lucide-react-native';

// 🟢 IMPORT OUR PUSH HELPER
import { notifyUser } from '../lib/push';

interface PrintScreenProps {
  userId: string;
  userEmail: string;
  isProfileComplete: boolean;
}

// 🟢 PDF PAGE COUNTER
async function countPdfPages(uri: string) {
  try {

    // ✅ WEB VERSION
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      return pdfDoc.getPageCount();
    }

    // ✅ MOBILE VERSION
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const cleanBase64 = base64.replace(/\s/g, '');
    const arrayBuffer = decode(cleanBase64);
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    return pdfDoc.getPageCount();

  } catch (error) {
    console.log("PDF parse error:", error);
    return 0;
  }
}

// 🟢 SMART PARSER FOR "1-5, 8" STRINGS
function parsePageCount(rangeStr: string) {
    if (!rangeStr) return 0;
    return rangeStr.split(',').reduce((acc, part) => {
        const bounds = part.split('-').map(n => parseInt(n.trim()));
        if (bounds.length === 2 && !isNaN(bounds[0]) && !isNaN(bounds[1])) {
            return acc + (Math.abs(bounds[1] - bounds[0]) + 1);
        }
        if (bounds.length === 1 && !isNaN(bounds[0])) return acc + 1;
        return acc;
    }, 0);
}

export default function PrintScreen({ userId, userEmail, isProfileComplete }: PrintScreenProps) {
  const { colors } = useTheme();
  // 🔔 Custom Alert State
const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');

function showAlert(title: string, message: string) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertVisible(true);
}
  

  // --- CONFIG ---
  const ADMIN_EMAILS = ['printadmin@campus.app', '9066282034@campus.app', '9686050312@campus.app']; 
  const isAdmin = ADMIN_EMAILS.includes(userEmail);
  const VENDOR_UPI = 'paytm.s16jtb7@pty';

  // --- STATE ---
  const [viewMode, setViewMode] = useState<'request' | 'queue' | 'history'>(isAdmin ? 'queue' : 'request');
  const [orders, setOrders] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);

  // 🟢 PRICES
  const [prices, setPrices] = useState({
    a4_bw: 2, a4_color: 10,
    a3_bw: 5, a3_color: 20, 
    binding: { none: 0, spiral: 30, glass: 50 } 
  });

  // 🟢 FILE STATE
  interface FileConfig {
    uri: string;
    name: string;
    size: number;
    pageCount: string;
    color: 'bw' | 'color' | 'mixed'; 
    mixedColorPages: string; 
    mixedBwPages: string;    
    sizeType: 'a4' | 'a3';
    side: 'single' | 'double';
    copies: string;
    binding: 'none' | 'spiral' | 'glass'; 
  }
  const [files, setFiles] = useState<FileConfig[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null); 
  
  // Global Settings
  const [note, setNote] = useState('');

  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [finalCost, setFinalCost] = useState(0);
  const [paymentUtr, setPaymentUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Computed Totals
  const totalPages = files.reduce((acc, f) => acc + (parseInt(f.pageCount) || 0), 0);
  const totalSizeMB = files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);

  useFocusEffect(
    useCallback(() => {
        fetchConfigData();
        if (viewMode === 'queue' && isAdmin) fetchAllOrders();
        if (viewMode === 'history') fetchMyOrders();
    }, [viewMode])
  );

  async function fetchConfigData() {
      const { data } = await supabase.from('print_config').select('*').single();
      if (data) {
          setPrices({
              a4_bw: data.bw || 2, 
              a4_color: data.color || 10,
              a3_bw: 5, a3_color: 20, 
              binding: { none: 0, spiral: data.coil || 30, glass: data.glass || 50 }
          });
          
          const shopOpen = data.is_open ?? true;
          setIsShopOpen(shopOpen);

          if (!shopOpen && !isAdmin && viewMode === 'request') setViewMode('history');
      }
  }

  async function fetchAllOrders() {
    setLoading(true);
    const { data } = await supabase.from('print_orders').select('*, profiles:student_id(full_name, phone)').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  async function fetchMyOrders() {
    setLoading(true);
    const { data } = await supabase.from('print_orders').select('*').eq('student_id', userId).order('created_at', { ascending: false });
    if (data) setMyOrders(data);
    setLoading(false);
  }

  // --- ACTIONS ---

  async function pickDocument() {
    if (!isAdmin && !isProfileComplete) {
        showAlert("Profile Incomplete 🛑", "Please complete your profile first.");
        return;
    }

    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: true });
    if (!result.assets) return;

    const newFiles: FileConfig[] = [];
    for (let asset of result.assets) {
      const pages = await countPdfPages(asset.uri);
      newFiles.push({
          uri: asset.uri, name: asset.name, size: asset.size || 0,
          pageCount: pages > 0 ? pages.toString() : '', 
          copies: '1', color: 'bw', mixedColorPages: '', mixedBwPages: '',
          sizeType: 'a4', side: 'single', binding: 'none'
      });
    }
    setFiles([...files, ...newFiles]);
  }

  const updateFile = (index: number, key: keyof FileConfig, value: any) => {
      const updated = [...files];
      updated[index] = { ...updated[index], [key]: value };
      setFiles(updated);
  };

  const removeFile = (index: number) => {
    const updated = [...files];
    updated.splice(index, 1);
    setFiles(updated);
  };

  function initiateOrder() {
    if (files.length === 0) { showAlert("No File", "Please select a PDF."); return; }
    if (files.some(f => !f.pageCount || parseInt(f.pageCount) <= 0)) { showAlert("Missing Pages", "Please enter page count manually for all files."); return; }

    let totalCost = 0;

    files.forEach(f => {
        const pgs = parseInt(f.pageCount) || 0;
        const cps = parseInt(f.copies) || 1;
        const bwRate = f.sizeType === 'a4' ? prices.a4_bw : prices.a3_bw;
        const colorRate = f.sizeType === 'a4' ? prices.a4_color : prices.a3_color;
        
        if (f.color === 'mixed') {
            const cPgs = parsePageCount(f.mixedColorPages);
            const bPgs = parsePageCount(f.mixedBwPages);
            if (cPgs + bPgs === 0) {
                showAlert("Missing Info", `Please enter the page numbers for the mixed file: ${f.name}`);
                throw new Error("Missing mixed pages");
            }
            totalCost += ((cPgs * colorRate) + (bPgs * bwRate)) * cps;
        } 
        else if (f.color === 'color') {
            totalCost += (pgs * colorRate * cps);
        } 
        else {
            totalCost += (pgs * bwRate * cps);
        }

        totalCost += prices.binding[f.binding];
    });

    const randomPaisa = Math.floor(Math.random() * 90) + 10;
    const finalAmount = parseFloat((totalCost + randomPaisa / 100).toFixed(2));

    const upiLink = `upi://pay?pa=${VENDOR_UPI}&pn=CampusPrint&am=${finalAmount}&cu=INR`;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=350x350&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`);

    setFinalCost(finalAmount);
    setPaymentUtr('');
    setShowPaymentModal(true);
  }
const [utrError, setUtrError] = useState('');
  async function finalizeOrder() {
    if (paymentUtr.length < 4) {
        setUtrError("Please enter last 4 digits of UTR");
        return;
    }
    setUtrError('');

    try {
        const fileDetailsArray = [];
        let firstFileUrl = ''; 
        
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const uniqueName = `${userId}_${Date.now()}_${i}.pdf`;
            
            const base64File = await FileSystem.readAsStringAsync(f.uri, { encoding: 'base64' });
            const arrayBuffer = decode(base64File);

            const { error: uploadError } = await supabase.storage.from('documents').upload(uniqueName, arrayBuffer, { contentType: 'application/pdf' });
            if (uploadError) throw new Error(`Upload Error: ${uploadError.message}`);

            const { data } = supabase.storage.from('documents').getPublicUrl(uniqueName);
            
            if (i === 0) firstFileUrl = data.publicUrl; 

            fileDetailsArray.push({
                fileName: f.name,
                url: data.publicUrl,
                size: f.sizeType,
                colorMode: f.color,
                mixedColorPages: f.mixedColorPages,
                mixedBwPages: f.mixedBwPages,
                sides: f.side,
                pages: parseInt(f.pageCount),
                copies: parseInt(f.copies) || 1,
                binding: f.binding 
            });
        }

        const finalNote = `[UTR: ${paymentUtr}] Note: ${note}`;
        
        const { error: dbError } = await supabase.from('print_orders').insert({
            student_id: userId,
            file_details: fileDetailsArray, 
            file_name: files.length === 1 ? files[0].name : `${files.length} Files`,
            page_counts: { total: totalPages },
            copies: 1, 
            status: 'pending',
            estimated_cost: finalCost,
            note: finalNote,
            file_url: firstFileUrl, 
            color_mode: files[0].color || 'bw',
            binding_type: files[0].binding || 'none'
        });

        if (dbError) throw new Error(`Database Error: ${dbError.message}`);

        // 🟢 NOTIFY THE VENDOR
        const { data: adminProfile } = await supabase.from('profiles').select('id').eq('email', '9066282034@campus.app').single();
        if (adminProfile) {
            await notifyUser(adminProfile.id, "New Print Order! 🖨️", `A student just uploaded documents for printing.`);
        }

        showAlert("Success ✅", "Order placed!");
        setFiles([]); 
        setNote(''); 
        setShowPaymentModal(false); 
        setViewMode('history'); 
        
        fetchMyOrders(); 

    } catch (e: any) { 
        showAlert("Order Failed ❌", e.message); 
    } finally { 
        setSubmitting(false); 
    }
  }

  // 🟢 FIXED: NOW INCLUDES PUSH NOTIFICATION TO STUDENT
  async function updateStatus(orderId: string, status: string, studentId: string) {
    // 1. Optimistic UI update so vendor screen feels fast
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    // 2. Database update
    await supabase.from('print_orders').update({ status }).eq('id', orderId);
    
    // 3. 🟢 Send Push Notification to the Student!
    if (status === 'done') {
        await notifyUser(studentId, "Print Ready! 🖨️", "Your documents have been printed and are ready for pickup!");
    }

    fetchAllOrders();
  }

  // --- RENDERERS ---

  const renderRequestForm = () => {
    if (!isShopOpen) {
        return (
            <View style={{flex:1, justifyContent:'center', alignItems:'center', padding: 20}}>
                <AlertTriangle size={64} color="#FF5252" style={{marginBottom: 20}} />
                <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10}}>Shop is Closed</Text>
                <Text style={{color: '#888', textAlign: 'center'}}>The Print Shop is currently not accepting new orders. Please check back later!</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        
        {/* HEADER */}
        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
            <Text style={styles.label}>Documents</Text>
            <Text style={{color: totalSizeMB > 10 ? '#FF5252' : '#00E676', fontSize:12, fontWeight:'bold'}}>
                {totalSizeMB.toFixed(2)} / 10.0 MB
            </Text>
        </View>

        {/* COMPACT FILE LIST */}
        {files.map((f, index) => (
            <View key={index} style={styles.fileItem}>
                <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                    <FileText size={20} color={colors.primary} />
                    <View style={{marginLeft: 10, flex: 1}}>
                        <Text style={{color: colors.text, fontWeight:'bold'}} numberOfLines={1}>{f.name}</Text>
                        <Text style={{color: '#888', fontSize: 10}}>
                            {f.pageCount || '?'} pgs • {f.copies}x • {f.color.toUpperCase()} • {f.sizeType.toUpperCase()} • Binding: {f.binding}
                        </Text>
                    </View>
                </View>
                
                <TouchableOpacity onPress={() => setEditingFileIndex(index)} style={{marginRight: 15}}>
                    <Settings size={20} color="#00E676" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => removeFile(index)}>
                    <Trash2 size={20} color="#FF5252" />
                </TouchableOpacity>
            </View>
        ))}

        <TouchableOpacity onPress={pickDocument} style={styles.uploadBoxCompact}>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
                <PlusCircle size={24} color="#888" />
                <Text style={{color: '#888', marginLeft: 10}}>Add PDF Files</Text>
            </View>
        </TouchableOpacity>

        {/* TOTAL PAGES */}
        <Text style={styles.label}>Total Pages</Text>
        <View style={styles.infoBox}>
            <Text style={{color: colors.text, fontSize: 16, fontWeight:'bold'}}>{totalPages || 0}</Text>
        </View>

        <Text style={styles.label}>Order Note</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="Any specific instructions..." placeholderTextColor="#666" style={[styles.input, { borderColor: colors.border, color: colors.text }]} />

        <TouchableOpacity onPress={() => { try { initiateOrder() } catch(e) {} }} style={[styles.btn, { backgroundColor: colors.primary, marginTop: 30 }]}>
            <Printer size={20} color="black" style={{marginRight: 10}} />
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: 'black' }}>Proceed to Pay</Text>
        </TouchableOpacity>

        {/* 🟢 PER-FILE SETTINGS MODAL */}
        <Modal visible={editingFileIndex !== null} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent:'center'}}>
                    <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
                        <Text style={{fontSize: 18, fontWeight:'bold', color: colors.text, marginBottom: 20}} numberOfLines={1}>
                            Settings: {editingFileIndex !== null ? files[editingFileIndex]?.name : ''}
                        </Text>

                        {editingFileIndex !== null && (
                            <>
                                {/* Page Count & Copies */}
                                <View style={{flexDirection:'row', gap: 10, marginBottom: 15}}>
                                    <View style={{flex:1}}>
                                        <Text style={styles.labelSmall}>Total Pages</Text>
                                        <TextInput 
                                            value={files[editingFileIndex].pageCount} 
                                            onChangeText={(t) => updateFile(editingFileIndex, 'pageCount', t)}
                                            keyboardType="numeric"
                                            style={[styles.inputSmall, {color: colors.text, borderColor: colors.border}]}
                                        />
                                    </View>
                                    <View style={{flex:1}}>
                                        <Text style={styles.labelSmall}>Copies</Text>
                                        <TextInput 
                                            value={files[editingFileIndex].copies} 
                                            onChangeText={(t) => updateFile(editingFileIndex, 'copies', t)}
                                            keyboardType="numeric"
                                            style={[styles.inputSmall, {color: colors.text, borderColor: colors.border}]}
                                        />
                                    </View>
                                </View>

                                {/* Size Toggle */}
                                <Text style={styles.labelSmall}>Paper Size</Text>
                                <View style={styles.row}>
                                    {['a4', 'a3'].map((s) => (
                                        <TouchableOpacity key={s} onPress={() => updateFile(editingFileIndex, 'sizeType', s)} style={[styles.chip, files[editingFileIndex].sizeType === s && {backgroundColor: colors.primary}]}>
                                            <Text style={{color: files[editingFileIndex].sizeType === s ? 'black' : '#888', fontWeight:'bold'}}>{s.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Color Mode with Dynamic Pricing */}
                                <Text style={styles.labelSmall}>Color Mode</Text>
                                <View style={styles.row}>
                                    {['bw', 'color', 'mixed'].map((c) => {
                                        const isA4 = files[editingFileIndex].sizeType === 'a4';
                                        let label = c.toUpperCase();
                                        if (c === 'bw') label += ` (₹${isA4 ? prices.a4_bw : prices.a3_bw})`;
                                        if (c === 'color') label += ` (₹${isA4 ? prices.a4_color : prices.a3_color})`;
                                        
                                        return (
                                            <TouchableOpacity key={c} onPress={() => updateFile(editingFileIndex, 'color', c)} style={[styles.chip, files[editingFileIndex].color === c && {backgroundColor: colors.primary}]}>
                                                <Text style={{color: files[editingFileIndex].color === c ? 'black' : '#888', fontWeight:'bold', fontSize: 11}}>{label}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>

                                {/* MIXED MODE PANELS */}
                                {files[editingFileIndex].color === 'mixed' && (
                                    <View style={{backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333'}}>
                                        <Text style={{color: '#FF9800', fontSize: 12, marginBottom: 10, fontWeight: 'bold'}}>Specify Page Numbers (e.g. "1-5, 8")</Text>
                                        <View style={{gap: 10}}>
                                            <View>
                                                <Text style={{color: '#888', fontSize: 10, marginBottom: 4}}>Color Pages</Text>
                                                <TextInput 
                                                    placeholder="e.g. 1, 3-5" placeholderTextColor="#555"
                                                    value={files[editingFileIndex].mixedColorPages} 
                                                    onChangeText={(t) => updateFile(editingFileIndex, 'mixedColorPages', t)}
                                                    style={[styles.inputSmall, {color: 'white', borderColor: '#444', textAlign:'left', paddingHorizontal: 15}]}
                                                />
                                            </View>
                                            <View>
                                                <Text style={{color: '#888', fontSize: 10, marginBottom: 4}}>Black & White Pages</Text>
                                                <TextInput 
                                                    placeholder="e.g. 2, 6-10" placeholderTextColor="#555"
                                                    value={files[editingFileIndex].mixedBwPages} 
                                                    onChangeText={(t) => updateFile(editingFileIndex, 'mixedBwPages', t)}
                                                    style={[styles.inputSmall, {color: 'white', borderColor: '#444', textAlign:'left', paddingHorizontal: 15}]}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Per-File Binding */}
                                <Text style={styles.labelSmall}>Binding</Text>
                                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                    {[
                                        { id: 'none', label: 'None' },
                                        { id: 'spiral', label: `Spiral (₹${prices.binding.spiral})` },
                                        { id: 'glass', label: `Glass (₹${prices.binding.glass})` }
                                    ].map((b) => (
                                    <TouchableOpacity key={b.id} onPress={() => updateFile(editingFileIndex, 'binding', b.id)} style={[styles.chip, files[editingFileIndex].binding === b.id && { backgroundColor: colors.primary }, { marginBottom: 5 }]}>
                                        <Text style={{ color: files[editingFileIndex].binding === b.id ? 'black' : '#888', fontWeight: 'bold', fontSize: 11 }}>{b.label}</Text>
                                    </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Sides */}
                                <Text style={styles.labelSmall}>Sides</Text>
                                <View style={styles.row}>
                                    <TouchableOpacity onPress={() => updateFile(editingFileIndex, 'side', 'single')} style={[styles.chip, files[editingFileIndex].side === 'single' && {backgroundColor: colors.primary}]}>
                                        <Text style={{color: files[editingFileIndex].side === 'single' ? 'black' : '#888', fontWeight:'bold'}}>Single Sided</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => updateFile(editingFileIndex, 'side', 'double')} style={[styles.chip, files[editingFileIndex].side === 'double' && {backgroundColor: colors.primary}]}>
                                        <Text style={{color: files[editingFileIndex].side === 'double' ? 'black' : '#888', fontWeight:'bold'}}>Double Sided</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity onPress={() => setEditingFileIndex(null)} style={[styles.btn, {backgroundColor: colors.primary, marginTop: 15}]}>
                                    <Text style={{fontWeight:'bold', color: 'black'}}>Save File Settings</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </View>
        </Modal>

        </ScrollView>
    );
  };

  const renderHistory = () => (
    <FlatList 
      data={myOrders}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMyOrders} tintColor={colors.primary}/>}
      ListEmptyComponent={<Text style={{textAlign:'center', color:'#666', marginTop:50}}>No previous orders.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 10}}>
                <Text style={{color: colors.text, fontWeight:'bold'}}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <View style={{
                    backgroundColor: item.status === 'done' ? 'rgba(0,230,118,0.2)' : item.status === 'rejected' ? 'rgba(255,82,82,0.2)' : 'rgba(255,152,0,0.2)',
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
                }}>
                    <Text style={{
                        color: item.status === 'done' ? '#00E676' : item.status === 'rejected' ? '#FF5252' : '#FF9800',
                        fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase'
                    }}>
                        {item.status === 'done' ? 'Completed' : item.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </Text>
                </View>
            </View>
            <View style={{flexDirection:'row', alignItems:'center', marginBottom:5}}>
                <FileText size={16} color="#888" />
                <Text style={{color: '#ccc', marginLeft: 8, flex:1}} numberOfLines={2}>{item.note || item.file_name}</Text>
            </View>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 10, borderTopWidth:1, borderTopColor:'#333', paddingTop:10}}>
                <Text style={{color:'#888', fontSize:12}}>{item.page_counts?.total} Pages Total</Text>
                <Text style={{color: colors.primary, fontWeight:'bold'}}>₹{item.estimated_cost}</Text>
            </View>
        </View>
      )}
    />
  );

  const renderAdminQueue = () => (
    <FlatList 
      data={orders} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20 }} 
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAllOrders} />}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontWeight: 'bold', color: colors.text }}>{item.profiles?.full_name}</Text>
            <Text style={{ fontWeight: 'bold', color: item.status === 'done' ? '#00E676' : '#FF9800' }}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>{item.profiles?.phone}</Text>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontWeight:'bold', fontSize: 12 }}>📄 {item.file_name}</Text>
              <Text style={{ color: '#00E676', fontSize: 11, marginTop: 5, fontWeight:'bold' }}>{item.note}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.primary }}>₹{item.estimated_cost}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                {item.file_details && item.file_details.length > 0 && (
                    <TouchableOpacity onPress={() => Linking.openURL(item.file_details[0].url)} style={styles.actionBtn}><Text style={{ color: 'white', fontSize: 12 }}>View PDF</Text></TouchableOpacity>
                )}
                {/* 🟢 FIXED: PASSED STUDENT ID TO TRIGGER NOTIFICATION */}
                {item.status === 'pending' && <TouchableOpacity onPress={() => updateStatus(item.id, 'done', item.student_id)} style={[styles.actionBtn, {backgroundColor: '#00E676'}]}><Text style={{ color: 'black', fontSize: 12, fontWeight:'bold' }}>Done</Text></TouchableOpacity>}
            </View>
          </View>
        </View>
      )} 
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        
        {/* HEADER WITH STATUS INDICATOR */}
        <View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Print Shop 🖨️</Text>
            {!isAdmin && (
                <Text style={{ color: isShopOpen ? '#00E676' : '#FF5252', fontSize: 12, fontWeight: 'bold', marginTop: 2 }}>
                    {isShopOpen ? '🟢 OPEN NOW' : '🔴 CURRENTLY CLOSED'}
                </Text>
            )}
        </View>

        <View style={{flexDirection:'row', backgroundColor:'#333', borderRadius: 15, padding: 2}}>
            {!isAdmin ? (
                <>
                    <TouchableOpacity 
                        onPress={() => {
                            if (!isShopOpen) showAlert("Closed", "The shop is not accepting orders right now.");
                            else setViewMode('request');
                        }} 
                        style={[styles.toggleBtn, viewMode === 'request' && {backgroundColor: colors.primary}]}
                    >
                        <PlusCircle size={16} color={viewMode === 'request'?'black':'white'}/>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('history')} style={[styles.toggleBtn, viewMode === 'history' && {backgroundColor: colors.primary}]}><History size={16} color={viewMode === 'history'?'black':'white'}/></TouchableOpacity>
                </>
            ) : (
                <>
                    <TouchableOpacity onPress={() => setViewMode('request')} style={[styles.toggleBtn, viewMode === 'request' && {backgroundColor: colors.primary}]}><Text style={{fontSize: 10, fontWeight:'bold', color: viewMode === 'request'?'black':'white'}}>New</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewMode('queue')} style={[styles.toggleBtn, viewMode === 'queue' && {backgroundColor: colors.primary}]}><Text style={{fontSize: 10, fontWeight:'bold', color: viewMode === 'queue'?'black':'white'}}>Queue</Text></TouchableOpacity>
                </>
            )}
        </View>
      </View>

      {viewMode === 'request' && renderRequestForm()}
      {viewMode === 'history' && renderHistory()}
      {viewMode === 'queue' && renderAdminQueue()}

      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
                <View style={{alignItems:'flex-end'}}><TouchableOpacity onPress={() => setShowPaymentModal(false)}><X size={24} color={colors.text}/></TouchableOpacity></View>
                <View style={{backgroundColor:'white', padding: 10, borderRadius: 10, alignItems:'center', marginVertical: 20}}>
                    <Image source={{uri: qrUrl}} style={{width: 200, height: 200}} />
                </View>
                <Text style={{textAlign:'center', color:'#00E676', fontSize: 24, fontWeight:'bold', marginBottom: 20}}>₹{finalCost}</Text>
                <TextInput placeholder="Enter Last 4 Digits of UTR" placeholderTextColor="#666" value={paymentUtr} onChangeText={setPaymentUtr} keyboardType="numeric" maxLength={12} style={[styles.input, {color: colors.text, borderColor: colors.border, textAlign:'center', fontSize: 18}]} />
                {utrError !== '' && (
  <Text style={{ 
    color: '#FF5252', 
    textAlign: 'center', 
    marginBottom: 10,
    fontWeight: 'bold'
  }}>
    {utrError}
  </Text>
)}
                <TouchableOpacity onPress={finalizeOrder} disabled={submitting} style={[styles.btn, {backgroundColor: submitting ? '#666' : colors.primary, marginTop: 10}]}>
                    {submitting ? <ActivityIndicator color="black" /> : <Text style={{color: 'black', fontWeight:'bold'}}>I Have Paid</Text>}
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
        onPress={() => setAlertVisible(false)}
        style={{
          backgroundColor: colors.primary,
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
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  uploadBoxCompact: { height: 60, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems:'center', marginBottom: 15 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 10, marginBottom: 8 },
  label: { color: '#888', marginBottom: 5, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 5 },
  labelSmall: { color: '#888', marginBottom: 4, fontSize: 11, fontWeight: 'bold' },
  infoBox: { borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, marginBottom: 15 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 10 },
  inputSmall: { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14, textAlign:'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  btn: { padding: 15, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 20 },
  card: { padding: 15, borderRadius: 12, marginBottom: 15 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#333', borderRadius: 6 },
  toggleBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 13, alignItems:'center', justifyContent:'center' }
});
