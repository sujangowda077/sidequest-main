import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Switch, 
  TextInput, Linking, Modal, ScrollView, Image, RefreshControl, Platform, KeyboardAvoidingView, ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake'; 
import * as Speech from 'expo-speech';            
import { 
  Search, Minus, Plus, Store, Coffee, Utensils, ClipboardList, CheckCircle, 
  Wallet, ArrowLeft, Edit3, X, Receipt, MapPin, Filter, ArrowUp, ArrowDown, Server, UserCheck, Clock, PlusCircle, Ban, Lock
} from 'lucide-react-native';
import { isDevUser } from '../lib/devMode'; 

// 🟢 IMPORT JUICY BUTTON & PUSH
import { notifyUser } from '../lib/push';
import JuicyButton from '../components/JuicyButton';

interface MenuScreenProps {
  userId: string;
  userEmail: string;
  isProfileComplete: boolean; 
}

export default function MenuScreen({ userId, userEmail, isProfileComplete }: MenuScreenProps) {
  const { colors } = useTheme();
  // 🔔 Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');
const [alertButtons, setAlertButtons] = useState<
  { text: string; onPress?: () => void; style?: "cancel" | "default" }[]
>([]);

function showAlert(
  title: string,
  message: string,
  buttons?: { text: string; onPress?: () => void; style?: "cancel" | "default" }[]
) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertButtons(
    buttons && buttons.length > 0
      ? buttons
      : [{ text: "OK", onPress: () => setAlertVisible(false) }]
  );
  setAlertVisible(true);
}
  useKeepAwake(); 

  const ADMIN_UPI_ID = "minecraftsreyash@oksbi"; 
  const SHOP_UPI: { [key: string]: string } = {
      'Five Star': '78293408961902@cnrb', 
      'Ground View Cafe': 'vyapar.170854387647@hdfcbank' 
  };
  const ADMIN_MAP: { [key: string]: string } = {
      '9066282034@campus.app': 'Five Star',
      '9686050312@campus.app': 'Ground View Cafe'
  };

  const safeEmail = userEmail ? userEmail.toLowerCase().trim() : '';
  const adminShopName = ADMIN_MAP[safeEmail]; 
  const isAdmin = !!adminShopName;
  const isDev = isDevUser(safeEmail);

  // --- STATE ---
  const [selectedShop, setSelectedShop] = useState<string>(adminShopName || 'Five Star');
  const [adminView, setAdminView] = useState<'dashboard' | 'new' | 'scheduled' | 'finished' | 'cancelled' | 'runner_pay' | 'refunds' | 'menu_edit' | 'server_dues' | 'users'>('dashboard');

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]); 
  const [myOrders, setMyOrders] = useState<any[]>([]); 
  const [payouts, setPayouts] = useState<any[]>([]);
  const [shopStatus, setShopStatus] = useState(true);
   
  // Cart & Ordering
  const [cart, setCart] = useState<{[key: string]: number}>({});
  const [orderType, setOrderType] = useState<'delivery' | 'takeaway' | 'dine_in'>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState('');
   
  const [requestedTime, setRequestedTime] = useState('ASAP');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
   
  const [showCheckout, setShowCheckout] = useState(false); 
  const [showMyOrders, setShowMyOrders] = useState(false);
   
  // Payment & QR
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [pendingToken, setPendingToken] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [userUTR, setUserUTR] = useState('');
  const [paymentMode, setPaymentMode] = useState<'STUDENT' | 'RUNNER' | 'SERVER'>('STUDENT');
  const [activeRunnerId, setActiveRunnerId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const [editingItem, setEditingItem] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newName, setNewName] = useState(''); 
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Snacks', is_veg: true });

  // VENDOR TIMER LOGIC
  const [currentTime, setCurrentTime] = useState(new Date());
  const alertedOrders = useRef(new Set()).current;

  useFocusEffect(
    useCallback(() => {
      if (isAdmin && selectedShop !== adminShopName) setSelectedShop(adminShopName);
      loadAllData();
    }, [selectedShop, adminView])
  );

  useEffect(() => {
      if (!isAdmin) return;
      const timer = setInterval(() => setCurrentTime(new Date()), 30000); 
      return () => clearInterval(timer);
  }, [isAdmin]);

  useEffect(() => {
      if (!isAdmin) return;
      let triggered = false;
      let newReadyOrders: string[] = [];
      
      orders.forEach(o => {
          if (o.status === 'pending_approval' && o.requested_time && o.requested_time !== 'ASAP') {
              if (isTimeReady(o.requested_time, currentTime) && !alertedOrders.has(o.id)) {
                  alertedOrders.add(o.id);
                  triggered = true;
                  newReadyOrders.push(o.token_no);
              }
          }
      });

      if (triggered) {
          Speech.speak("Scheduled order ready for prep!", { rate: 0.9, pitch: 1.0 });
          showAlert("Scheduled Order Ready! ⏰", `Token(s) ${newReadyOrders.join(', ')} are 15 mins away and have automatically moved to the Live Queue!`);
      }
  }, [currentTime, orders, isAdmin]);

  const isTimeReady = (timeStr: string, now: Date = new Date()) => {
      if (!timeStr || timeStr === 'ASAP') return true;
      try {
          const [time, modifier] = timeStr.split(' ');
          let [hours, minutes] = time.split(':');
          let h = parseInt(hours, 10);
          if (h === 12 && modifier === 'AM') h = 0;
          if (h !== 12 && modifier === 'PM') h += 12;
          
          const targetTime = new Date(now);
          targetTime.setHours(h, parseInt(minutes, 10), 0, 0);
          
          const diffMins = (targetTime.getTime() - now.getTime()) / 60000;
          return diffMins <= 15; 
      } catch(e) {
          return true; 
      }
  };

  const generateTimeSlots = () => {
      const slots = ['ASAP'];
      const now = new Date();
      let start = new Date(now);
      start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15 + 30);
      
      for(let i=0; i<12; i++) { 
          let h = start.getHours();
          let m = start.getMinutes();
          const ampm = h >= 12 ? 'PM' : 'AM';
          let displayH = h % 12 || 12;
          const mStr = m < 10 ? '0'+m : m;
          slots.push(`${displayH}:${mStr} ${ampm}`);
          start.setMinutes(start.getMinutes() + 15);
      }
      return slots;
  };

  useEffect(() => {
      if(showCheckout) setAvailableTimeSlots(generateTimeSlots());
  }, [showCheckout]);

  useEffect(() => {
    let result = [...menuItems];
    if (searchQuery) result = result.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterType === 'veg') result = result.filter(item => item.is_veg === true);
    if (filterType === 'non-veg') result = result.filter(item => item.is_veg === false);
    if (selectedCategory !== 'All') result = result.filter(item => item.category === selectedCategory);
    if (sortOrder === 'asc') result.sort((a, b) => a.price - b.price);
    if (sortOrder === 'desc') result.sort((a, b) => b.price - a.price);
    setFilteredItems(result);
  }, [searchQuery, filterType, sortOrder, selectedCategory, menuItems]);

  useEffect(() => {
      if (!isAdmin) return;
      const channel = supabase.channel('admin_listener')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errands' }, (payload) => {
             const newOrder = payload.new;
             if (newOrder.shop_name === adminShopName) {
                 setOrders(prev => [newOrder, ...prev]); 
                 if (!newOrder.requested_time || newOrder.requested_time === 'ASAP' || isTimeReady(newOrder.requested_time, new Date())) {
                     Speech.speak("New order received!", { rate: 0.9, pitch: 1.0 });
                     showAlert("🚨 NEW ORDER", `Token: ${newOrder.token_no}`);
                 }
             }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'errands' }, (payload) => {
             const updatedOrder = payload.new;
             if (updatedOrder.shop_name === adminShopName) {
                 setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
             }
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [isAdmin, adminShopName]);

  useEffect(() => {
      if (isAdmin) return; 
      const channel = supabase.channel('student_listener')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'errands', filter: `student_id=eq.${userId}` }, (payload) => {
             const newOrder = payload.new;
             setMyOrders(prev => prev.map(o => o.id === newOrder.id ? { ...o, ...newOrder } : o));
             
             if (newOrder.status === 'cooking') {
                 Speech.speak("Order accepted. Food is preparing.", { rate: 1.0 });
                 showAlert("Order Accepted ✅", `The vendor has started preparing your food!`); 
             }
             else if (newOrder.status === 'ready') {
                 Speech.speak("Order is ready for pickup.", { rate: 1.0 });
                 showAlert("Order Ready 🍔", "Your food is ready. Please pick it up!");
             }
             else if (newOrder.status === 'cancelled') {
                 Speech.speak("Order declined.", { rate: 1.0 });
                 showAlert("Order Cancelled ❌", "The vendor declined your order.");
             }
      }).subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [userId, isAdmin]);


  const loadAllData = async () => {
      setRefreshing(true);
      await fetchShopData();
      if (isAdmin) { 
          const { data } = await supabase.from('errands').select('*, profiles:student_id(full_name, phone, upi_id)').eq('shop_name', selectedShop).order('created_at', { ascending: false });
          if (data) setOrders(data);
          await fetchPayouts(); 
      } else {
          await fetchMyOrders();
      }
      setRefreshing(false);
  };

  async function fetchShopData() {
    const { data: shopData } = await supabase.from('shops').select('is_open').eq('name', selectedShop).single();
    if (shopData) setShopStatus(shopData.is_open);
    
    const { data: menuData } = await supabase.from('menu_items').select('*').eq('shop_name', selectedShop).order('category');
    if (menuData) {
        const uniqueItemsMap = new Map();
        menuData.forEach((item: any) => {
            if (!uniqueItemsMap.has(item.name.toLowerCase())) {
                uniqueItemsMap.set(item.name.toLowerCase(), item);
            }
        });
        const uniqueMenuItems = Array.from(uniqueItemsMap.values());
        
        setMenuItems(uniqueMenuItems);
        const cats = ['All', ...new Set(uniqueMenuItems.map((item: any) => item.category || 'Other'))];
        setCategories(cats as string[]);
    }
  }

  async function fetchMyOrders() {
      const { data } = await supabase.from('errands')
          .select('*')
          .eq('student_id', userId)
          .neq('status', 'resolved')
          .order('created_at', { ascending: false });
      if (data) setMyOrders(data);
  }

  async function fetchPayouts() {
    const { data } = await supabase.from('errands').select(`runner_id, runner:runner_id ( full_name, phone, upi_id )`)
        .eq('shop_name', selectedShop)
        .eq('status', 'delivered')
        .eq('order_type', 'delivery')
        .eq('is_payout_complete', false)
        .not('runner_id', 'is', null);
    
    if (data) {
        const grouped: {[key: string]: any} = {};
        data.forEach((order: any) => {
            const rid = order.runner_id;
            const runner = Array.isArray(order.runner) ? order.runner[0] : order.runner;
            if (runner) {
                if (!grouped[rid]) grouped[rid] = { runner_id: rid, name: runner.full_name || 'Unknown', phone: runner.phone, upi: runner.upi_id, count: 0, total: 0 };
                grouped[rid].count += 1; grouped[rid].total += 20; 
            }
        });
        setPayouts(Object.values(grouped));
    }
  }

  async function toggleShop(val: boolean) {
    setShopStatus(val);
    await supabase.from('shops').update({ is_open: val }).eq('name', selectedShop);
  }

  async function updateOrderStatus(id: string, status: string) {
      const order = orders.find(o => o.id === id); 
      
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      
      if (status === 'cooking' || (status === 'open' && order?.order_type === 'delivery')) {
          if (order) {
               const earnedMana = Math.floor(Math.random() * 60) + 1;
               const { data: profile } = await supabase.from('profiles').select('mana_balance').eq('id', order.student_id).single();
               await supabase.from('profiles').update({ mana_balance: (profile?.mana_balance || 0) + earnedMana }).eq('id', order.student_id);
          }
      }
      
      await supabase.from('errands').update({ status }).eq('id', id);

      if (order) {
          if (status === 'ready') {
              await notifyUser(order.student_id, "Order Ready! 🍔", `Your token ${order.token_no} is ready for pickup!`);
          } else if (status === 'cancelled') {
              await notifyUser(order.student_id, "Order Cancelled ❌", `Your order ${order.token_no} was declined.`);
          } else if (status === 'cooking') {
              await notifyUser(order.student_id, "Food is Cooking 🍳", "The vendor has started preparing your order!");
          }
      }
  }

  async function completeOrder(id: string) {
      Alert.alert("Complete Order?", "Mark this order as picked up?", [
          { text: "Cancel", style: 'cancel' },
          { text: "Yes, I got it", onPress: async () => {
              const { error } = await supabase.from('errands').update({ status: 'picked_up' }).eq('id', id);
              if (!error) {
                  showAlert("Done", "Order completed.");
                  fetchMyOrders(); 
              }
          }}
      ]);
  }

  async function resolveCancelledOrder(id: string) {
      Alert.alert("Issue Resolved?", "Have you visited the store and resolved the payment/order issue? This will remove the order from the list.", [
          { text: "Not Yet", style: 'cancel' },
          { text: "Yes, Resolved", onPress: async () => {
              const { error } = await supabase.from('errands').update({ status: 'resolved' }).eq('id', id);
              if (!error) {
                  showAlert("Resolved ✅", "Order has been cleared from the history.");
                  fetchMyOrders(); 
              } else {
                  showAlert("Error", "Could not clear the order.");
              }
          }}
      ]);
  }

  async function updateItemDetails() {
      if (!editingItem || !newPrice || !newName) return;
      const price = parseFloat(newPrice);
      if (isNaN(price)) { showAlert("Invalid Price", "Please enter a valid price."); return; }
      const { error } = await supabase.from('menu_items').update({ price: price, name: newName }).eq('id', editingItem.id);
      if (!error) { showAlert("Success", "Item updated!"); setEditingItem(null); setNewPrice(''); setNewName(''); fetchShopData(); } 
  }

  async function addNewMenuItem() {
      if (!newItem.name || !newItem.price) { showAlert("Missing Info", "Please fill in all fields."); return; }
      const price = parseFloat(newItem.price);
      const { error } = await supabase.from('menu_items').insert({ shop_name: selectedShop, name: newItem.name, price: price, category: newItem.category, is_veg: newItem.is_veg, is_available: true });
      if (!error) { showAlert("Success", "Item Added!"); setShowAddMenuModal(false); setNewItem({ name: '', price: '', category: 'Snacks', is_veg: true }); fetchShopData(); } else { showAlert("Error", error.message); }
  }

  async function toggleItemAvailability(id: string, currentStatus: boolean) {
      setMenuItems(prev => prev.map(item => item.id === id ? { ...item, is_available: !currentStatus } : item));
      await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id);
  }

  const getPackagingCharge = (item: any) => {
      if (orderType === 'dine_in') return 0;
      const name = item.name.toLowerCase();
      const cat = (item.category || '').toLowerCase();
      if (name.includes('milkshake') || cat.includes('milkshake')) return 0;
      if (name.includes('juice') || name.includes('maggie') || cat.includes('juice')) return 5;
      if (name.includes('biryani') || name.includes('pizza') || cat.includes('biryani') || cat.includes('pizza')) return 10;
      return 0; 
  };

  const updateCart = (id: string, delta: number) => {
    if (!isAdmin && delta > 0) {
        if (!isProfileComplete) {
            showAlert("Profile Incomplete 🛑", "You must complete your profile in the Profile tab before you can order food.");
            return;
        }
        if (!shopStatus) {
            showAlert("Shop Closed 🛑", "The vendor is temporarily not accepting orders. Please try again later.");
            return;
        }
    }

    setCart(prev => {
      const next = (prev[id] || 0) + delta;
      const copy = { ...prev };
      if (next <= 0) { delete copy[id]; if(Object.keys(copy).length===0) setShowCheckout(false); }
      else copy[id] = next;
      return copy;
    });
  };

  const getCartItemTotal = () => Object.keys(cart).reduce((s, id) => s + (menuItems.find(i=>i.id===id)?.price||0)*cart[id], 0);
   
  const getPackagingTotal = () => {
      if (orderType === 'dine_in') return 0;
      return Object.keys(cart).reduce((s, id) => {
          const item = menuItems.find(i=>i.id===id);
          if (!item) return s;
          return s + (getPackagingCharge(item) * cart[id]);
      }, 0);
  };

  async function placeOrder(method: 'cash' | 'online') {
    if (!isAdmin) {
        if (!isProfileComplete) {
            showAlert("Profile Incomplete 🛑", "Please complete your profile first.");
            return;
        }

        if (!shopStatus) {
            showAlert("Shop Closed 🛑", "The vendor is temporarily not accepting orders.");
            return;
        }
    }

    if (orderType === 'delivery' && !deliveryAddress.trim()) { showAlert("Address Missing", "Please enter your Hostel Block & Room No."); return; }
     
    const executeOrder = () => {
        if (isDev && method === 'online') {
            const itemTotal = getCartItemTotal();
            const pkgTotal = getPackagingTotal();
            const deliveryFee = orderType === 'delivery' ? 20 : 0;
            const platformFee = 2;
            const baseTotal = itemTotal + pkgTotal + deliveryFee + platformFee;
            const token = Math.floor(Math.random() * 900) + 100;
            Alert.alert("God Mode ⚡", "Bypassing payment...", [{ text: "OK", onPress: () => saveOrder(baseTotal, token, 'online (DEV)', 'GOD-MODE-BYPASS') }]);
            return; 
        }

        const itemTotal = getCartItemTotal();
        const pkgTotal = getPackagingTotal();
        const deliveryFee = orderType === 'delivery' ? 20 : 0;
        const platformFee = 2;
        const baseTotal = itemTotal + pkgTotal + deliveryFee + platformFee;

        const token = Math.floor(Math.random()*900)+100;
        const randomPaisa = Math.floor(Math.random() * 90) + 10;
        const uniqueAmount = (baseTotal + (randomPaisa / 100)).toFixed(2);

        const targetUPI = SHOP_UPI[selectedShop];
        const upiLink = `upi://pay?pa=${targetUPI}&pn=${encodeURIComponent(selectedShop)}&am=${uniqueAmount}&cu=INR`;
        setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=350x350&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`);
        setPendingToken(token);
        setPendingTotal(parseFloat(uniqueAmount));
        setPaymentMode('STUDENT');
        setUserUTR(''); 
        setShowCheckout(false);
        setShowQRModal(true);
    };

    if (!isAdmin) {
        const currentHour = new Date().getHours();
        const currentMin = new Date().getMinutes();
        const isLate = currentHour > 19 || (currentHour === 19 && currentMin >= 30) || currentHour < 10;

        if (isLate) {
            showAlert(
                "Late Order Warning 🌙",
                "The shop may be closed right now. If you place this order and it gets cancelled, you will need to resolve the payment directly with the vendor tomorrow.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "I Understand, Proceed", onPress: executeOrder }
                ]
            );
            return;
        }
    }

    executeOrder();
  }

  const openVendorPayment = (upiId: string, name: string, amount: number, mode: 'RUNNER' | 'SERVER', runnerId?: string) => {
    if (!upiId) { showAlert("No UPI Found", `The user hasn't added their UPI ID yet.`); return; }
    const randomPaisa = Math.floor(Math.random() * 90) + 10;
    const uniqueAmount = (amount + (randomPaisa / 100)).toFixed(2);
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${uniqueAmount}&cu=INR`;
     
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=350x350&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`);
    setPendingTotal(parseFloat(uniqueAmount));
    setPaymentMode(mode); 
    if (runnerId) setActiveRunnerId(runnerId);
    setUserUTR(''); 
    setShowQRModal(true);
  };

  const handlePaymentSuccess = async () => {
    if (!userUTR || userUTR.length < 4) { showAlert("Invalid UTR", "Please enter the last 4 digits of the payment ref."); return; }
    setShowQRModal(false);

    if (paymentMode === 'STUDENT') {
        await saveOrder(pendingTotal, pendingToken, 'online', userUTR);
    } 
    else if (paymentMode === 'RUNNER' && activeRunnerId) {
         const { error } = await supabase.from('errands')
            .update({ payout_proof_url: `UTR: ${userUTR}`, is_payout_complete: true }) 
            .eq('runner_id', activeRunnerId)
            .eq('status','delivered')
            .eq('is_payout_complete', false);
         if (!error) { showAlert("Proof Sent", `UTR ${userUTR} submitted. Runner paid.`); fetchPayouts(); }
    } 
    else if (paymentMode === 'SERVER') {
         showAlert("Recorded", `Server Fees UTR ${userUTR} saved.`); 
    }
     
    setPaymentMode('STUDENT'); setActiveRunnerId(null);
  };

  async function saveOrder(total: number, token: number, method: string, utr: string) {
      let desc = `[#${token}] ${orderType.toUpperCase().replace('_', ' ')} [${method.toUpperCase()}]`;
      if (method === 'online') desc += ` [UTR: ${utr}]`; 
      desc += ` • ` + Object.keys(cart).map(id => `${cart[id]}x ${menuItems.find(i=>i.id===id)?.name}`).join(', ');
      
      const { error } = await supabase.from('errands').insert({ 
          student_id: userId, 
          item_description: desc, 
          shop_name: selectedShop, 
          estimated_cost: total, 
          order_type: orderType === 'dine_in' ? 'takeaway' : orderType, 
          token_no: `#${token}`, 
          status: 'pending_approval', 
          requested_time: requestedTime, 
          delivery_otp: orderType === 'delivery' ? Math.floor(1000+Math.random()*9000).toString() : null, 
          delivery_address: orderType === 'delivery' ? deliveryAddress : null 
      });

      if (error) { showAlert("Error", "Failed to save order."); return; }

      const adminEmail = Object.keys(ADMIN_MAP).find(email => ADMIN_MAP[email] === selectedShop);
      if (adminEmail) {
          const { data: adminProfile } = await supabase.from('profiles').select('id').eq('email', adminEmail).single();
          if (adminProfile) {
              await notifyUser(adminProfile.id, "New Order Received! 🛎️", `Token #${token} needs to be prepped.`);
          }
      }

      setCart({}); 
      setDeliveryAddress(''); 
      setRequestedTime('ASAP');
      
      showAlert("Order Sent! ⏳", `Token: #${token}\n\nWaiting for vendor acceptance...`);
      fetchMyOrders();
  }

  // --- ADMIN RENDERERS ---

  const renderDashboard = () => ( 
    <ScrollView contentContainerStyle={{padding: 20, paddingTop: 60}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAllData} tintColor={colors.primary} />}>
        <Text style={{fontSize: 28, fontWeight:'bold', color: colors.text, marginBottom: 5}}>{selectedShop}</Text>
        <Text style={{fontSize: 14, color: '#888', marginBottom: 20}}>Admin Dashboard</Text>
        <View style={[styles.adminStatusCard, {backgroundColor: shopStatus ? 'rgba(76, 175, 80, 0.1)' : 'rgba(239, 83, 80, 0.1)', borderColor: shopStatus ? '#4caf50' : '#ef5350'}]}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Store size={24} color={shopStatus ? '#4caf50' : '#ef5350'} />
                <View style={{marginLeft: 15}}><Text style={{fontSize: 18, fontWeight:'bold', color: colors.text}}>Store Status</Text><Text style={{color: shopStatus ? '#4caf50' : '#ef5350', fontWeight:'bold'}}>{shopStatus ? '🟢 OPEN' : '🔴 CLOSED'}</Text></View>
            </View>
            <Switch value={shopStatus} onValueChange={toggleShop} trackColor={{false: "#ef5350", true: "#4caf50"}} />
        </View>

        <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginTop: 10}}>
            <TouchableOpacity onPress={() => setAdminView('new')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}><ClipboardList size={28} color="#2196f3" /></View>
                <Text style={styles.dashboardCardTitle}>New Orders</Text>
                <Text style={styles.dashboardCardSub}>{orders.filter(o => (o.status === 'pending_approval' || o.status === 'open' || o.status === 'cooking') && isTimeReady(o.requested_time, currentTime)).length} Ready</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('scheduled')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(156, 39, 176, 0.15)' }]}><Clock size={28} color="#9c27b0" /></View>
                <Text style={styles.dashboardCardTitle}>Scheduled</Text>
                <Text style={styles.dashboardCardSub}>{orders.filter(o => o.status === 'pending_approval' && !isTimeReady(o.requested_time, currentTime)).length} Waiting</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('finished')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}><CheckCircle size={28} color="#4caf50" /></View>
                <Text style={styles.dashboardCardTitle}>History</Text>
                <Text style={styles.dashboardCardSub}>Completed</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('runner_pay')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}><Wallet size={28} color="#ff9800" /></View>
                <Text style={styles.dashboardCardTitle}>Payouts</Text>
                <Text style={styles.dashboardCardSub}>{payouts.length} Due</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('cancelled')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(244, 67, 54, 0.15)' }]}><Ban size={28} color="#f44336" /></View>
                <Text style={styles.dashboardCardTitle}>Cancelled</Text>
                <Text style={styles.dashboardCardSub}>Declined</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('server_dues')} style={styles.dashboardCard}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(158, 158, 158, 0.15)' }]}><Server size={28} color="#9e9e9e" /></View>
                <Text style={styles.dashboardCardTitle}>Server Pay</Text>
                <Text style={styles.dashboardCardSub}>Platform Dues</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAdminView('menu_edit')} style={[styles.dashboardCard, {width: '100%'}]}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(96, 125, 139, 0.15)' }]}><Edit3 size={28} color="#607d8b" /></View>
                <Text style={styles.dashboardCardTitle}>Edit Menu</Text>
                <Text style={styles.dashboardCardSub}>Add/Remove Items</Text>
            </TouchableOpacity>
        </View>
    </ScrollView> 
  );
  
  const renderPayouts = () => ( 
    <View style={{flex: 1, paddingTop: 50}}>
        <View style={{flexDirection:'row', alignItems:'center', paddingHorizontal: 20, marginBottom: 10}}>
            <TouchableOpacity onPress={() => setAdminView('dashboard')} style={{padding:8, backgroundColor:colors.card, borderRadius:12}}><ArrowLeft size={24} color={colors.text}/></TouchableOpacity>
            <Text style={{fontSize: 24, fontWeight:'bold', color: colors.text, marginLeft: 15}}>Payouts</Text>
        </View>
        <FlatList data={payouts} keyExtractor={item => item.runner_id} contentContainerStyle={{padding: 20}} renderItem={({item}) => (
            <View style={[styles.adminListCard, {backgroundColor: colors.card, justifyContent:'space-between'}]}>
                <View><Text style={{fontSize: 18, fontWeight:'bold', color: colors.text}}>{item.name}</Text><Text style={{color:'#888'}}>{item.count} Deliveries</Text></View>
                <View style={{alignItems:'flex-end'}}>
                    <Text style={{fontSize: 20, fontWeight:'bold', color: colors.primary, marginBottom: 5}}>₹{item.total}</Text>
                    {item.upi ? (
                        <TouchableOpacity onPress={() => openVendorPayment(item.upi, item.name, item.total, 'RUNNER', item.runner_id)} style={{backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8}}><Text style={{color:'white', fontWeight:'bold'}}>Pay Now</Text></TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} style={{backgroundColor: '#FF5252', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8}}><Text style={{color:'white', fontWeight:'bold'}}>Call</Text></TouchableOpacity>
                    )}
                </View>
            </View>
        )} />
    </View> 
  );
  
  const renderServerDues = () => { 
      const billableOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'resolved'); 
      const amount = billableOrders.length * 2; 
      return (
        <View style={{flex: 1, paddingTop: 50}}>
            <View style={{flexDirection:'row', alignItems:'center', paddingHorizontal: 20, marginBottom: 10}}>
                <TouchableOpacity onPress={() => setAdminView('dashboard')} style={{padding:8, backgroundColor:colors.card, borderRadius:12}}><ArrowLeft size={24} color={colors.text}/></TouchableOpacity>
                <Text style={{fontSize: 24, fontWeight:'bold', color: colors.text, marginLeft: 15}}>Server Payments</Text>
            </View>
            <View style={{padding: 20}}>
                <View style={[styles.adminListCard, {backgroundColor: 'rgba(255, 152, 0, 0.1)', flexDirection:'column', alignItems:'center', paddingVertical: 40, borderWidth: 1, borderColor: '#ff9800'}]}>
                    <Text style={{fontSize: 16, color: '#888', marginBottom: 10}}>Total Platform Fees</Text>
                    <Text style={{fontSize: 48, fontWeight:'bold', color: '#ff9800'}}>₹{amount}</Text>
                </View>
                <TouchableOpacity onPress={() => openVendorPayment(ADMIN_UPI_ID, "SideQuest Admin", amount, 'SERVER')} style={{backgroundColor: '#ff9800', padding: 20, borderRadius: 16, alignItems:'center', marginTop: 20}}>
                    <Text style={{color: 'black', fontWeight:'bold', fontSize: 18}}>Scan & Pay</Text>
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
        </View>
      ); 
  };
  
  const renderMenuEdit = () => ( 
    <View style={{flex: 1, paddingTop: 50}}>
        <View style={{flexDirection:'row', alignItems:'center', paddingHorizontal: 20, marginBottom: 10, justifyContent:'space-between'}}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <TouchableOpacity onPress={() => setAdminView('dashboard')} style={{padding:8, backgroundColor:colors.card, borderRadius:12}}><ArrowLeft size={24} color={colors.text}/></TouchableOpacity>
                <Text style={{fontSize: 24, fontWeight:'bold', color: colors.text, marginLeft: 15}}>Edit Menu</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddMenuModal(true)} style={{backgroundColor: colors.primary, padding:8, borderRadius:20}}>
                <PlusCircle size={28} color="black" />
            </TouchableOpacity>
        </View>
        
        <View style={{paddingHorizontal: 20, marginBottom: 10}}>
            <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: 15, height: 50, borderRadius: 14}}>
                <Search size={20} color="#888" />
                <TextInput placeholder="Search item to edit..." placeholderTextColor="#888" value={menuSearchQuery} onChangeText={setMenuSearchQuery} style={{flex:1, marginLeft: 10, color: colors.text, height: '100%'}} />
            </View>
        </View>

        <FlatList 
            data={menuItems.filter(i => i.name.toLowerCase().includes(menuSearchQuery.toLowerCase()))} 
            keyExtractor={item => item.id} 
            contentContainerStyle={{padding: 20}} 
            renderItem={({item}) => (
                <View style={[styles.adminListCard, {backgroundColor: colors.card}]}>
                    <TouchableOpacity onPress={() => { setEditingItem(item); setNewName(item.name); setNewPrice(item.price.toString()); }} style={{flex:1}}>
                        <Text style={{fontSize: 16, fontWeight:'bold', color: colors.text}}>{item.name}</Text>
                        <Text style={{fontSize: 14, fontWeight:'bold', color: colors.primary}}>₹{item.price}</Text>
                    </TouchableOpacity>
                    <Switch value={item.is_available} onValueChange={() => toggleItemAvailability(item.id, item.is_available)} />
                </View>
            )} 
        />
    </View> 
  );

  const renderOrderList = (filterFn: (o: any) => boolean, title: string, color: string) => ( 
    <View style={{flex: 1, paddingTop: 50}}>
        <View style={{flexDirection:'row', alignItems:'center', paddingHorizontal: 20, marginBottom: 10}}>
            <TouchableOpacity onPress={() => setAdminView('dashboard')} style={{padding:8, backgroundColor:colors.card, borderRadius:12}}><ArrowLeft size={24} color={colors.text}/></TouchableOpacity>
            <Text style={{fontSize: 24, fontWeight:'bold', color: colors.text, marginLeft: 15}}>{title}</Text>
        </View>
        <FlatList 
            data={orders.filter(filterFn)} 
            keyExtractor={item => item.id} 
            contentContainerStyle={{padding: 20}} 
            renderItem={({item}) => {
                
                const isLocked = adminView === 'scheduled' && !isTimeReady(item.requested_time, currentTime);

                return (
                    <View style={[styles.adminListCard, {
                        backgroundColor: isLocked ? '#2e2e2e' : colors.card, 
                        flexDirection:'column', 
                        alignItems:'stretch',
                        opacity: isLocked ? 0.6 : 1
                    }]}>
                        
                        {isLocked ? (
                            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                                <View style={{flexDirection:'row', alignItems:'center', backgroundColor: '#333', padding: 8, borderRadius: 8}}>
                                    <Lock size={16} color="#FF9800" />
                                    <Text style={{color:'#FF9800', fontWeight:'bold', marginLeft: 5}}>DUE AT {item.requested_time}</Text>
                                </View>
                                <TouchableOpacity onPress={() => updateOrderStatus(item.id, 'cancelled')} style={{padding:8, borderRadius:8, borderWidth:1, borderColor:'#ff5252'}}>
                                    <Text style={{color:'#ff5252', fontWeight:'bold', fontSize: 12}}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{backgroundColor: (!item.requested_time || item.requested_time === 'ASAP') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(239, 83, 80, 0.1)', padding: 8, borderRadius: 8, marginBottom: 10, alignSelf: 'flex-start'}}>
                                <Text style={{color: (!item.requested_time || item.requested_time === 'ASAP') ? '#4caf50' : '#ef5350', fontWeight: 'bold', fontSize: 16}}>
                                    Time: {item.requested_time || 'ASAP'}
                                </Text>
                            </View>
                        )}

                        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
                            <Text style={{fontSize: 24, fontWeight:'bold', color: isLocked ? '#888' : color}}>{item.token_no}</Text>
                            <Text style={{fontSize: 24, fontWeight:'bold', color: isLocked ? '#888' : '#2e7d32'}}>₹{item.estimated_cost.toFixed(2)}</Text>
                        </View>
                        <Text style={{fontSize: 16, color: isLocked ? '#888' : colors.text}}>{item.item_description}</Text>
                        <Text style={{color:'#888', fontSize:12, marginTop:5}}>{new Date(item.created_at).toLocaleString()}</Text>
                        
                        {!isLocked && (
                            <View style={{flexDirection:'row', gap: 10, marginTop: 10}}>
                                {item.status === 'pending_approval' && (
                                    <>
                                        <TouchableOpacity onPress={() => updateOrderStatus(item.id, 'cancelled')} style={{flex:1, padding:12, borderRadius:8, borderWidth:1, borderColor:'red', alignItems:'center'}}>
                                            <Text style={{color:'red'}}>Decline</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => updateOrderStatus(item.id, item.order_type === 'delivery' ? 'open' : 'cooking')} style={{flex:1, padding:12, borderRadius:8, backgroundColor:colors.primary, alignItems:'center'}}>
                                            <Text style={{color:'black', fontWeight:'bold'}}>Accept</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                {(item.status === 'cooking' || item.status === 'open') && (
                                    <TouchableOpacity onPress={() => updateOrderStatus(item.id, 'ready')} style={{flex:1, padding:12, borderRadius:8, backgroundColor:'#ff9800', alignItems:'center'}}>
                                        <Text style={{color:'black', fontWeight:'bold'}}>Mark Ready</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                )
            }} 
        />
    </View> 
  );
  
  if (isAdmin) {
      return (
          <View style={[styles.container, { backgroundColor: colors.background }]}>
              {adminView === 'new' && renderOrderList(o => (o.status === 'pending_approval' || o.status === 'open' || o.status === 'cooking') && isTimeReady(o.requested_time, currentTime), 'New Orders', '#2196f3')}
              {adminView === 'scheduled' && renderOrderList(o => o.status === 'pending_approval' && !isTimeReady(o.requested_time, currentTime), 'Scheduled Queue', '#9c27b0')}
              {adminView === 'finished' && renderOrderList(o => o.status === 'ready' || o.status === 'picked_up' || o.status === 'delivered', 'History', '#4caf50')}
              {adminView === 'cancelled' && renderOrderList(o => o.status === 'cancelled', 'Cancelled Orders', '#f44336')}
              {adminView === 'server_dues' && renderServerDues()}
              {adminView === 'runner_pay' && renderPayouts()}
              {adminView === 'menu_edit' && renderMenuEdit()}
              {adminView === 'dashboard' && renderDashboard()}

              <Modal visible={showQRModal} transparent animationType="fade">
                  <View style={styles.modalOverlay}>
                      <View style={[styles.modalContent, {backgroundColor: 'white', alignItems:'center'}]}>
                          <Text style={{fontSize: 22, fontWeight:'bold', color: 'black', marginBottom:10}}>Scan to Pay</Text>
                          <View style={{padding: 10, borderWidth: 2, borderColor: 'black', borderRadius: 10}}>
                              <Image source={{ uri: qrUrl }} style={{ width: 250, height: 250 }} />
                          </View>
                          <Text style={{fontSize: 24, fontWeight:'bold', color: '#00E676', marginVertical: 15}}>₹{pendingTotal.toFixed(2)}</Text>
                          <Text style={{textAlign:'center', color:'#666', marginBottom: 15, fontSize: 12}}>1. Screenshot 📸   2. Scan in GPay/PhonePe</Text>
                          
                          <View style={{width: '100%', marginBottom: 15}}>
                              <Text style={{color: '#333', fontWeight:'bold', marginBottom: 5}}>Verify Payment:</Text>
                              <TextInput placeholder="Enter Last 4 digits of UPI Ref No." placeholderTextColor="#999" value={userUTR} onChangeText={setUserUTR} maxLength={12} keyboardType="numeric" style={{borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, color: 'black', fontSize: 16, textAlign: 'center', backgroundColor: '#f9f9f9'}}/>
                          </View>
                          
                          <View style={{flexDirection:'row', gap: 10, width:'100%'}}>
                              <TouchableOpacity onPress={() => setShowQRModal(false)} style={{flex:1, padding:15, backgroundColor:'#eee', borderRadius:10, alignItems:'center'}}><Text style={{color:'black'}}>Cancel</Text></TouchableOpacity>
                              <TouchableOpacity onPress={handlePaymentSuccess} style={{flex:1, padding:15, backgroundColor:'black', borderRadius:10, alignItems:'center'}}><Text style={{color:'white', fontWeight:'bold'}}>Submit</Text></TouchableOpacity>
                          </View>
                      </View>
                  </View>
              </Modal>

              <Modal visible={!!editingItem} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: colors.card}]}><Text style={{fontSize: 20, fontWeight:'bold', color: colors.text, marginBottom:20}}>Edit Item</Text><TextInput value={newName} onChangeText={setNewName} style={[styles.input, {color: colors.text, borderColor: colors.border}]} /><TextInput value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" style={[styles.input, {color: colors.text, borderColor: colors.border}]} /><TouchableOpacity onPress={updateItemDetails} style={styles.payBtnOnline}><Text style={{color:'black', fontWeight:'bold'}}>Update</Text></TouchableOpacity><TouchableOpacity onPress={() => setEditingItem(null)} style={{alignItems:'center', marginTop:15}}><Text style={{color:'red'}}>Cancel</Text></TouchableOpacity></View>
              
              </KeyboardAvoidingView></Modal>
              <Modal visible={showAddMenuModal} transparent animationType="slide"><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: colors.card}]}><Text style={{fontSize: 20, fontWeight:'bold', color: colors.text, marginBottom:20}}>Add New Item</Text><TextInput placeholder="Name" placeholderTextColor="#666" value={newItem.name} onChangeText={t => setNewItem({...newItem, name: t})} style={[styles.input, {color: colors.text, borderColor: colors.border}]} /><TextInput placeholder="Price" placeholderTextColor="#666" value={newItem.price} onChangeText={t => setNewItem({...newItem, price: t})} keyboardType="numeric" style={[styles.input, {color: colors.text, borderColor: colors.border}]} /><TextInput placeholder="Category" placeholderTextColor="#666" value={newItem.category} onChangeText={t => setNewItem({...newItem, category: t})} style={[styles.input, {color: colors.text, borderColor: colors.border}]} /><TouchableOpacity onPress={addNewMenuItem} style={styles.payBtnOnline}><Text style={{color:'black', fontWeight:'bold'}}>Add Item</Text></TouchableOpacity><TouchableOpacity onPress={() => setShowAddMenuModal(false)} style={{alignItems:'center', marginTop:15}}><Text style={{color:'red'}}>Cancel</Text></TouchableOpacity></View></KeyboardAvoidingView></Modal>
          </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 }}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
              <View>
                  <Text style={{fontSize: 28, fontWeight:'bold', color: colors.text}}>Campus Eats 🍔</Text>
                  
                  {!shopStatus && (
                      <Text style={{color: '#FF5252', fontWeight: 'bold', fontSize: 12, marginTop: 2}}>🔴 CURRENTLY CLOSED</Text>
                  )}
              </View>
              <JuicyButton onPress={() => { fetchMyOrders(); setShowMyOrders(true); }} style={styles.myOrdersBtn} scaleTo={0.9}>
                  <Receipt size={18} color="black" />
                  <Text style={{color:'black', fontWeight:'bold', marginLeft: 5}}>My Orders</Text>
              </JuicyButton>
          </View>

          <View style={styles.shopToggleContainer}>
              <JuicyButton onPress={() => { setSelectedShop('Five Star'); setCart({}); }} style={[styles.shopTab, selectedShop === 'Five Star' && styles.shopTabActive]} scaleTo={0.95}>
                  <Utensils size={18} color={selectedShop === 'Five Star' ? 'white' : '#888'} /><Text style={[styles.shopTabText, selectedShop === 'Five Star' && {color:'white'}]}>Five Star</Text>
              </JuicyButton>
              <JuicyButton onPress={() => { setSelectedShop('Ground View Cafe'); setCart({}); }} style={[styles.shopTab, selectedShop === 'Ground View Cafe' && styles.shopTabActive]} scaleTo={0.95}>
                  <Coffee size={18} color={selectedShop === 'Ground View Cafe' ? 'white' : '#888'} /><Text style={[styles.shopTabText, selectedShop === 'Ground View Cafe' && {color:'white'}]}>Ground View</Text>
              </JuicyButton>
          </View>

          <View style={{flexDirection:'row', gap: 10, marginTop: 15}}>
              <View style={[styles.searchBar, {backgroundColor: colors.card}]}>
                  <Search size={20} color="#888" />
                  <TextInput placeholder={`Search ${selectedShop}...`} placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} style={{flex:1, marginLeft: 10, color: colors.text}} />
                  <JuicyButton onPress={() => setShowFilterModal(true)}>
                      <Filter size={20} color={colors.text} />
                  </JuicyButton>
              </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
              {categories.map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)} style={[styles.catTab, selectedCategory === cat && {backgroundColor: colors.text}]}>
                      <Text style={{color: selectedCategory === cat ? colors.background : colors.text, fontWeight:'bold'}}>{cat}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      <FlatList 
        data={filteredItems} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{ padding: 20, paddingBottom: 150 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAllData} tintColor={colors.primary} />} 
        renderItem={({ item }) => (
            <View style={[styles.menuCard, { backgroundColor: colors.card, opacity: item.is_available ? 1 : 0.6 }]}>
                <View style={{flex:1}}>
                    <Text style={{fontSize: 17, fontWeight:'bold', color: colors.text}}>{item.name}</Text>
                    <Text style={{color:'#888', fontSize:12}}>{item.category}</Text>
                    <Text style={{color: colors.primary, fontWeight:'bold', fontSize: 16}}>₹{item.price}</Text>
                </View>
                {item.is_available ? (
                    cart[item.id] ? (
                        <View style={styles.qtyControl}>
                            <JuicyButton onPress={() => updateCart(item.id, -1)} scaleTo={0.8}><Minus size={18} color="white"/></JuicyButton>
                            <Text style={{marginHorizontal: 10, color: 'white'}}>{cart[item.id]}</Text>
                            <JuicyButton onPress={() => updateCart(item.id, 1)} scaleTo={0.8}><Plus size={18} color="white"/></JuicyButton>
                        </View>
                    ) : (
                        <JuicyButton onPress={() => updateCart(item.id, 1)} style={styles.addBtn} scaleTo={0.9}>
                            <Text style={{color:'black', fontWeight:'bold'}}>ADD</Text>
                        </JuicyButton>
                    )
                ) : (
                    <View style={{backgroundColor:'#333', padding:8, borderRadius:8}}><Text style={{color:'#888', fontSize:10, fontWeight:'bold'}}>SOLD OUT</Text></View>
                )}
            </View>
        )} 
      />
      {Object.keys(cart).length > 0 && (
          <JuicyButton onPress={() => setShowCheckout(true)} style={styles.floatingBtn} scaleTo={0.95}>
              <Text style={{color:'black', fontWeight:'bold', fontSize: 16}}>{Object.values(cart).reduce((a,b)=>a+b,0)} Items</Text>
              <Text style={{color:'black', fontWeight:'bold', fontSize: 16}}>View Cart</Text>
          </JuicyButton>
      )}
      
      <Modal visible={showCheckout} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 20}}>
                    <Text style={{fontSize: 22, fontWeight:'bold', color: colors.text}}>Your Order</Text>
                    <TouchableOpacity onPress={() => setShowCheckout(false)}><X size={24} color={colors.text}/></TouchableOpacity>
                </View>
                <ScrollView style={{maxHeight: 150}}>
                    {Object.keys(cart).map(id => { 
                        const i = menuItems.find(m => m.id === id); 
                        if(!i) return null; 
                        return (
                            <View key={id} style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:0.5, borderColor:'#eee'}}>
                                <View style={{flex: 1}}><Text style={{color:colors.text, fontSize: 16}}>{i.name}</Text><Text style={{color:colors.primary, fontWeight:'bold'}}>₹{i.price * cart[id]}</Text></View>
                                <View style={[styles.qtyControl, {backgroundColor: '#333'}]}>
                                    <JuicyButton onPress={() => updateCart(id, -1)} scaleTo={0.8}><Minus size={16} color="white"/></JuicyButton>
                                    <Text style={{marginHorizontal: 10, color: 'white', fontWeight:'bold'}}>{cart[id]}</Text>
                                    <JuicyButton onPress={() => updateCart(id, 1)} scaleTo={0.8}><Plus size={16} color="white"/></JuicyButton>
                                </View>
                            </View>
                        ) 
                    })}
                </ScrollView>
                <View style={{marginVertical: 10}}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}><Text style={{color:'#888'}}>Item Total</Text><Text style={{color:colors.text}}>₹{getCartItemTotal()}</Text></View>
                    {orderType !== 'dine_in' && <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}><Text style={{color:'#888'}}>Packaging</Text><Text style={{color:colors.text}}>₹{getPackagingTotal()}</Text></View>}
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}><Text style={{color:'#888'}}>Platform Fee</Text><Text style={{color:colors.text}}>₹2.00</Text></View>
                    {orderType === 'delivery' && (<View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 5}}><Text style={{color:'#888'}}>Delivery Fee</Text><Text style={{color:colors.text}}>₹20</Text></View>)}
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 5, paddingTop:10, borderTopWidth:1, borderColor:'#333'}}><Text style={{color:colors.text, fontSize: 18, fontWeight:'bold'}}>Grand Total</Text><Text style={{color:colors.primary, fontSize: 18, fontWeight:'bold'}}>₹{getCartItemTotal() + getPackagingTotal() + (orderType==='delivery'?20:0) + 2}</Text></View>
                </View>
                
                {orderType === 'delivery' && (
                    <View style={{marginBottom: 15}}>
                        <Text style={{color: '#888', marginBottom: 5, fontSize: 12}}>Delivery Address</Text>
                        <View style={{flexDirection:'row', alignItems:'center', backgroundColor: '#333', borderRadius: 10, paddingHorizontal: 10}}>
                            <MapPin size={16} color="#00E676" />
                            <TextInput placeholder="Hostel Block, Room No" placeholderTextColor="#666" value={deliveryAddress} onChangeText={setDeliveryAddress} style={{flex: 1, padding: 12, color: 'white'}} />
                        </View>
                    </View>
                )}
                
                <View style={{marginBottom: 15}}>
                    <Text style={{color: '#888', marginBottom: 5, fontSize: 12}}>When do you want it?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {availableTimeSlots.map((slot) => (
                            <TouchableOpacity 
                                key={slot} 
                                onPress={() => setRequestedTime(slot)}
                                style={{
                                    backgroundColor: requestedTime === slot ? '#00E676' : '#333',
                                    paddingHorizontal: 15,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    marginRight: 10
                                }}
                            >
                                <Text style={{
                                    color: requestedTime === slot ? 'black' : 'white',
                                    fontWeight: 'bold'
                                }}>
                                    {slot}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={{flexDirection:'row', marginVertical: 15, backgroundColor:'#333', borderRadius:10, padding:5}}>
                    {selectedShop === 'Ground View Cafe' ? (
                        <>
                            <TouchableOpacity onPress={() => setOrderType('dine_in')} style={[styles.tab, orderType==='dine_in' && {backgroundColor:colors.card}]}><Text style={{color:colors.text, fontWeight: orderType==='dine_in'?'bold':'normal'}}>Eat Here</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setOrderType('takeaway')} style={[styles.tab, orderType==='takeaway' && {backgroundColor:colors.card}]}><Text style={{color:colors.text, fontWeight: orderType==='takeaway'?'bold':'normal'}}>Takeaway</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setOrderType('delivery')} style={[styles.tab, orderType==='delivery' && {backgroundColor:colors.card}]}><Text style={{color:colors.text, fontWeight: orderType==='delivery'?'bold':'normal'}}>Delivery</Text></TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity onPress={() => setOrderType('takeaway')} style={[styles.tab, orderType==='takeaway' && {backgroundColor:colors.card}]}><Text style={{color:colors.text, fontWeight: orderType==='takeaway'?'bold':'normal'}}>Takeaway</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setOrderType('delivery')} style={[styles.tab, orderType==='delivery' && {backgroundColor:colors.card}]}><Text style={{color:colors.text, fontWeight: orderType==='delivery'?'bold':'normal'}}>Delivery</Text></TouchableOpacity>
                        </>
                    )}
                </View>
                <JuicyButton onPress={() => placeOrder('online')} style={styles.payBtnOnline} scaleTo={0.95}>
                    <Text style={{color:'black', fontWeight:'bold'}}>Pay Online</Text>
                </JuicyButton>
            </View>
        </View>
      </Modal>

      <Modal visible={showQRModal} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: 'white', alignItems:'center'}]}><Text style={{fontSize: 22, fontWeight:'bold', color: 'black', marginBottom:10}}>Scan to Pay</Text><View style={{padding: 10, borderWidth: 2, borderColor: 'black', borderRadius: 10}}><Image source={{ uri: qrUrl }} style={{ width: 250, height: 250 }} /></View><Text style={{fontSize: 24, fontWeight:'bold', color: '#00E676', marginVertical: 15}}>₹{pendingTotal.toFixed(2)}</Text><Text style={{textAlign:'center', color:'#666', marginBottom: 15, fontSize: 12}}>1. Screenshot 📸   2. Scan in GPay/PhonePe</Text><View style={{width: '100%', marginBottom: 15}}><Text style={{color: '#333', fontWeight:'bold', marginBottom: 5}}>Verify Payment:</Text><TextInput placeholder="Enter Last 4 digits of UPI Ref No." placeholderTextColor="#999" value={userUTR} onChangeText={setUserUTR} maxLength={12} keyboardType="numeric" style={{borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, color: 'black', fontSize: 16, textAlign: 'center', backgroundColor: '#f9f9f9'}}/></View><View style={{flexDirection:'row', gap: 10, width:'100%'}}><TouchableOpacity onPress={() => setShowQRModal(false)} style={{flex:1, padding:15, backgroundColor:'#eee', borderRadius:10, alignItems:'center'}}><Text style={{color:'black'}}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={handlePaymentSuccess} style={{flex:1, padding:15, backgroundColor:'black', borderRadius:10, alignItems:'center'}}><Text style={{color:'white', fontWeight:'bold'}}>Submit</Text></TouchableOpacity></View></View></View></Modal>

      <Modal visible={showMyOrders} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.container, {backgroundColor: colors.background}]}>
              <View style={{padding: 20, paddingTop: 60, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                  <Text style={{fontSize: 24, fontWeight:'bold', color: colors.text}}>My Orders</Text>
                  <TouchableOpacity onPress={() => setShowMyOrders(false)}><X size={24} color={colors.text}/></TouchableOpacity>
              </View>
              <FlatList 
                  data={myOrders} 
                  keyExtractor={item => item.id} 
                  contentContainerStyle={{padding: 20}} 
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMyOrders} tintColor="#00E676" />} 
                  ListEmptyComponent={<Text style={{textAlign:'center', color:'#888', marginTop:50}}>No orders yet.</Text>} 
                  renderItem={({item}) => (
                      <View style={[styles.card, {backgroundColor: colors.card, borderColor: item.status === 'ready' ? '#00E676' : 'transparent', borderWidth: 1}]}>
                          <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 10}}>
                              <Text style={{fontSize: 18, fontWeight:'bold', color: colors.text}}>{item.shop_name}</Text>
                              <Text style={{color: item.status === 'cancelled' ? '#ff5252' : '#00E676', fontWeight:'bold'}}>{item.status.toUpperCase().replace('_',' ')}</Text>
                          </View>
                          <Text style={{color: '#888', fontSize: 13, marginBottom: 10}}>{new Date(item.created_at).toLocaleString()}</Text>
                          <Text style={{color: colors.text, marginBottom: 10}}>{item.item_description}</Text>
                          <Text style={{color: '#FF9800', fontWeight: 'bold', marginBottom: 10}}>Requested Time: {item.requested_time || 'ASAP'}</Text>
                          {item.delivery_address && <View style={{flexDirection:'row', marginBottom:10}}><MapPin size={14} color="#888"/><Text style={{color:'#888', marginLeft:5, fontSize:12}}>{item.delivery_address}</Text></View>}
                          
                          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10}}>
                              <View>
                                  <Text style={{color:'#888', fontSize: 12}}>Token</Text>
                                  <Text style={{fontSize: 20, fontWeight:'bold', color: colors.text}}>{item.token_no}</Text>
                              </View>
                              {item.order_type === 'delivery' && (
                                  <View style={{alignItems:'flex-end'}}>
                                      <Text style={{color:'#888', fontSize: 12}}>Delivery OTP</Text>
                                      <Text style={{fontSize: 20, fontWeight:'bold', color: '#00E676', letterSpacing: 2}}>{item.delivery_otp}</Text>
                                  </View>
                              )}
                          </View>

                          {item.status === 'cancelled' && (
                              <View style={{marginTop: 15, backgroundColor: 'rgba(255,82,82,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ff5252'}}>
                                  <Text style={{color: 'white', fontWeight: 'bold', marginBottom: 5}}>Order Cancelled</Text>
                                  <Text style={{color: '#ccc', fontSize: 13, marginBottom: 10}}>Please visit the store to resolve any payment or menu issues.</Text>
                                  <TouchableOpacity onPress={() => resolveCancelledOrder(item.id)} style={{backgroundColor: '#ff5252', padding: 12, borderRadius: 8, alignItems: 'center'}}>
                                      <Text style={{color: 'white', fontWeight: 'bold'}}>Mark as Resolved (Clear)</Text>
                                  </TouchableOpacity>
                              </View>
                          )}

                          {item.status === 'ready' && <TouchableOpacity onPress={() => completeOrder(item.id)} style={{marginTop: 15, backgroundColor: 'black', padding: 12, borderRadius: 10, alignItems: 'center'}}><Text style={{color: 'white', fontWeight: 'bold'}}>Complete Order (Picked Up)</Text></TouchableOpacity>}
                      </View>
                  )} 
              />
          </View>
      </Modal>
      
      <Modal visible={showFilterModal} transparent animationType="fade"><View style={styles.modalOverlay}><View style={[styles.modalContent, {backgroundColor: colors.card}]}><View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 20}}><Text style={{fontSize: 20, fontWeight:'bold', color: colors.text}}>Filter & Sort</Text><TouchableOpacity onPress={() => setShowFilterModal(false)}><X size={24} color={colors.text}/></TouchableOpacity></View><Text style={{color: '#888', marginBottom: 10, fontWeight:'bold'}}>Preferences</Text><View style={{flexDirection:'row', gap: 10, marginBottom: 20}}>{['all', 'veg', 'non-veg'].map((type: any) => (<TouchableOpacity key={type} onPress={() => setFilterType(type)} style={[styles.filterChip, filterType === type && {backgroundColor: colors.text}]}><Text style={{color: filterType === type ? colors.background : colors.text, fontWeight:'bold', textTransform: 'capitalize'}}>{type}</Text></TouchableOpacity>))}</View><Text style={{color: '#888', marginBottom: 10, fontWeight:'bold'}}>Price</Text><View style={{flexDirection:'row', gap: 10}}><TouchableOpacity onPress={() => setSortOrder('asc')} style={[styles.filterChip, sortOrder === 'asc' && {backgroundColor: colors.text}]}><ArrowUp size={16} color={sortOrder === 'asc' ? colors.background : colors.text} /><Text style={{color: sortOrder === 'asc' ? colors.background : colors.text, fontWeight:'bold', marginLeft: 5}}>Low to High</Text></TouchableOpacity><TouchableOpacity onPress={() => setSortOrder('desc')} style={[styles.filterChip, sortOrder === 'desc' && {backgroundColor: colors.text}]}><ArrowDown size={16} color={sortOrder === 'desc' ? colors.background : colors.text} /><Text style={{color: sortOrder === 'desc' ? colors.background : colors.text, fontWeight:'bold', marginLeft: 5}}>High to Low</Text></TouchableOpacity></View><JuicyButton onPress={() => setShowFilterModal(false)} style={styles.payBtnOnline}><Text style={{color:'black', fontWeight:'bold'}}>Apply Filters</Text></JuicyButton></View></View></Modal>
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

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
  {alertButtons.map((btn, index) => (
    <TouchableOpacity
      key={index}
      onPress={() => {
        setAlertVisible(false);
        if (btn.onPress) btn.onPress();
      }}
      style={{
        backgroundColor:
          index === alertButtons.length - 1 ? "#00E676" : "#333",
        padding: 12,
        borderRadius: 8
      }}
    >
      <Text
        style={{
          color:
            index === alertButtons.length - 1 ? "black" : "white",
          fontWeight: "bold"
        }}
      >
        {btn.text}
      </Text>
    </TouchableOpacity>
  ))}
</View>
    </View>
  </View>
</Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dashboardCard: { width: '48%', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#333', elevation: 2 },
  iconBox: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dashboardCardTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  dashboardCardSub: { color: '#888', fontSize: 13, marginTop: 4, fontWeight: '500' },
  adminListCard: { padding: 20, borderRadius: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 3 },
  adminStatusCard: { padding: 20, borderRadius: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },

  shopToggleContainer: { flexDirection: 'row', backgroundColor: '#eee', borderRadius: 16, padding: 5, marginTop: 15 },
  shopTab: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  shopTabActive: { backgroundColor: '#333', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.2, elevation:3 },
  shopTabText: { fontWeight: 'bold', marginLeft: 8, color: '#888' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50, borderRadius: 14 },
  filterBtn: { width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#ccc' },
  catTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', marginRight: 10 },
  menuCard: { flexDirection: 'row', padding: 16, borderRadius: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
  addBtn: { backgroundColor: '#00E676', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'black', padding: 8, borderRadius: 12 },
  floatingBtn: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#00E676', padding: 20, borderRadius: 25, flexDirection: 'row', justifyContent: 'space-between', elevation: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 30, padding: 30 },
  tab: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  payBtnOnline: { backgroundColor: '#00E676', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  myOrdersBtn: { backgroundColor: '#00E676', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  card: { padding: 20, borderRadius: 20, marginBottom: 15 },
  filterChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center' },
  label: { color: '#888', marginBottom: 5, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 }
});