import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import config from './config';
import {
  EMPTY_ADDRESS, EMPTY_HANDLES, EMPTY_REG,
  INDIA_STATES, US_STATES, INDIA_CITIES,
  LOOKUP_APIS, HANDLE_META,
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
                      <View key={h} style={styles.infoRow}>
                        <HandleBadge handleKey={h} />
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
