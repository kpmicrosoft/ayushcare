import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import config from './config';

const API_BASE = config.apiBaseUrl;

const EMPTY_ADDRESS = { line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India' };
const EMPTY_HANDLES = { gmail: '', yahoo: '', twitter: '', instagram: '', facebook: '', whatsapp: '' };
const EMPTY_REG     = { firstName: '', middleName: '', lastName: '', ...EMPTY_HANDLES };

// Bilingual label: English / Telugu
const BiLabel = ({ en, te }) => (
  <View style={styles.biLabelRow}>
    <Text style={styles.biLabelEn}>{en}</Text>
    <Text style={styles.biLabelTe}>{te}</Text>
  </View>
);

export default function App() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [message, setMessage] = useState('Enter your mobile number to receive a mock OTP.');
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [reg, setReg] = useState(EMPTY_REG);
  const [userInfo, setUserInfo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});
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
          <Text style={styles.sectionTitle}>Create Your Account / మీ ఖాతా సృష్టించండి</Text>
          <Text style={styles.accountId}>Account ID / ఖాతా సంఖ్య: {accountId}</Text>

          <BiLabel en="First Name *" te="మొదటి పేరు *" />
          <TextInput style={styles.input} placeholder="First Name"
            value={reg.firstName} onChangeText={(t) => setReg({ ...reg, firstName: t })} />
          <BiLabel en="Middle Name" te="మధ్య పేరు" />
          <TextInput style={styles.input} placeholder="Middle Name"
            value={reg.middleName} onChangeText={(t) => setReg({ ...reg, middleName: t })} />
          <BiLabel en="Last Name" te="చివరి పేరు" />
          <TextInput style={styles.input} placeholder="Last Name"
            value={reg.lastName} onChangeText={(t) => setReg({ ...reg, lastName: t })} />

          <Text style={styles.sectionSubtitle}>Additional Login Handles / అదనపు లాగిన్ వివరాలు (optional)</Text>
          {[['gmail','Gmail'],['yahoo','Yahoo Mail'],['twitter','Twitter'],['instagram','Instagram'],['facebook','Facebook'],['whatsapp','WhatsApp']].map(([key, label]) => (
            <TextInput key={key} style={styles.input} placeholder={label}
              autoCapitalize="none"
              value={reg[key]} onChangeText={(t) => setReg({ ...reg, [key]: t })} />
          ))}
          <Button title="Complete Registration / నమోదు పూర్తి చేయండి" onPress={handleRegister} disabled={!reg.firstName.trim()} />
        </View>
      )}

      {/* ── Profile ── */}
      {step === 'profile' && userInfo && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Patient Profile / రోగి వివరాలు</Text>

          {/* Read-only identity */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account ID / ఖాతా సంఖ్య</Text>
            <Text style={styles.infoValueMono}>{userInfo.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone / ఫోన్ నంబర్</Text>
            <Text style={styles.infoValue}>{userInfo.phone}</Text>
          </View>

          {!editMode ? (
            <>
              {/* View mode */}
              {[
                ['First Name / మొదటి పేరు',   userInfo.firstName],
                ['Middle Name / మధ్య పేరు',   userInfo.middleName],
                ['Last Name / చివరి పేరు',    userInfo.lastName],
                ['Email / ఇమెయిల్',           userInfo.email],
                ['Date of Birth / పుట్టిన తేదీ', userInfo.dob],
              ].map(([label, val]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{val || '—'}</Text>
                </View>
              ))}

              <Text style={styles.sectionSubtitle}>Address / చిరునామా</Text>
              {[
                ['Line 1 / వరుస 1',                   (userInfo.address||{}).line1],
                ['Line 2 / వరుస 2',                   (userInfo.address||{}).line2],
                ['Village / Town / గ్రామం / పట్టణం',  (userInfo.address||{}).city],
                ['District / జిల్లా',                 (userInfo.address||{}).district],
                ['State / రాష్ట్రం',                  (userInfo.address||{}).state],
                ['PIN / ZIP / పిన్ కోడ్',             (userInfo.address||{}).pincode],
                ['Country / దేశం',                   (userInfo.address||{}).country],
              ].map(([label, val]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{val || '—'}</Text>
                </View>
              ))}

              <Text style={styles.sectionSubtitle}>Social Handles / సామాజిక హ్యాండిల్స్</Text>
              {Object.entries(userInfo.handles || {}).map(([h, v]) => (
                <View key={h} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{h.charAt(0).toUpperCase() + h.slice(1)}</Text>
                  <Text style={styles.infoValue}>{v || '—'}</Text>
                </View>
              ))}
              <View style={styles.spacer} />
              <Button title="Edit Profile / సవరించు" onPress={() => {
                setEditDraft({ ...userInfo, address: { ...EMPTY_ADDRESS, ...(userInfo.address||{}) } });
                setEditMode(true);
              }} />
              <View style={styles.spacer} />
              <Button title="View Medical Records / వైద్య రికార్డులు" onPress={() => setStep('records')} />
            </>
          ) : (
            <>
              {/* Edit mode */}
              <Text style={styles.sectionSubtitle}>Name / పేరు</Text>
              <BiLabel en="First Name *" te="మొదటి పేరు *" />
              <TextInput style={styles.input} placeholder="First Name"
                value={editDraft.firstName||''} onChangeText={(t) => setEditDraft({ ...editDraft, firstName: t })} />
              <BiLabel en="Middle Name" te="మధ్య పేరు" />
              <TextInput style={styles.input} placeholder="Middle Name"
                value={editDraft.middleName||''} onChangeText={(t) => setEditDraft({ ...editDraft, middleName: t })} />
              <BiLabel en="Last Name" te="చివరి పేరు" />
              <TextInput style={styles.input} placeholder="Last Name"
                value={editDraft.lastName||''} onChangeText={(t) => setEditDraft({ ...editDraft, lastName: t })} />

              <BiLabel en="Email" te="ఇమెయిల్" />
              <TextInput style={styles.input} placeholder="Email" keyboardType="email-address"
                value={editDraft.email||''} onChangeText={(t) => setEditDraft({ ...editDraft, email: t })} />
              <BiLabel en="Date of Birth" te="పుట్టిన తేదీ" />
              <TextInput style={styles.input} placeholder="YYYY-MM-DD"
                value={editDraft.dob||''} onChangeText={(t) => setEditDraft({ ...editDraft, dob: t })} />

              <Text style={styles.sectionSubtitle}>Address / చిరునామా</Text>
              {[
                ['line1',    'Address Line 1',              'చిరునామా వరుస 1',       'Door No, Street'],
                ['line2',    'Address Line 2',              'చిరునామా వరుస 2',       'Landmark, Area'],
                ['city',     'Village / Town / City',       'గ్రామం / పట్టణం / నగరం','Village or City'],
                ['district', 'District',                    'జిల్లా',                'District'],
                ['state',    'State / Province',            'రాష్ట్రం',               'State'],
                ['pincode',  'PIN / ZIP Code',              'పిన్ కోడ్',             '500001'],
                ['country',  'Country',                     'దేశం',                  'India'],
              ].map(([key, en, te, ph]) => (
                <View key={key}>
                  <BiLabel en={en} te={te} />
                  <TextInput style={styles.input} placeholder={ph}
                    value={(editDraft.address||{})[key]||''}
                    onChangeText={(t) => setEditDraft({ ...editDraft, address: { ...(editDraft.address||EMPTY_ADDRESS), [key]: t } })} />
                </View>
              ))}

              <Text style={styles.sectionSubtitle}>Social Handles / సామాజిక హ్యాండిల్స్</Text>
              {[['gmail','Gmail'],['yahoo','Yahoo Mail'],['twitter','Twitter'],['instagram','Instagram'],['facebook','Facebook'],['whatsapp','WhatsApp']].map(([key, label]) => (
                <View key={key}>
                  <BiLabel en={label} te={label} />
                  <TextInput style={styles.input} placeholder={label} autoCapitalize="none"
                    value={(editDraft.handles||{})[key]||''}
                    onChangeText={(t) => setEditDraft({ ...editDraft, handles: { ...(editDraft.handles||EMPTY_HANDLES), [key]: t } })} />
                </View>
              ))}

              <Button title="Save Changes / మార్పులు సేవ్ చేయండి" onPress={saveProfile} />
              <View style={styles.spacer} />
              <Button title="Cancel / రద్దు చేయండి" onPress={() => setEditMode(false)} />
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
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2b3a67',
    marginTop: 16,
    marginBottom: 8,
    borderBottomColor: '#d0daea',
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  biLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  biLabelEn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2b3a67',
  },
  biLabelTe: {
    fontSize: 13,
    color: '#6b7a99',
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
