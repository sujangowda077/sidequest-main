import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Modal
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Send, Sparkles, X, MessageCircle } from 'lucide-react-native';

// 🔴 CONFIGURATION
const BOT_ID = '00000000-0000-0000-0000-000000000001';
// ⚠️ SECURITY WARNING: Do not share this key publicly or commit to GitHub!
const GROQ_API_KEY = ""; 

export default function SupportChat({ visible, onClose, userId }: { visible: boolean, onClose: () => void, userId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [botTyping, setBotTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
        fetchMessages();
        const channel = supabase.channel('support_chat')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
             const msg = payload.new;
             // Only listen for new messages to display them
             if (msg.receiver_id === userId || msg.user_id === userId) {
                 fetchSingleMessage(msg.id);
             }
          })
          .subscribe();
        return () => { supabase.removeChannel(channel); };
    }
  }, [visible]);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name)')
      .or(`receiver_id.eq.${userId},user_id.eq.${userId}`) 
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    setLoading(false);
  }

  async function fetchSingleMessage(msgId: string) {
      const { data } = await supabase.from('messages').select('*, profiles(full_name)').eq('id', msgId).single();
      if (data) {
          setMessages(prev => {
              if (prev.find(m => m.id === data.id)) return prev;
              return [...prev, data];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      }
  }

  // 🟢 AI LOGIC (GROQ)
  async function callLLM(userMessage: string, history: any[]) {
    try {
        // 1. Prepare Context (Last 5 messages)
        const recentContext = history.slice(-5).map(m => ({
            role: m.user_id === BOT_ID ? "assistant" : "user",
            content: m.content
        }));

        // 2. Call Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama3-8b-8192", // Fast & Free Model
                messages: [
                    { role: "system", content: "You are Campus Genie, a helpful, fun, and concise assistant for a student app called SideQuest. Keep answers short (under 3 sentences) and use emojis." },
                    ...recentContext,
                    { role: "user", content: userMessage }
                ],
                max_tokens: 150
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return "I'm having trouble connecting to my brain right now. 🧠";

    } catch (error) {
        console.error("AI Error:", error);
        return "Oops, something went wrong with the AI.";
    }
  }

  async function sendMessage() {
      if (!inputText.trim()) return;
      const content = inputText.trim();
      setInputText('');
      
      // 1. Save User Message
      const { error } = await supabase.from('messages').insert({
          user_id: userId,
          content: content,
          receiver_id: BOT_ID 
      });

      if (error) { console.error(error); return; }

      // 2. Trigger Bot Response
      setBotTyping(true);
      
      // Call AI
      const aiReply = await callLLM(content, messages);

      // 3. Save Bot Message to Database
      await supabase.from('messages').insert({
          user_id: BOT_ID, // Acting as the Bot
          content: aiReply,
          receiver_id: userId
      });

      setBotTyping(false);
  }

  const renderMessage = ({ item }: { item: any }) => {
      const isBot = item.user_id === BOT_ID;

      if (isBot) {
        return (
            <View style={styles.botRow}>
                <View style={styles.botAvatar}>
                    <Sparkles size={18} color="white" />
                </View>
                <View style={styles.botBubble}>
                    <Text style={styles.botName}>Campus Genie 🧞‍♂️</Text>
                    <Text style={styles.botText}>{item.content}</Text>
                </View>
            </View>
        );
      }

      return (
          <View style={[styles.msgRow, { justifyContent: 'flex-end' }]}>
              <View style={styles.meBubble}>
                  <Text style={styles.meText}>{item.content}</Text>
              </View>
          </View>
      );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Text style={styles.headerTitle}>Support Chat</Text>
                <View style={styles.onlineBadge}><Text style={styles.onlineText}>AI ONLINE</Text></View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={24} color="white" />
            </TouchableOpacity>
        </View>

        {loading ? (
            <ActivityIndicator size="large" color="#00E676" style={{marginTop: 50}} />
        ) : (
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 15, paddingBottom: 40 }}
                ListFooterComponent={
                    botTyping ? <Text style={{marginLeft: 50, color:'#888', fontStyle:'italic', marginBottom: 10}}>Genie is thinking...</Text> : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MessageCircle size={40} color="#333" />
                        <Text style={{color:'#666', marginTop:10}}>Ask Campus Genie anything!</Text>
                    </View>
                }
            />
        )}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.inputContainer}>
                <TextInput 
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type your issue..."
                    placeholderTextColor="#666"
                    style={styles.input}
                />
                <TouchableOpacity onPress={sendMessage} style={styles.sendBtn} disabled={botTyping}>
                    {botTyping ? <ActivityIndicator color="black" size="small" /> : <Send size={20} color="black" />}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { padding: 20, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  onlineBadge: { backgroundColor: '#00E676', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
  onlineText: { color: 'black', fontSize: 10, fontWeight: 'bold' },
  msgRow: { flexDirection: 'row', marginBottom: 15 },
  meBubble: { backgroundColor: '#00E676', padding: 12, borderRadius: 16, borderBottomRightRadius: 2, maxWidth: '80%' },
  meText: { color: 'black', fontSize: 16 },
  botRow: { flexDirection: 'row', marginBottom: 15, maxWidth: '85%' },
  botAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF0099', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  botBubble: { flex: 1, backgroundColor: '#252525', padding: 12, borderRadius: 16, borderBottomLeftRadius: 2 },
  botName: { color: '#FF0099', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  botText: { color: 'white', fontSize: 16 },
  emptyState: { alignItems: 'center', marginTop: 100, opacity: 0.7 },
  inputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderTopColor: '#333', backgroundColor: '#1E1E1E', marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#333', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, color: 'white', marginRight: 10 },
  sendBtn: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#00E676', justifyContent: 'center', alignItems: 'center' }
});
