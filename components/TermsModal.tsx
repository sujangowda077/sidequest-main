import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Shield, X, Check } from 'lucide-react-native';

const { height } = Dimensions.get('window');

export default function TermsModal({ visible, onClose, onAgree, showAgreeButton }: { visible: boolean, onClose: () => void, onAgree?: () => void, showAgreeButton: boolean }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <Shield size={24} color="#00E676" />
            <Text style={styles.title}>Terms of Service</Text>
            {!showAgreeButton && (
                <TouchableOpacity onPress={onClose}>
                    <X size={24} color="white" />
                </TouchableOpacity>
            )}
          </View>

          <Text style={styles.subTitle}>Last Updated: Feb 2026</Text>

          {/* SCROLLABLE CONTENT */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={{paddingBottom: 20}}>
            
            <Text style={styles.sectionHeader}>1. Non-Profit Facilitator</Text>
            <Text style={styles.text}>
              "Campus Eats" is a student-run, non-profit software project designed solely to facilitate communication between Students, Campus Vendors, and Delivery Runners. The App itself is not a business entity and generates no profit.
            </Text>

            <Text style={styles.sectionHeader}>2. Financial Liability Disclaimer</Text>
            <Text style={styles.text}>
              <Text style={{fontWeight:'bold', color:'#ef5350'}}>CAUTION: </Text>
              The App acts only as a messenger. We do not hold, process, or guarantee any funds. 
              {'\n\n'}• Any complaints regarding payment failures, double deductions, or refunds must be taken up directly with the <Text style={{fontWeight:'bold'}}>Vendor (Shop Owner)</Text>.
              {'\n'}• The App developers and administrators are <Text style={{fontWeight:'bold'}}>NOT liable</Text> for any financial loss incurred during the use of this service.
            </Text>

            <Text style={styles.sectionHeader}>3. Delivery Runners</Text>
            <Text style={styles.text}>
              Runners are independent students, not employees. The App does not supervise their conduct.
              {'\n\n'}• Any disputes regarding delivery time, behavior, or missing items should be resolved amicably with the Runner or Vendor.
              {'\n'}• We facilitate the connection but do not guarantee the service quality of individual Runners.
            </Text>

            <Text style={styles.sectionHeader}>4. User Conduct</Text>
            <Text style={styles.text}>
              You agree to use accurate information (Name, ID, Phone). Falsifying identity or uploading fake ID cards will result in an <Text style={{fontWeight:'bold', color:'#ef5350'}}>IMMEDIATE & PERMANENT BAN</Text> without appeal.
            </Text>

            <Text style={styles.sectionHeader}>5. Service Availability</Text>
            <Text style={styles.text}>
              The service is provided "as is". We reserve the right to shut down the app, modify features, or ban users at any time without prior notice.
            </Text>

          </ScrollView>

          {/* AGREE BUTTON (Only for Sign Up) */}
          {showAgreeButton ? (
             <TouchableOpacity onPress={onAgree} style={styles.agreeBtn}>
                <Check size={20} color="black" />
                <Text style={styles.agreeText}>I Read & Accept</Text>
             </TouchableOpacity>
          ) : (
             <TouchableOpacity onPress={onClose} style={[styles.agreeBtn, {backgroundColor: '#333'}]}>
                <Text style={[styles.agreeText, {color:'white'}]}>Close</Text>
             </TouchableOpacity>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  container: { backgroundColor: '#1E1E1E', borderRadius: 20, maxHeight: height * 0.8, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: 'white', marginLeft: 10 },
  subTitle: { color: '#666', fontSize: 12, marginBottom: 15 },
  scrollArea: { marginBottom: 15 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#00E676', marginTop: 15, marginBottom: 5 },
  text: { color: '#ccc', lineHeight: 22, fontSize: 14 },
  agreeBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  agreeText: { color: 'black', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }
});