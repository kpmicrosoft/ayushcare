#!/usr/bin/env python3
"""
Seed script: generates 10 years of sample medical visit folders for the demo user.
Run from repo root:  python3 scripts/seed_visits.py
"""

import json, os, struct, zlib, random, sys
from datetime import date

# ── Find demo user ─────────────────────────────────────────────────────────────
BASE   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG    = os.path.join(BASE, 'data', 'metadata', 'users.json')
with open(REG) as f:
    registry = json.load(f)
user = next((u for u in registry['users'] if u.get('phone') == '7327184414'), None)
if not user:
    sys.exit('Demo user 7327184414 not found in users.json — log in once first.')
USER_ID   = user['id']
VISITS_DIR = os.path.join(BASE, 'data', 'users', USER_ID, 'visits')
os.makedirs(VISITS_DIR, exist_ok=True)

# Build patient header from registry
first  = user.get('firstName', '')
middle = user.get('middleName', '')
last   = user.get('lastName', '')
PATIENT_NAME = ' '.join(p for p in [first, middle, last] if p).strip() or 'Kishore Pendyala'
PATIENT_PHONE = user.get('phone', '')
addr = user.get('address', {})
PATIENT_ADDR = ', '.join(p for p in [
    addr.get('line1',''), addr.get('line2',''), addr.get('city',''),
    addr.get('district',''), addr.get('state',''), addr.get('pincode',''),
    addr.get('country','')
] if p)
PATIENT_ID = USER_ID

print(f'Seeding visits for: {PATIENT_NAME}  ({PATIENT_PHONE})  [{PATIENT_ID}]')

# ── File generators ────────────────────────────────────────────────────────────

def png_1x1(r, g, b):
    """Minimal valid 1×1 PNG (solid colour)."""
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)
    raw = b'\x00' + bytes([r, g, b])
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))

def make_pdf(title, lines):
    """Minimal valid PDF with title + bullet lines."""
    body_lines = [f'({title}) Tj']
    y = 720
    for line in lines:
        safe = line.replace('(','[').replace(')' ,']').replace('\\','/')
        body_lines.append(f'0 -18 Td ({safe}) Tj')
    stream = ('BT /F1 11 Tf 50 750 Td ' + ' '.join(body_lines) + ' ET').encode()
    objects = [
        b'',                                                         # 0 unused
        b'<</Type/Catalog/Pages 2 0 R>>',                           # 1 catalog
        b'<</Type/Pages/Kids[3 0 R]/Count 1>>',                     # 2 pages
        (b'<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R'
         b'/Contents 4 0 R/Resources<</Font<</F1<</Type/Font'
         b'/Subtype/Type1/BaseFont/Helvetica>>>>>>>>'),              # 3 page
        (b'<</Length ' + str(len(stream)).encode() + b'>>\nstream\n'
         + stream + b'\nendstream'),                                 # 4 content
    ]
    out, offsets = b'%PDF-1.4\n', []
    for i, obj in enumerate(objects):
        if i == 0:
            offsets.append(0); continue
        offsets.append(len(out))
        out += str(i).encode() + b' 0 obj\n' + obj + b'\nendobj\n'
    xref_pos = len(out)
    out += b'xref\n0 ' + str(len(objects)).encode() + b'\n'
    out += b'0000000000 65535 f \n'
    for off in offsets[1:]:
        out += f'{off:010d} 00000 n \n'.encode()
    out += (b'trailer<</Size ' + str(len(objects)).encode()
            + b'/Root 1 0 R>>\nstartxref\n'
            + str(xref_pos).encode() + b'\n%%EOF\n')
    return out

# ── Realistic lab value generators ────────────────────────────────────────────

def blood_work(visit_date, notes=''):
    rng = random.Random(str(visit_date))
    def v(nom, lo, hi): return round(nom + rng.uniform(-1,1)*(hi-lo)*0.15, 2)
    return {
        'report_type': 'Complete Blood Count + Metabolic Panel',
        'patient': {'name': PATIENT_NAME, 'phone': PATIENT_PHONE, 'id': PATIENT_ID, 'address': PATIENT_ADDR},
        'date': str(visit_date),
        'lab': rng.choice(['Apollo Diagnostics','SRL Diagnostics','Thyrocare','LabCorp']),
        'notes': notes,
        'CBC': {
            'WBC':        {'value': v(7.0,4.5,11.0),  'unit': '×10³/µL', 'ref': '4.5–11.0'},
            'RBC':        {'value': v(5.0,4.5,5.9),   'unit': '×10⁶/µL', 'ref': '4.5–5.9'},
            'Hemoglobin': {'value': v(14.5,13.5,17.5), 'unit': 'g/dL',   'ref': '13.5–17.5'},
            'Hematocrit': {'value': v(43.0,41.0,53.0), 'unit': '%',      'ref': '41–53'},
            'MCV':        {'value': v(90.0,80.0,100.0),'unit': 'fL',     'ref': '80–100'},
            'Platelets':  {'value': v(250,150,400),    'unit': '×10³/µL', 'ref': '150–400'},
        },
        'Metabolic': {
            'Glucose':    {'value': v(95,70,100),  'unit': 'mg/dL', 'ref': '70–100'},
            'BUN':        {'value': v(14,7,20),    'unit': 'mg/dL', 'ref': '7–20'},
            'Creatinine': {'value': v(0.95,0.7,1.2),'unit': 'mg/dL','ref': '0.7–1.2'},
            'Sodium':     {'value': v(140,136,145), 'unit': 'mEq/L','ref': '136–145'},
            'Potassium':  {'value': v(4.0,3.5,5.1), 'unit': 'mEq/L','ref': '3.5–5.1'},
            'ALT':        {'value': v(28,7,56),    'unit': 'U/L',   'ref': '7–56'},
            'AST':        {'value': v(25,10,40),   'unit': 'U/L',   'ref': '10–40'},
        },
        'Lipid': {
            'Total Cholesterol': {'value': v(185,100,200),'unit': 'mg/dL','ref': '<200'},
            'HDL':               {'value': v(52,40,60),   'unit': 'mg/dL','ref': '>40'},
            'LDL':               {'value': v(110,0,130),  'unit': 'mg/dL','ref': '<130'},
            'Triglycerides':     {'value': v(130,50,150), 'unit': 'mg/dL','ref': '<150'},
        },
    }

def urine_test(visit_date):
    rng = random.Random(str(visit_date) + 'u')
    return {
        'report_type': 'Urinalysis',
        'patient': {'name': PATIENT_NAME, 'phone': PATIENT_PHONE, 'id': PATIENT_ID, 'address': PATIENT_ADDR},
        'date': str(visit_date),
        'lab': rng.choice(['Apollo Diagnostics','SRL Diagnostics','Thyrocare']),
        'Physical': {
            'Color':           rng.choice(['Yellow','Pale Yellow','Amber']),
            'Clarity':         rng.choice(['Clear','Slightly Cloudy']),
            'Specific Gravity': round(rng.uniform(1.010,1.025),3),
            'pH':              round(rng.uniform(5.5,7.5),1),
        },
        'Chemical': {
            'Protein':    'Negative',
            'Glucose':    'Negative',
            'Ketones':    'Negative',
            'Blood':      'Negative',
            'Leukocytes': 'Negative',
            'Nitrite':    'Negative',
            'Bilirubin':  'Negative',
        },
    }

# ── Visit definitions (10 years of history) ───────────────────────────────────

visits = [
    # 2016
    {'d':'2016-01-12','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine annual blood work + urinalysis','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2016-07-18','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up blood panel','files':['blood_work.json','lab_report.pdf']},
    {'d':'2016-09-05','type':'consultation','doctor':'Dr. Ramesh Babu','notes':'General health checkup, mild vitamin D deficiency noted','files':['consultation_notes.pdf']},

    # 2017
    {'d':'2017-01-10','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual — added thyroid panel','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2017-04-22','type':'consultation','doctor':'Dr. Meera Pillai','notes':'Seasonal allergies — prescribed antihistamines','files':['prescription.json','consultation_notes.pdf']},
    {'d':'2017-07-14','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month blood panel, thyroid normal','files':['blood_work.json','lab_report.pdf']},

    # 2018
    {'d':'2018-01-08','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2018-03-14','type':'ct_scan','doctor':'Dr. Anand Krishnan','notes':'EMERGENCY: Severe abdominal pain — CT confirmed appendicitis. Appendectomy scheduled.','files':['ct_scan_report.pdf','ct_scan_image.png','consultation_notes.pdf']},
    {'d':'2018-03-16','type':'consultation','doctor':'Dr. Anand Krishnan','notes':'Post-op day 2 review — recovery normal, prescribed antibiotics','files':['prescription.json','consultation_notes.pdf']},
    {'d':'2018-07-09','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Post-surgery 4-month follow-up, all values normal','files':['blood_work.json','lab_report.pdf']},
    {'d':'2018-10-20','type':'consultation','doctor':'Dr. Ramesh Babu','notes':'Annual review, wound healed completely','files':['consultation_notes.pdf']},

    # 2019
    {'d':'2019-01-15','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2019-06-03','type':'vaccination','doctor':'Dr. Meera Pillai','notes':'Annual flu vaccine + Hepatitis B booster','files':['vaccination_record.json']},
    {'d':'2019-07-22','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up','files':['blood_work.json','lab_report.pdf']},
    {'d':'2019-11-11','type':'prescription','doctor':'Dr. Ramesh Babu','notes':'Vitamin D3 + B12 supplementation prescribed','files':['prescription.json']},

    # 2020
    {'d':'2020-01-13','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2020-03-28','type':'consultation','doctor':'Dr. Meera Pillai','notes':'COVID-19 suspected — mild symptoms, isolation advised, RT-PCR positive','files':['consultation_notes.pdf','covid_test_report.json']},
    {'d':'2020-07-06','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Post-COVID panel + antibody test. Antibodies detected.','files':['blood_work.json','lab_report.pdf']},
    {'d':'2020-09-14','type':'consultation','doctor':'Dr. Meera Pillai','notes':'Long COVID follow-up — fatigue persists, referred to pulmonologist','files':['consultation_notes.pdf','pulmonology_referral.pdf']},

    # 2021
    {'d':'2021-01-11','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual, lung function back to normal','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2021-04-08','type':'vaccination','doctor':'Dr. Meera Pillai','notes':'COVID-19 Vaccine Dose 1 (Covishield)','files':['vaccination_record.json']},
    {'d':'2021-05-06','type':'vaccination','doctor':'Dr. Meera Pillai','notes':'COVID-19 Vaccine Dose 2 (Covishield) — mild fever next day','files':['vaccination_record.json']},
    {'d':'2021-07-19','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up','files':['blood_work.json','lab_report.pdf']},
    {'d':'2021-11-03','type':'consultation','doctor':'Dr. Ramesh Babu','notes':'Annual health review — all good','files':['consultation_notes.pdf']},

    # 2022
    {'d':'2022-01-17','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2022-03-22','type':'ecg','doctor':'Dr. Suresh Nair','notes':'Cardiology screening — family history of heart disease. ECG normal, advised annual ECG.','files':['ecg_report.pdf','ecg_trace.png','consultation_notes.pdf']},
    {'d':'2022-07-11','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up + Vitamin D levels','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2022-10-05','type':'prescription','doctor':'Dr. Ramesh Babu','notes':'Atorvastatin 10mg prescribed — LDL slightly elevated','files':['prescription.json']},

    # 2023
    {'d':'2023-01-09','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual + lipid follow-up (on Atorvastatin)','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2023-04-17','type':'mri','doctor':'Dr. Priya Sharma','notes':'Lower back pain for 3 months — MRI shows L4-L5 disc bulge, physio recommended','files':['mri_report.pdf','mri_image.png','consultation_notes.pdf']},
    {'d':'2023-07-24','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up, LDL improved','files':['blood_work.json','lab_report.pdf']},
    {'d':'2023-09-12','type':'xray','doctor':'Dr. Priya Sharma','notes':'Chest X-ray — routine screening, clear','files':['xray_report.pdf','xray_image.png']},
    {'d':'2023-11-28','type':'consultation','doctor':'Dr. Priya Sharma','notes':'Back pain follow-up — physio improved symptoms significantly','files':['consultation_notes.pdf']},

    # 2024
    {'d':'2024-01-15','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2024-04-09','type':'ultrasound','doctor':'Dr. Anand Krishnan','notes':'Abdominal ultrasound — mild fatty liver (Grade 1), diet changes advised','files':['ultrasound_report.pdf','ultrasound_image.png','consultation_notes.pdf']},
    {'d':'2024-07-22','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up + liver function tests','files':['blood_work.json','lab_report.pdf']},
    {'d':'2024-10-14','type':'consultation','doctor':'Dr. Ramesh Babu','notes':'Annual review — weight down 4kg, liver function improving','files':['consultation_notes.pdf']},

    # 2025
    {'d':'2025-01-13','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Routine biannual','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2025-04-01','type':'vaccination','doctor':'Dr. Meera Pillai','notes':'Annual flu vaccine + Tdap booster','files':['vaccination_record.json']},
    {'d':'2025-07-21','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'6-month follow-up — lipids stable, liver enzymes normal','files':['blood_work.json','urine_test.json','lab_report.pdf']},
    {'d':'2025-10-08','type':'prescription','doctor':'Dr. Ramesh Babu','notes':'Metformin 500mg started — pre-diabetic fasting glucose trend','files':['prescription.json','consultation_notes.pdf']},

    # 2026
    {'d':'2026-01-20','type':'blood_work','doctor':'Dr. Ramesh Babu','notes':'Most recent biannual — HbA1c added, glucose controlled','files':['blood_work.json','urine_test.json','lab_report.pdf']},
]

# ── Content generators per file type ──────────────────────────────────────────

def prescription_json(visit_date, notes):
    rng = random.Random(str(visit_date)+'rx')
    meds = {
        'allergies': ['Cetirizine 10mg','Montelukast 10mg'],
        'vitamins':  ['Vitamin D3 60000IU', 'Methylcobalamin 1500mcg'],
        'lipids':    ['Atorvastatin 10mg', 'Omega-3 1000mg'],
        'diabetes':  ['Metformin 500mg', 'Chromium Picolinate 200mcg'],
    }
    if 'vitamin' in notes.lower(): drugs = meds['vitamins']
    elif 'atorvastatin' in notes.lower() or 'ldl' in notes.lower(): drugs = meds['lipids']
    elif 'metformin' in notes.lower() or 'diabet' in notes.lower(): drugs = meds['diabetes']
    else: drugs = meds['allergies']
    return {
        'report_type': 'Prescription',
        'patient': {'name': PATIENT_NAME, 'phone': PATIENT_PHONE, 'id': PATIENT_ID, 'address': PATIENT_ADDR},
        'date': str(visit_date),
        'medications': [{'name': d.split()[0], 'dose': d, 'frequency': '1-0-1', 'duration': '30 days'} for d in drugs],
        'instructions': 'Take after food. Avoid alcohol.',
    }

def vaccination_json(visit_date, notes):
    vax = 'COVID-19 Covishield' if 'covishield' in notes.lower() else \
          'Influenza Trivalent' if 'flu' in notes.lower() else \
          'Tdap' if 'tdap' in notes.lower() else 'Hepatitis B'
    return {
        'report_type': 'Vaccination Record',
        'patient': {'name': PATIENT_NAME, 'phone': PATIENT_PHONE, 'id': PATIENT_ID, 'address': PATIENT_ADDR},
        'date': str(visit_date),
        'vaccine': vax,
        'dose': 'Dose 2' if 'dose 2' in notes.lower() else 'Dose 1' if 'dose 1' in notes.lower() else 'Single Dose',
        'manufacturer': 'Serum Institute of India' if 'covishield' in notes.lower() else 'Sanofi Pasteur',
        'lot_number': f'LOT{random.Random(str(visit_date)).randint(10000,99999)}',
        'site': 'Left deltoid',
        'next_due': None,
    }

def covid_test_json(visit_date):
    return {
        'report_type': 'COVID-19 RT-PCR',
        'patient': {'name': PATIENT_NAME, 'phone': PATIENT_PHONE, 'id': PATIENT_ID, 'address': PATIENT_ADDR},
        'date': str(visit_date),
        'lab': 'Apollo Diagnostics',
        'result': 'POSITIVE',
        'Ct_value': 22.4,
        'gene_targets': {'N_gene': 'Detected', 'ORF1ab': 'Detected'},
        'interpretation': 'SARS-CoV-2 RNA Detected. Patient to self-isolate for 10 days.',
    }

def consultation_pdf(visit_date, doctor, notes):
    return make_pdf(f'Consultation Notes — {visit_date}', [
        f'Patient: {PATIENT_NAME}',
        f'Phone: {PATIENT_PHONE}',
        f'Patient ID: {PATIENT_ID}',
        f'Address: {PATIENT_ADDR[:60]}',
        f'Doctor: {doctor}',
        f'Date: {visit_date}', '',
        'Clinical Notes:',
        *[notes[i:i+70] for i in range(0, len(notes), 70)],
        '', 'Advice: Follow up as directed.',
    ])

def lab_report_pdf(visit_date, doctor):
    return make_pdf(f'Lab Report — {visit_date}', [
        f'Patient: {PATIENT_NAME}',
        f'Phone: {PATIENT_PHONE}',
        f'Patient ID: {PATIENT_ID}',
        f'Address: {PATIENT_ADDR[:60]}',
        f'Referring Doctor: {doctor}',
        f'Date: {visit_date}', '',
        'Test results attached as structured JSON (blood_work.json).',
        'All values within normal reference range unless marked.',
        '', 'Reviewed and signed by Lab Director.',
    ])

def imaging_pdf(visit_date, modality, findings):
    return make_pdf(f'{modality} Report — {visit_date}', [
        f'Patient: {PATIENT_NAME}',
        f'Phone: {PATIENT_PHONE}',
        f'Patient ID: {PATIENT_ID}',
        f'Date: {visit_date}',
        f'Modality: {modality}', '',
        'Findings:',
        *[findings[i:i+70] for i in range(0, len(findings), 70)],
        '', 'Radiologist: Dr. Imaging Specialist', 'Signature: [Signed]',
    ])

# Distinct colours for imaging placeholders
SCAN_COLOURS = {
    'ct_scan':   (50, 50, 50),    # dark gray
    'mri':       (30, 30, 80),    # dark blue
    'xray':      (180,180,180),   # light gray
    'ecg':       (20,120, 20),    # green
    'ultrasound':(60,100,160),    # blue
}

# ── Main seeding loop ─────────────────────────────────────────────────────────

for v in visits:
    visit_date = date.fromisoformat(v['d'])
    visit_id   = v['d'].replace('-','') + '_120000'   # deterministic ID
    vdir       = os.path.join(VISITS_DIR, visit_id)
    if os.path.exists(vdir):
        print(f'  skip (exists): {visit_id}')
        continue
    os.makedirs(vdir)

    meta = {
        'date': v['d'], 'type': v['type'],
        'doctor': v['doctor'], 'notes': v['notes'],
        'created_at': f"{v['d']}T12:00:00',",
        'files': v['files'],
    }
    with open(os.path.join(vdir, 'visit.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    for fn in v['files']:
        path = os.path.join(vdir, fn)
        if fn == 'blood_work.json':
            with open(path,'w') as f: json.dump(blood_work(visit_date, v['notes']), f, indent=2)
        elif fn == 'urine_test.json':
            with open(path,'w') as f: json.dump(urine_test(visit_date), f, indent=2)
        elif fn == 'prescription.json':
            with open(path,'w') as f: json.dump(prescription_json(visit_date, v['notes']), f, indent=2)
        elif fn == 'vaccination_record.json':
            with open(path,'w') as f: json.dump(vaccination_json(visit_date, v['notes']), f, indent=2)
        elif fn == 'covid_test_report.json':
            with open(path,'w') as f: json.dump(covid_test_json(visit_date), f, indent=2)
        elif fn == 'consultation_notes.pdf':
            with open(path,'wb') as f: f.write(consultation_pdf(visit_date, v['doctor'], v['notes']))
        elif fn == 'lab_report.pdf':
            with open(path,'wb') as f: f.write(lab_report_pdf(visit_date, v['doctor']))
        elif fn in ('pulmonology_referral.pdf',):
            with open(path,'wb') as f: f.write(make_pdf(f'Referral — {visit_date}',
                ['Referred to: Pulmonology Dept', 'Reason: Post-COVID persistent breathlessness',
                 'Urgency: Routine', '', 'Please review and advise management.']))
        elif fn == 'ct_scan_report.pdf':
            with open(path,'wb') as f: f.write(imaging_pdf(visit_date,'CT Abdomen',
                'Findings: Distended appendix (10mm diameter) with periappendiceal fat stranding. '
                'No free air. Impression: Acute appendicitis. Surgical consultation advised.'))
        elif fn == 'mri_report.pdf':
            with open(path,'wb') as f: f.write(imaging_pdf(visit_date,'MRI Lumbar Spine',
                'L4-L5: Posterior disc bulge with mild thecal sac indentation. '
                'No cord compression. Impression: L4-L5 disc bulge. Physiotherapy recommended.'))
        elif fn == 'xray_report.pdf':
            with open(path,'wb') as f: f.write(imaging_pdf(visit_date,'Chest X-Ray PA View',
                'Lungs: Clear, no consolidation or effusion. Heart size normal. '
                'Mediastinum: Normal. Impression: Normal chest X-ray.'))
        elif fn == 'ecg_report.pdf':
            with open(path,'wb') as f: f.write(imaging_pdf(visit_date,'12-Lead ECG',
                'Rate: 72 bpm. Rhythm: Regular sinus. PR interval: 160ms. '
                'QRS: 80ms. QT: 380ms. Axis: Normal. Impression: Normal ECG.'))
        elif fn == 'ultrasound_report.pdf':
            with open(path,'wb') as f: f.write(imaging_pdf(visit_date,'Abdominal Ultrasound',
                'Liver: Mildly increased echogenicity consistent with Grade 1 fatty liver. '
                'Gallbladder, spleen, kidneys: Normal. Impression: Mild fatty liver disease.'))
        elif fn.endswith('.png'):
            colour = SCAN_COLOURS.get(v['type'], (100,100,200))
            with open(path,'wb') as f: f.write(png_1x1(*colour))
        # any other file: skip

    print(f'  created: {visit_id}  [{v["type"]}]  {len(v["files"])} files')

print(f'\nDone. {len(visits)} visits seeded.')
