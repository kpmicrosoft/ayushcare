import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import config from './config';
import {
  EMPTY_ADDRESS, EMPTY_HANDLES, EMPTY_REG,
  INDIA_STATES, US_STATES, INDIA_CITIES,
  LOOKUP_APIS, HANDLE_META, RECORD_TYPES,
} from './constants';

const API_BASE = config.apiBaseUrl;

// Bilingual label: English / Telugu
const BiLabel = ({ en, te }) => (
  <View style={styles.biLabelRow}>
    <Text style={styles.biLabelEn}>{en}</Text>
    <Text style={styles.biLabelTe}>{te}</Text>
  </View>
);

// Small colored brand badge: circle with symbol + label
const HandleBadge = ({ handleKey, style }) => {
  const meta = HANDLE_META[handleKey] || { label: handleKey, color: '#6b7a99', symbol: handleKey[0].toUpperCase() };
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: meta.color,
                     alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{meta.symbol}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#2b3a67' }}>{meta.label}</Text>
    </View>
  );
};

// Coloured badge showing record type emoji + label
const RecordTypeBadge = ({ typeKey }) => {
  const rt = RECORD_TYPES.find(r => r.key === typeKey) || RECORD_TYPES[RECORD_TYPES.length - 1];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: rt.color,
                     alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16 }}>{rt.emoji}</Text>
      </View>
      <View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: rt.color }}>{rt.label}</Text>
        <Text style={{ fontSize: 11, color: '#9aaac4' }}>{rt.te}</Text>
      </View>
    </View>
  );
};

// File extension → display category
const fileIcon = (name) => {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
  if (ext === 'pdf')  return '📄';
  if (ext === 'json') return '📊';
  if (['csv','txt'].includes(ext)) return '📝';
  return '📎';
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS  = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i);
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);

// Three-dropdown DOB picker — best UX for birth dates decades in the past
const DOBPicker = ({ value, onChange }) => {
  // Normalise parts so they always match option values (zero-padded MM, DD)
  const parts = (value || '').split('-');
  const year  = parts[0] || '';
  const month = parts[1] ? parts[1].padStart(2, '0') : '';
  const day   = parts[2] ? parts[2].padStart(2, '0') : '';

  const emit = (y, m, d) => {
    if (y && m && d) onChange(`${y}-${m}-${d}`);   // already padded
    else onChange('');
  };

  const selectStyle = {
    height: 48, borderColor: '#b0c4de', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, backgroundColor: '#ffffff', fontSize: 15,
    color: '#2b3a67', flex: 1, cursor: 'pointer',
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {/* Day */}
        <select value={day} style={selectStyle}
          onChange={e => emit(year, month, e.target.value)}>
          <option value="">Day</option>
          {DAYS.map(d => {
            const v = String(d).padStart(2, '0');
            return <option key={v} value={v}>{d}</option>;
          })}
        </select>
        {/* Month */}
        <select value={month} style={{ ...selectStyle, flex: 2 }}
          onChange={e => emit(year, e.target.value, day)}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2,'0')}>{m}</option>
          ))}
        </select>
        {/* Year */}
        <select value={year} style={{ ...selectStyle, flex: 1.5 }}
          onChange={e => emit(e.target.value, month, day)}>
          <option value="">Year</option>
          {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </View>
    );
  }
  // Native fallback — plain text input
  return (
    <TextInput style={styles.input} placeholder="YYYY-MM-DD" keyboardType="numeric"
      value={value || ''} onChangeText={onChange} />
  );
};

const AddressForm = ({ address, onChange }) => {
  const country = address.country || 'India';
  const isIndia = country === 'India';
  const isUS    = country === 'United States';
  const stateList = isIndia ? INDIA_STATES : isUS ? US_STATES : [];

  const [pinStatus, setPinStatus]               = useState('');
  const [postOffices, setPostOffices]           = useState([]);
  const [stateQuery, setStateQuery]             = useState(address.state || '');
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const [cityQuery, setCityQuery]               = useState(address.city || '');
  const [citySuggestions, setCitySuggestions]   = useState([]);

  const selectCountry = (c) => {
    onChange({ ...EMPTY_ADDRESS, country: c });
    setStateQuery(''); setStateSuggestions([]);
    setCityQuery('');  setCitySuggestions([]);
    setPostOffices([]); setPinStatus('');
  };

  const handlePinChange = async (val) => {
    onChange({ ...address, pincode: val });
    setPostOffices([]); setPinStatus('');
    if (isIndia && val.length === 6) {
      setPinStatus('Looking up…');
      try {
        const res  = await fetch(LOOKUP_APIS.indiaPincode(val));
        const data = await res.json();
        if (data[0].Status === 'Success') {
          const offices  = data[0].PostOffice;
          const state    = offices[0].State;
          const district = offices[0].District;
          const firstCity = offices[0].Name;
          setPostOffices(offices.map(o => o.Name));
          setStateQuery(state);
          setCityQuery(firstCity);
          setCitySuggestions([]);
          onChange({ ...address, pincode: val, state, district, city: firstCity });
          setPinStatus(`✅ ${district}, ${state} — ${offices.length} area(s) found`);
        } else { setPinStatus('❌ PIN code not found'); }
      } catch { setPinStatus('❌ Lookup failed — check connection'); }
    } else if (isUS && val.length === 5) {
      setPinStatus('Looking up…');
      try {
        const res = await fetch(LOOKUP_APIS.usZip(val));
        if (res.ok) {
          const data  = await res.json();
          const place = data.places[0];
          setStateQuery(place.state);
          setCityQuery(place['place name']);
          setCitySuggestions([]);
          onChange({ ...address, pincode: val, state: place.state, city: place['place name'] });
          setPinStatus(`✅ ${place['place name']}, ${place['state abbreviation']}`);
        } else { setPinStatus('❌ ZIP code not found'); }
      } catch { setPinStatus('❌ Lookup failed — check connection'); }
    }
  };

  const handleCityQuery = (val) => {
    setCityQuery(val);
    onChange({ ...address, city: val });
    if (isIndia && val.length >= 2) {
      const q = val.toLowerCase();
      setCitySuggestions(
        INDIA_CITIES.filter(c => c.toLowerCase().startsWith(q))
          .concat(INDIA_CITIES.filter(c => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q)))
          .slice(0, 6)
      );
    } else {
      setCitySuggestions([]);
    }
  };

  const pickCity = (city) => {
    setCityQuery(city);
    setCitySuggestions([]);
    onChange({ ...address, city });
  };

  const handleStateQuery = (val) => {
    setStateQuery(val);
    onChange({ ...address, state: val });
    setStateSuggestions(
      val.length > 0 ? stateList.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 6) : []
    );
  };

  const pickState = (s) => { setStateQuery(s); onChange({ ...address, state: s }); setStateSuggestions([]); };

  return (
    <View>
      {/* Country */}
      <BiLabel en="Country" te="దేశం" />
      <View style={styles.pillRow}>
        {['India','United States','Other'].map(c => (
          <TouchableOpacity key={c} style={[styles.pill, country===c && styles.pillActive]} onPress={() => selectCountry(c)}>
            <Text style={[styles.pillText, country===c && styles.pillTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lines */}
      <BiLabel en="Address Line 1" te="చిరునామా వరుస 1" />
      <TextInput style={styles.input} placeholder="Door No, Street / ఇంటి నంబర్, వీధి"
        value={address.line1} onChangeText={t => onChange({ ...address, line1: t })} />
      <BiLabel en="Address Line 2" te="చిరునామా వరుస 2" />
      <TextInput style={styles.input} placeholder="Landmark, Area / లాండ్‌మార్క్, ప్రాంతం"
        value={address.line2} onChangeText={t => onChange({ ...address, line2: t })} />

      {/* PIN / ZIP */}
      <BiLabel en={isIndia ? 'PIN Code' : isUS ? 'ZIP Code' : 'Postal Code'} te="పిన్ కోడ్" />
      <TextInput style={styles.input}
        placeholder={isIndia ? '6-digit PIN → auto-fills area' : isUS ? '5-digit ZIP → auto-fills city' : 'Postal Code'}
        keyboardType="numeric" maxLength={isIndia ? 6 : isUS ? 5 : 12}
        value={address.pincode} onChangeText={handlePinChange} />
      {!!pinStatus && <Text style={styles.lookupStatus}>{pinStatus}</Text>}

      {/* India: post office pills (from PIN lookup) */}
      {isIndia && postOffices.length > 0 && (
        <View>
          <BiLabel en="Select Area / Post Office" te="ప్రాంతం ఎంచుకోండి" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {postOffices.map(po => (
              <TouchableOpacity key={po} style={[styles.pill, address.city===po && styles.pillActive]} onPress={() => pickCity(po)}>
                <Text style={[styles.pillText, address.city===po && styles.pillTextActive]}>{po}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Village / Town / City with typeahead */}
      <BiLabel en={isIndia ? 'Village / Town / City' : 'City'} te="గ్రామం / పట్టణం / నగరం" />
      <TextInput style={styles.input}
        placeholder={isIndia ? 'Type to search village, town or city…' : 'City'}
        value={cityQuery} onChangeText={handleCityQuery} />
      {citySuggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {citySuggestions.map(c => (
            <TouchableOpacity key={c} style={styles.suggestion} onPress={() => pickCity(c)}>
              <Text style={styles.suggestionText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* District — India only */}
      {isIndia && (
        <>
          <BiLabel en="District" te="జిల్లా" />
          <TextInput style={styles.input} placeholder="District / జిల్లా"
            value={address.district} onChangeText={t => onChange({ ...address, district: t })} />
        </>
      )}

      {/* State with type-ahead */}
      <BiLabel en={isUS ? 'State' : isIndia ? 'State' : 'State / Province'} te="రాష్ట్రం" />
      <TextInput style={styles.input} placeholder="State / రాష్ట్రం"
        value={stateQuery} onChangeText={handleStateQuery} />
      {stateSuggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {stateSuggestions.map(s => (
            <TouchableOpacity key={s} style={styles.suggestion} onPress={() => pickState(s)}>
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

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
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  // New visit form state
  const [addingVisit, setAddingVisit] = useState(false);
  const [visitDraft, setVisitDraft] = useState({ date: '', type: 'consultation', doctor: '', notes: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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
      const [recRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/records`,         { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/records/summary`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (recRes.ok) setRecords(await recRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (e) { console.error(e); }
  };

  const rescanSummary = async () => {
    setRescanning(true);
    try {
      const res = await fetch(`${API_BASE}/records/summary/rescan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const sumRes = await fetch(`${API_BASE}/records/summary`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (sumRes.ok) setSummary(await sumRes.json());
        setMessage('Summary rebuilt from all visit folders.');
      }
    } catch (e) { console.error(e); }
    setRescanning(false);
  };

  const submitVisit = async () => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('date',   visitDraft.date || new Date().toISOString().slice(0, 10));
      form.append('type',   visitDraft.type);
      form.append('doctor', visitDraft.doctor);
      form.append('notes',  visitDraft.notes);
      selectedFiles.forEach(f => form.append('files', f));
      const response = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (response.ok) {
        setVisitDraft({ date: '', type: 'consultation', doctor: '', notes: '' });
        setSelectedFiles([]);
        setAddingVisit(false);
        fetchRecords();
        setMessage('Visit record saved!');
      } else { setMessage('Failed to save record.'); }
    } catch { setMessage('Unable to save record.'); }
    setUploading(false);
  };

  const deleteVisit = async (visitId) => {
    try {
      await fetch(`${API_BASE}/records/${visitId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchRecords();
    } catch (e) { console.error(e); }
  };

  const fileUrl = (visitId, filename) =>
    `${config.apiBaseUrl}/records/${visitId}/files/${encodeURIComponent(filename)}?token=${token}`;

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
              {/* View mode — skip empty fields */}
              {[
                ['First Name / మొదటి పేరు',      userInfo.firstName],
                ['Middle Name / మధ్య పేరు',      userInfo.middleName],
                ['Last Name / చివరి పేరు',       userInfo.lastName],
                ['Email / ఇమెయిల్',              userInfo.email],
                ['Date of Birth / పుట్టిన తేదీ', userInfo.dob],
              ].filter(([, val]) => val && val.trim()).map(([label, val]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{val}</Text>
                </View>
              ))}

              {(() => {
                const addr = userInfo.address || {};
                const rows = [
                  ['Line 1 / వరుస 1',                  addr.line1],
                  ['Line 2 / వరుస 2',                  addr.line2],
                  ['Village / Town / గ్రామం / పట్టణం', addr.city],
                  ['District / జిల్లా',                addr.district],
                  ['State / రాష్ట్రం',                 addr.state],
                  ['PIN / ZIP / పిన్ కోడ్',            addr.pincode],
                  ['Country / దేశం',                  addr.country],
                ].filter(([, val]) => val && String(val).trim());
                if (rows.length === 0) return null;
                return (
                  <>
                    <Text style={styles.sectionSubtitle}>Address / చిరునామా</Text>
                    {rows.map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoValue}>{val}</Text>
                      </View>
                    ))}
                  </>
                );
              })()}

              {(() => {
                const filled = Object.entries(userInfo.handles || {}).filter(([, v]) => v && v.trim());
                if (filled.length === 0) return null;
                return (
                  <>
                    <Text style={styles.sectionSubtitle}>Social Handles / సామాజిక హ్యాండిల్స్</Text>
                    {filled.map(([h, v]) => (
                      <View key={h} style={[styles.infoRow, { alignItems: 'center' }]}>
                        <HandleBadge handleKey={h} style={{ width: 150 }} />
                        <Text style={styles.infoValue}>{v}</Text>
                      </View>
                    ))}
                  </>
                );
              })()}
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
              <DOBPicker value={editDraft.dob||''} onChange={(d) => setEditDraft({ ...editDraft, dob: d })} />

              <Text style={styles.sectionSubtitle}>Address / చిరునామా</Text>
              <AddressForm
                address={{ ...EMPTY_ADDRESS, ...(editDraft.address || {}) }}
                onChange={(addr) => setEditDraft({ ...editDraft, address: addr })}
              />

              <Text style={styles.sectionSubtitle}>Social Handles / సామాజిక హ్యాండిల్స్</Text>
              {Object.keys(HANDLE_META).map((key) => (
                <View key={key}>
                  <HandleBadge handleKey={key} style={{ marginBottom: 4, marginTop: 8 }} />
                  <TextInput style={styles.input}
                    placeholder={`${HANDLE_META[key].label} username or email`}
                    autoCapitalize="none"
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

      {/* ── Medical Records ── */}
      {step === 'records' && (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Medical Records / వైద్య రికార్డులు</Text>

          {/* Action bar */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title="← Back" onPress={() => { setAddingVisit(false); setStep('profile'); }} />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title="+ Add Visit" onPress={() => setAddingVisit(v => !v)} />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title={showSummary ? '📋 Hide Summary' : '📋 Summary'} onPress={() => setShowSummary(s => !s)} />
            </View>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button title={rescanning ? 'Scanning…' : '🔄 Rescan'} onPress={rescanSummary} disabled={rescanning} />
            </View>
          </View>

          {/* ── Summary panel ── */}
          {showSummary && summary && (
            <View style={styles.summaryPanel}>
              <Text style={styles.sectionSubtitle}>
                Summary — {summary.total_visits} visits
                {summary.generated_at ? `  (as of ${summary.generated_at.slice(0,10)})` : ''}
              </Text>

              {/* All visits table */}
              <Text style={styles.summaryTableTitle}>All Visits / అన్ని సందర్శనలు</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Header */}
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    {['Date','Type','Doctor','Notes'].map(h => (
                      <Text key={h} style={[styles.tableCell, styles.tableHeaderCell, h==='Notes' && {width:200}]}>{h}</Text>
                    ))}
                  </View>
                  {(summary.visits || []).map(v => {
                    const rt = RECORD_TYPES.find(r => r.key === v.type) || RECORD_TYPES[RECORD_TYPES.length-1];
                    return (
                      <View key={v.id} style={styles.tableRow}>
                        <Text style={styles.tableCell}>{v.date}</Text>
                        <Text style={[styles.tableCell, {color: rt.color, fontWeight:'600'}]}>{rt.emoji} {rt.label}</Text>
                        <Text style={styles.tableCell}>{v.doctor || '—'}</Text>
                        <Text style={[styles.tableCell, {width:200}]} numberOfLines={2}>{v.notes || '—'}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Blood work history table */}
              {summary.blood_work_history && summary.blood_work_history.length > 0 && (() => {
                const bwDates = summary.blood_work_history.map(b => b.date);
                const sections = [
                  { label: 'CBC',       tests: ['WBC','RBC','Hemoglobin','Hematocrit','MCV','Platelets'] },
                  { label: 'Metabolic', tests: ['Glucose','BUN','Creatinine','Sodium','Potassium','ALT','AST'] },
                  { label: 'Lipid',     tests: ['Total Cholesterol','HDL','LDL','Triglycerides'] },
                ];
                return (
                  <>
                    <Text style={[styles.summaryTableTitle, {marginTop: 16}]}>🩸 Blood Work History</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View>
                        {/* Date header row */}
                        <View style={[styles.tableRow, styles.tableHeader]}>
                          <Text style={[styles.tableCell, styles.tableHeaderCell, {width:160}]}>Test</Text>
                          {bwDates.map(d => (
                            <Text key={d} style={[styles.tableCell, styles.tableHeaderCell, {width:90}]}>{d.slice(2)}</Text>
                          ))}
                        </View>
                        {sections.map(sec => [
                          /* Section heading row */
                          <View key={sec.label} style={[styles.tableRow, {backgroundColor:'#eef2ff'}]}>
                            <Text style={[styles.tableCell, {width:160, fontWeight:'700', color:'#1f3c88'}]}>{sec.label}</Text>
                            {bwDates.map(d => <Text key={d} style={[styles.tableCell,{width:90}]} />)}
                          </View>,
                          ...sec.tests.map(test => (
                            <View key={test} style={styles.tableRow}>
                              <Text style={[styles.tableCell, {width:160, color:'#4a5568'}]}>{test}</Text>
                              {summary.blood_work_history.map(b => (
                                <Text key={b.date} style={[styles.tableCell, {width:90, textAlign:'right'}]}>
                                  {b[sec.label]?.[test] ?? '—'}
                                </Text>
                              ))}
                            </View>
                          )),
                        ])}
                      </View>
                    </ScrollView>
                  </>
                );
              })()}
            </View>
          )}

          {/* ── Add Visit Form ── */}
          {addingVisit && (
            <View style={styles.visitForm}>
              <Text style={styles.sectionSubtitle}>New Visit / కొత్త సందర్శన</Text>

              <BiLabel en="Date of Visit" te="సందర్శన తేదీ" />
              <DOBPicker value={visitDraft.date} onChange={d => setVisitDraft({ ...visitDraft, date: d })} />

              <BiLabel en="Record Type" te="రికార్డు రకం" />
              <View style={styles.pillRow}>
                {RECORD_TYPES.map(rt => (
                  <TouchableOpacity key={rt.key}
                    style={[styles.pill, visitDraft.type === rt.key && { ...styles.pillActive, borderColor: rt.color, backgroundColor: rt.color }]}
                    onPress={() => setVisitDraft({ ...visitDraft, type: rt.key })}>
                    <Text style={{ fontSize: 12 }}>{rt.emoji} </Text>
                    <Text style={[styles.pillText, visitDraft.type === rt.key && styles.pillTextActive]}>{rt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <BiLabel en="Doctor / Hospital" te="వైద్యుడు / ఆసుపత్రి" />
              <TextInput style={styles.input} placeholder="Dr. Name or Hospital"
                value={visitDraft.doctor} onChangeText={t => setVisitDraft({ ...visitDraft, doctor: t })} />

              <BiLabel en="Notes" te="గమనికలు" />
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                placeholder="Symptoms, diagnosis, observations…"
                multiline value={visitDraft.notes}
                onChangeText={t => setVisitDraft({ ...visitDraft, notes: t })} />

              <BiLabel en="Attach Files" te="ఫైళ్ళు జోడించండి" />
              <Text style={{ fontSize: 12, color: '#6b7a99', marginBottom: 6 }}>
                PDF, images, JSON, CSV — multiple files allowed
              </Text>

              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.json,.csv,.txt"
                  style={{ display: 'none' }}
                  onChange={e => setSelectedFiles(Array.from(e.target.files))}
                />
              )}

              <TouchableOpacity style={styles.filePickerBtn}
                onPress={() => fileInputRef.current && fileInputRef.current.click()}>
                <Text style={styles.filePickerText}>📎 Choose Files</Text>
              </TouchableOpacity>

              {selectedFiles.length > 0 && (
                <View style={{ marginTop: 8, marginBottom: 8 }}>
                  {selectedFiles.map((f, i) => (
                    <View key={i} style={styles.fileChip}>
                      <Text style={styles.fileChipText}>{fileIcon(f.name)} {f.name}</Text>
                      <TouchableOpacity onPress={() => setSelectedFiles(sf => sf.filter((_, j) => j !== i))}>
                        <Text style={{ color: '#c0392b', marginLeft: 8, fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Button title={uploading ? 'Saving…' : 'Save Visit / సేవ్ చేయండి'}
                onPress={submitVisit} disabled={uploading || !visitDraft.date} />
              <View style={styles.spacer} />
              <Button title="Cancel" onPress={() => { setAddingVisit(false); setSelectedFiles([]); }} />
            </View>
          )}

          {/* ── Visit cards ── */}
          {records.length === 0 && !addingVisit && (
            <Text style={styles.empty}>No visits yet. Tap "+ Add Visit" to record your first visit.</Text>
          )}
          {records.map(rec => (
            <View key={rec.id} style={styles.visitCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <RecordTypeBadge typeKey={rec.type} />
                <Text style={styles.visitDate}>{rec.date}</Text>
              </View>

              {!!rec.doctor && (
                <Text style={styles.visitDoctor}>🩺 {rec.doctor}</Text>
              )}
              {!!rec.notes && (
                <Text style={styles.visitNotes}>{rec.notes}</Text>
              )}

              {rec.files && rec.files.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6b7a99', marginBottom: 4 }}>
                    Attachments / జోడింపులు ({rec.files.length})
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {rec.files.map(fn => (
                      Platform.OS === 'web'
                        ? <a key={fn} href={fileUrl(rec.id, fn)} target="_blank" rel="noreferrer"
                             style={{ textDecoration: 'none' }}>
                            <View style={styles.fileChip}>
                              <Text style={styles.fileChipText}>{fileIcon(fn)} {fn}</Text>
                            </View>
                          </a>
                        : <View key={fn} style={styles.fileChip}>
                            <Text style={styles.fileChipText}>{fileIcon(fn)} {fn}</Text>
                          </View>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteVisit(rec.id)}>
                <Text style={styles.deleteBtnText}>🗑 Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#b0c4de',
    backgroundColor: '#fff',
    marginRight: 6,
    marginBottom: 6,
  },
  pillActive: {
    backgroundColor: '#1f3c88',
    borderColor: '#1f3c88',
  },
  pillText: {
    fontSize: 13,
    color: '#2b3a67',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  lookupStatus: {
    fontSize: 12,
    color: '#2b3a67',
    marginBottom: 10,
    marginTop: -6,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: '#b0c4de',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 12,
    marginTop: -8,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf5',
  },
  suggestionText: {
    fontSize: 14,
    color: '#1f3c88',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  visitForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#b0c4de',
  },
  visitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d0daea',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  visitDate: {
    fontSize: 13,
    color: '#6b7a99',
    fontWeight: '600',
  },
  visitDoctor: {
    fontSize: 13,
    color: '#2b3a67',
    marginTop: 6,
  },
  visitNotes: {
    fontSize: 13,
    color: '#4a5568',
    marginTop: 4,
    lineHeight: 18,
  },
  filePickerBtn: {
    borderWidth: 1,
    borderColor: '#b0c4de',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f8faff',
    marginBottom: 8,
  },
  filePickerText: {
    color: '#2b3a67',
    fontSize: 14,
    fontWeight: '600',
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 4,
  },
  fileChipText: {
    fontSize: 12,
    color: '#1f3c88',
  },
  deleteBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  deleteBtnText: {
    fontSize: 12,
    color: '#c0392b',
  },
  summaryPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#b0c4de',
  },
  summaryTableTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2b3a67',
    marginBottom: 6,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf5',
  },
  tableHeader: {
    backgroundColor: '#1f3c88',
  },
  tableCell: {
    width: 110,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#2b3a67',
  },
  tableHeaderCell: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
