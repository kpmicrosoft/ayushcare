import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import config from './config';

const API_BASE = config.apiBaseUrl;

export default function App() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone | code | register | profile | records
  const [message, setMessage] = useState('Enter your mobile number to receive a mock OTP.');
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [reg, setReg] = useState({ name: '', gmail: '', yahoo: '', twitter: '', instagram: '', facebook: '', whatsapp: '' });
  const [userInfo, setUserInfo] = useState(null);   // full profile from /api/me
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});   // working copy while editing
  const [records, setRecords] = useState([]);
  const [newRecord, setNewRecord] = useState({ title: '', description: '', date: '' });

  const handleSendOtp = async () => {
    setMessage('Sending OTP...');
    try {
      const response = await fetch(`${API_BASE}/sendOtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || 'Failed to send OTP.'); return; }
      setStep('code');
      setMessage(`OTP sent (mock). Enter the code now. ${data.otp ? `Mock OTP: ${data.otp}` : ''}`);
    } catch {
      setMessage('Unable to reach backend. Is the API server running on localhost:8000?');
    }
  };

  const handleDemoLogin = () => {
    setPhone('7327184414');
    setToken('demo-token');
    setAccountId('demo');
    setStep('profile');
    setMessage('Demo login successful!');
  };

  const handleVerifyOtp = async () => {
    setMessage('Verifying OTP...');
    try {
      const response = await fetch(`${API_BASE}/verifyOtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || 'OTP verification failed.'); return; }
      setToken(data.token);
      setAccountId(data.account_id);
      if (data.is_new_user) {
        setStep('register');
        setMessage('Welcome! Complete your registration.');
      } else {
        setStep('profile');
        setMessage(`Welcome back! Account: ${data.account_id}`);
      }
    } catch {
      setMessage('Unable to reach backend. Is the API server running on localhost:8000?');
    }
  };

  const handleRegister = async () => {
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(reg),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || 'Registration failed.'); return; }
      setStep('profile');
      setMessage(`Registration complete! Account ID: ${data.account_id}`);
    } catch {
      setMessage('Unable to complete registration.');
    }
  };

  useEffect(() => {
    if (step === 'profile' && token) fetchMe();
    else if (step === 'records' && token) fetchRecords();
  }, [step, token]);

  const fetchMe = async () => {
    try {
      const response = await fetch(`${API_BASE}/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
        setEditDraft(data);
      }
    } catch (e) { console.error(e); }
  };

  const saveProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editDraft.name,
          email: editDraft.email,
          dob: editDraft.dob,
          handles: editDraft.handles || {},
        }),
      });
      if (response.ok) {
        setEditMode(false);
        fetchMe();
        setMessage('Profile updated successfully!');
      } else { setMessage('Failed to update profile.'); }
    } catch { setMessage('Unable to save profile.'); }
  };

  const fetchRecords = async () => {
    try {
      const response = await fetch(`${API_BASE}/records`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setRecords(await response.json());
    } catch (e) { console.error(e); }
  };

  const addRecord = async () => {
    try {
      const response = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newRecord),
      });
      if (response.ok) {
        setNewRecord({ title: '', description: '', date: '' });
        fetchRecords();
        setMessage('Record added successfully!');
      } else { setMessage('Failed to add record.'); }
    } catch { setMessage('Unable to add record.'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AyushCare</Text>
      <Text style={styles.subtitle}>Electronic Health Records</Text>

      {/* ── Phone entry ── */}
      {step === 'phone' && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Mobile number (e.g. +1234567890)"
            keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Button title="Send OTP" onPress={handleSendOtp} disabled={!phone.trim()} />
          <View style={styles.spacer} />
          <Button title="Demo Login" onPress={handleDemoLogin} />
        </View>
      )}

      {/* ── OTP entry ── */}
      {step === 'code' && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Enter OTP code"
            keyboardType="numeric" value={code} onChangeText={setCode} />
          <Button title="Verify OTP" onPress={handleVerifyOtp} disabled={!code.trim()} />
          <View style={styles.spacer} />
          <Button title="Resend OTP" onPress={handleSendOtp} />
        </View>
      )}

      {/* ── Registration ── */}
      {step === 'register' && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Create Your Account</Text>
          <Text style={styles.accountId}>Account ID: {accountId}</Text>
          <TextInput style={styles.input} placeholder="Full Name *"
            value={reg.name} onChangeText={(t) => setReg({ ...reg, name: t })} />
          <Text style={styles.label}>Additional login handles (optional)</Text>
          {['gmail', 'yahoo', 'twitter', 'instagram', 'facebook', 'whatsapp'].map((h) => (
            <TextInput key={h} style={styles.input} placeholder={h.charAt(0).toUpperCase() + h.slice(1)}
              autoCapitalize="none"
              value={reg[h]} onChangeText={(t) => setReg({ ...reg, [h]: t })} />
          ))}
          <Button title="Complete Registration" onPress={handleRegister} disabled={!reg.name.trim()} />
        </View>
      )}

      {/* ── Profile ── */}
      {step === 'profile' && userInfo && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Patient Profile</Text>

          {/* Read-only identity */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account ID</Text>
            <Text style={styles.infoValueMono}>{userInfo.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{userInfo.phone}</Text>
          </View>

          {!editMode ? (
            <>
              {/* View mode */}
              {[
                ['Name',      userInfo.name],
                ['Email',     userInfo.email],
                ['Date of Birth', userInfo.dob],
              ].map(([label, val]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{val || '—'}</Text>
                </View>
              ))}
              <Text style={styles.label}>Social Handles</Text>
              {Object.entries(userInfo.handles || {}).map(([h, v]) => (
                <View key={h} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{h.charAt(0).toUpperCase() + h.slice(1)}</Text>
                  <Text style={styles.infoValue}>{v || '—'}</Text>
                </View>
              ))}
              <View style={styles.spacer} />
              <Button title="Edit Profile" onPress={() => { setEditDraft({...userInfo}); setEditMode(true); }} />
              <View style={styles.spacer} />
              <Button title="View Medical Records" onPress={() => setStep('records')} />
            </>
          ) : (
            <>
              {/* Edit mode */}
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} placeholder="Full Name"
                value={editDraft.name} onChangeText={(t) => setEditDraft({ ...editDraft, name: t })} />
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} placeholder="Email" keyboardType="email-address"
                value={editDraft.email} onChangeText={(t) => setEditDraft({ ...editDraft, email: t })} />
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD"
                value={editDraft.dob} onChangeText={(t) => setEditDraft({ ...editDraft, dob: t })} />
              <Text style={styles.label}>Social Handles</Text>
              {['gmail','yahoo','twitter','instagram','facebook','whatsapp'].map((h) => (
                <TextInput key={h} style={styles.input}
                  placeholder={h.charAt(0).toUpperCase() + h.slice(1)}
                  autoCapitalize="none"
                  value={(editDraft.handles || {})[h] || ''}
                  onChangeText={(t) => setEditDraft({ ...editDraft, handles: { ...(editDraft.handles || {}), [h]: t } })} />
              ))}
              <Button title="Save Changes" onPress={saveProfile} />
              <View style={styles.spacer} />
              <Button title="Cancel" onPress={() => setEditMode(false)} />
            </>
          )}
        </View>
      )}

      {/* ── Records ── */}
      {step === 'records' && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Medical Records</Text>
          <Button title="← Back to Profile" onPress={() => setStep('profile')} />
          {records.length === 0 && <Text style={styles.empty}>No records yet.</Text>}
          {[...records].reverse().map((record) => (
            <View key={record.id} style={styles.record}>
              <Text style={styles.recordTitle}>{record.title}</Text>
              <Text style={styles.recordMeta}>{record.date}</Text>
              <Text>{record.description}</Text>
            </View>
          ))}
          <Text style={styles.label}>Add New Visit Record</Text>
          <TextInput style={styles.input} placeholder="Title (e.g. Annual Checkup)"
            value={newRecord.title} onChangeText={(t) => setNewRecord({ ...newRecord, title: t })} />
          <TextInput style={styles.input} placeholder="Description / Notes"
            value={newRecord.description} onChangeText={(t) => setNewRecord({ ...newRecord, description: t })} />
          <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)"
            value={newRecord.date} onChangeText={(t) => setNewRecord({ ...newRecord, date: t })} />
          <Button title="Add Record" onPress={addRecord} disabled={!newRecord.title.trim()} />
        </View>
      )}

      <Text style={styles.message}>{message}</Text>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f2f5fb',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f3c88',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: '#2b3a67',
  },
  form: {
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderColor: '#b0c4de',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f3c88',
  },
  accountId: {
    fontSize: 12,
    color: '#6b7a99',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b3a67',
    marginBottom: 8,
    marginTop: 8,
  },
  spacer: {
    height: 8,
  },
  message: {
    marginTop: 16,
    color: '#2b3a67',
    textAlign: 'center',
  },
  empty: {
    color: '#9aaac4',
    marginVertical: 12,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomColor: '#e8edf5',
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  infoLabel: {
    width: 120,
    fontSize: 13,
    color: '#6b7a99',
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1f3c88',
  },
  infoValueMono: {
    flex: 1,
    fontSize: 13,
    color: '#1f3c88',
    fontFamily: 'monospace',
  },
  record: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderColor: '#b0c4de',
    borderWidth: 1,
  },
  recordTitle: {
    fontWeight: '600',
    color: '#1f3c88',
    marginBottom: 4,
  },
  recordMeta: {
    fontSize: 12,
    color: '#6b7a99',
    marginBottom: 4,
  },
});
