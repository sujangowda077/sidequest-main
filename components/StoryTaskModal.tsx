import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { Upload, Instagram, X } from 'lucide-react-native';

export default function StoryTaskModal({ visible, onClose, userId, onUploadComplete }: any) {
  const [uploading, setUploading] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);

  // 🔴 REPLACE WITH YOUR ACTUAL REEL LINK
  const REEL_LINK = "https://www.instagram.com/reel/YOUR_REEL_ID"; 

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5, // Low quality to save bandwidth
        base64: true
    });

    if (!result.canceled && result.assets[0].base64) {
        uploadProof(result.assets[0].base64);
    }
  }

  async function uploadProof(base64: string) {
      setUploading(true);
      try {
          const fileName = `proof_${userId}_${Date.now()}.jpg`;
          const { error } = await supabase.storage.from('proofs').upload(fileName, decode(base64), { contentType: 'image/jpeg' });
          if (error) throw error;
          
          const { data } = supabase.storage.from('proofs').getPublicUrl(fileName);
          
          // Save URL to profile
          await supabase.from('profiles').update({ 
              story_proof_url: data.publicUrl,
              has_seen_intro: true 
          }).eq('id', userId);

          setProofImage(data.publicUrl);
          Alert.alert("Uploaded!", "Admin will verify your story soon. +200 Mana pending!");
          onUploadComplete();
      } catch (e: any) {
          Alert.alert("Error", e.message);
      } finally {
          setUploading(false);
      }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <TouchableOpacity onPress={onClose} style={{alignSelf:'flex-end'}}><X size={24} color="black"/></TouchableOpacity>
          
          <Text style={styles.title}>🎁 Free 200 Mana (₹2)</Text>
          <Text style={styles.sub}>1. Repost our Reel on your Story.</Text>
          <Text style={styles.sub}>2. Tag <Text style={{fontWeight:'bold'}}>@sidequest</Text></Text>
          <Text style={styles.sub}>3. Upload Screenshot here.</Text>

          <TouchableOpacity onPress={() => Linking.openURL(REEL_LINK)} style={styles.instaBtn}>
             <Instagram size={20} color="white" />
             <Text style={{color:'white', fontWeight:'bold', marginLeft: 10}}>Open Reel</Text>
          </TouchableOpacity>

          {proofImage ? (
              <View style={{alignItems:'center', marginVertical: 20}}>
                  <Image source={{uri: proofImage}} style={{width: 100, height: 180, borderRadius: 10}} />
                  <Text style={{color:'green', fontWeight:'bold', marginTop: 10}}>Pending Verification ⏳</Text>
              </View>
          ) : (
              <TouchableOpacity onPress={pickImage} style={styles.uploadBtn}>
                  {uploading ? <ActivityIndicator color="black"/> : <Upload size={24} color="black" />}
                  <Text style={{fontWeight:'bold', marginLeft: 10}}>Upload Screenshot</Text>
              </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  content: { backgroundColor: 'white', padding: 25, borderRadius: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#8E2DE2' },
  sub: { fontSize: 16, color: '#444', marginBottom: 5, textAlign: 'center' },
  instaBtn: { flexDirection: 'row', backgroundColor: '#E1306C', padding: 15, borderRadius: 12, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  uploadBtn: { flexDirection: 'row', backgroundColor: '#eee', padding: 15, borderRadius: 12, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 10 }
});