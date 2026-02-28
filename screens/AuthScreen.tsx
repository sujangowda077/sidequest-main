import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal 
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Gamepad2, CheckSquare, Square, Lock, Mail, X, KeyRound } from 'lucide-react-native'; 
import TermsModal from '../components/TermsModal';

export default function AuthScreen() {
    const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState('');
const [alertMessage, setAlertMessage] = useState('');

function showAlert(title: string, message: string) {
  setAlertTitle(title);
  setAlertMessage(message);
  setAlertVisible(true);
}
  // General State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modes: 'login', 'signup', 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Forgot Password State
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  
  // Terms
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // 🟢 MAIN HANDLER (LOGIN & SIGNUP)
  async function handleAction() {
    setLoading(true);

    try {
        // Basic Validations
        if (!email || !email.includes('@')) throw new Error("Please enter a valid email address.");
        if (password.length < 6) throw new Error("Passcode must be at least 6 characters.");

        // ==========================
        // 1. SIGN UP FLOW
        // ==========================
        if (authMode === 'signup') {
            if (!agreedToTerms) throw new Error("Please agree to the Rules of the Game first.");
            
            const { error } = await supabase.auth.signUp({ 
                email: email.trim().toLowerCase(), 
                password: password 
            });
            
            if (error) throw error;
            showAlert('Welcome! 🎮', 'Account created successfully.');
        } 

        // ==========================
        // 2. LOGIN FLOW
        // ==========================
        else if (authMode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ 
                email: email.trim().toLowerCase(), 
                password: password 
            });
            
            if (error) throw error;
        }

    } catch (error: any) {
        console.log(error);
        showAlert('Error', error.message || "Something went wrong.");
    } finally {
        setLoading(false);
    }
  }

  // 🟢 FORGOT PASSWORD: Send Code
  async function handleSendResetCode() {
      if (!email || !email.includes('@')) {
          showAlert("Error", "Please enter your account email first.");
          return;
      }

      setLoading(true);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
          if (error) throw error;
          
          setCodeSent(true);
          showAlert("Code Sent! 📧", "Check your email for the recovery code.");
      } catch (error: any) {
          showAlert("Error", error.message);
      } finally {
          setLoading(false);
      }
  }

  // 🟢 FORGOT PASSWORD: Verify Code & Reset
  async function handleVerifyAndReset() {
      if (!resetCode || resetCode.length < 6) {
          showAlert("Error", "Please enter the 6-digit code.");
          return;
      }
      if (newPassword.length < 6) {
          showAlert("Error", "New passcode must be at least 6 characters.");
          return;
      }

      setLoading(true);
      try {
          // 1. Verify the OTP
          const { error: verifyError } = await supabase.auth.verifyOtp({
              email: email.trim().toLowerCase(),
              token: resetCode,
              type: 'recovery'
          });

          if (verifyError) throw verifyError;

          // 2. The user is now temporarily logged in by the OTP. Update their password.
          const { error: updateError } = await supabase.auth.updateUser({ 
              password: newPassword 
          });

          if (updateError) throw updateError;

          showAlert("Success! 🔓", "Your passcode has been reset. You are now logged in.");
          // They are automatically logged in by the verifyOtp step, so the app will naturally route them away from AuthScreen.

      } catch (error: any) {
          showAlert("Reset Failed", error.message);
      } finally {
          setLoading(false);
      }
  }

  // Helper to reset UI when switching modes
  const switchMode = (mode: 'login' | 'signup' | 'forgot') => {
      setAuthMode(mode);
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setCodeSent(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      
      {/* 🟢 TOP BAR */}
      <View style={styles.topBar}>
          {authMode === 'forgot' ? (
              <TouchableOpacity onPress={() => switchMode('login')} style={styles.toggleBtn}>
                  <Text style={styles.toggleText}>Back to Login</Text>
              </TouchableOpacity>
          ) : (
              <TouchableOpacity onPress={() => switchMode(authMode === 'login' ? 'signup' : 'login')} style={styles.toggleBtn}>
                  <Text style={styles.toggleText}>{authMode === 'login' ? "Join SideQuest" : "Log In"}</Text>
              </TouchableOpacity>
          )}
      </View>

      <View style={styles.content}>
        
        {/* LOGO */}
        <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
                <Gamepad2 size={48} color="#00E676" fill="black" />
            </View>
            <Text style={styles.title}>{authMode === 'forgot' ? 'Recovery' : 'SideQuest'}</Text>
            <Text style={styles.slogan}>{authMode === 'forgot' ? 'Reset your passcode.' : 'By the students, for the students.'}</Text>
        </View>

        <View style={styles.form}>
          
          {/* 🟢 FORGOT PASSWORD UI */}
          {authMode === 'forgot' ? (
              <>
                  <Text style={styles.label}>Account Email</Text>
                  <View style={styles.inputWrapper}>
                      <View style={{paddingLeft: 15}}><Mail size={20} color="#71717a" /></View>
                      <View style={styles.divider} />
                      <TextInput
                        placeholder="student@college.edu"
                        placeholderTextColor="#52525b"
                        value={email}
                        onChangeText={setEmail} 
                        keyboardType="email-address" 
                        autoCapitalize="none"
                        style={styles.input}
                        editable={!codeSent}
                      />
                  </View>

                  {!codeSent ? (
                      <TouchableOpacity onPress={handleSendResetCode} disabled={loading} style={styles.btn}>
                          {loading ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Send Reset Code 📧</Text>}
                      </TouchableOpacity>
                  ) : (
                      <>
                          <Text style={styles.label}>6-Digit Recovery Code</Text>
                          <View style={styles.inputWrapper}>
                              <View style={{paddingLeft: 15}}><KeyRound size={20} color="#71717a" /></View>
                              <View style={styles.divider} />
                              <TextInput
                                placeholder="000000"
                                placeholderTextColor="#52525b"
                                value={resetCode}
                                onChangeText={setResetCode} 
                                keyboardType="number-pad" 
                                maxLength={6}
                                style={styles.input}
                              />
                          </View>

                          <Text style={styles.label}>New Passcode</Text>
                          <View style={styles.inputWrapper}>
                              <View style={{paddingLeft: 15}}><Lock size={20} color="#71717a" /></View>
                              <View style={styles.divider} />
                              <TextInput
                                placeholder="New Secret Passcode"
                                placeholderTextColor="#52525b"
                                value={newPassword}
                                onChangeText={setNewPassword} 
                                secureTextEntry
                                style={styles.input}
                              />
                          </View>

                          <TouchableOpacity onPress={handleVerifyAndReset} disabled={loading} style={styles.btn}>
                              {loading ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Update Passcode & Login 🔓</Text>}
                          </TouchableOpacity>
                      </>
                  )}
              </>
          ) : (
              // 🟢 STANDARD LOGIN / SIGNUP UI
              <>
                  {/* INPUT: EMAIL */}
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                      <View style={{paddingLeft: 15}}>
                          <Mail size={20} color="#71717a" />
                      </View>
                      <View style={styles.divider} />
                      <TextInput
                        placeholder="student@college.edu"
                        placeholderTextColor="#52525b"
                        value={email}
                        onChangeText={setEmail} 
                        keyboardType="email-address" 
                        autoCapitalize="none"
                        style={styles.input}
                      />
                  </View>

                  {/* INPUT: PASSWORD */}
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                      <Text style={[styles.label, {marginBottom: 0}]}>{authMode === 'signup' ? "Create Passcode" : "Passcode"}</Text>
                      {authMode === 'login' && (
                          <TouchableOpacity onPress={() => switchMode('forgot')}>
                              <Text style={{color: '#00E676', fontSize: 12, fontWeight: 'bold'}}>Forgot?</Text>
                          </TouchableOpacity>
                      )}
                  </View>
                  <View style={styles.inputWrapper}>
                      <View style={{paddingLeft: 15}}>
                          <Lock size={20} color="#71717a" />
                      </View>
                      <View style={styles.divider} />
                      <TextInput
                          placeholder="Secret Passcode"
                          placeholderTextColor="#52525b"
                          value={password}
                          onChangeText={setPassword} 
                          secureTextEntry
                          style={styles.input}
                      />
                  </View>

                  {/* TERMS CHECKBOX (Only Signup) */}
                  {authMode === 'signup' && (
                      <View style={styles.termsContainer}>
                          <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)}>
                              {agreedToTerms ? <CheckSquare size={20} color="#00E676" /> : <Square size={20} color="#666" />}
                          </TouchableOpacity>
                          <Text style={styles.termsText}>
                              I accept the <Text onPress={() => setShowTerms(true)} style={styles.linkText}>Rules of the Game</Text>
                          </Text>
                      </View>
                  )}

                  {/* MAIN ACTION BUTTON */}
                  <TouchableOpacity 
                    onPress={handleAction} 
                    disabled={loading} 
                    style={[styles.btn, authMode === 'signup' && !agreedToTerms && {backgroundColor: '#333', opacity: 0.5}]}
                  >
                    {loading ? (
                        <ActivityIndicator color="black" /> 
                    ) : (
                        <Text style={styles.btnText}>
                            {authMode === 'login' ? 'Resume Quest 🎮' : 'Join SideQuest 🚀'}
                        </Text>
                    )}
                  </TouchableOpacity>
              </>
          )}

        </View>
      </View>

      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} showAgreeButton={true} onAgree={() => { setAgreedToTerms(true); setShowTerms(false); }} />
        <Modal visible={alertVisible} transparent animationType="fade">
  <View style={{
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }}>
    <View style={{
      backgroundColor: '#18181b',
      padding: 20,
      borderRadius: 16,
      width: '100%'
    }}>
      <Text style={{
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10
      }}>
        {alertTitle}
      </Text>

      <Text style={{
        color: '#a1a1aa',
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center' },
  topBar: { position: 'absolute', top: 50, right: 20, left: 20, zIndex: 10, flexDirection:'row', justifyContent:'flex-end' },
  toggleBtn: { backgroundColor: '#27272a', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#3f3f46' },
  toggleText: { color: '#00E676', fontWeight: 'bold', fontSize: 14 },
  
  content: { padding: 30, width: '100%' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 25, backgroundColor: 'rgba(0,230,118,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, transform: [{rotate: '-5deg'}] },
  title: { fontSize: 42, fontWeight: '900', color: 'white', letterSpacing: 1, fontStyle: 'italic' },
  slogan: { fontSize: 14, color: '#a1a1aa', marginTop: 5, fontStyle: 'italic' },
  
  form: { width: '100%' },
  label: { color: '#71717a', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46', marginBottom: 20, height: 60 },
  divider: { width: 1, height: '50%', backgroundColor: '#3f3f46', marginHorizontal: 10 },
  input: { flex: 1, height: '100%', color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  btn: { backgroundColor: '#00E676', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#00E676', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnText: { color: 'black', fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase' },
  
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 5 },
  termsText: { color: '#a1a1aa', marginLeft: 10, fontSize: 14 },
  linkText: { color: '#00E676', fontWeight: 'bold', textDecorationLine: 'underline' }
});