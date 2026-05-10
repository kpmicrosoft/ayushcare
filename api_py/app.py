from flask import Flask, request, jsonify, redirect, send_file
import random
import re
import time
import uuid
import json
import os
import shutil
import mimetypes
from datetime import datetime
from werkzeug.utils import secure_filename
from flask_swagger_ui import get_swaggerui_blueprint
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Data paths ────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BASE_DIR, '..', 'data')
METADATA_DIR = os.path.join(DATA_DIR, 'metadata')
ARCHIVE_DIR  = os.path.join(METADATA_DIR, 'archive')
REGISTRY     = os.path.join(METADATA_DIR, 'users.json')
USERS_DIR    = os.path.join(DATA_DIR, 'users')

for d in (METADATA_DIR, ARCHIVE_DIR, USERS_DIR):
    os.makedirs(d, exist_ok=True)

# ── User registry ─────────────────────────────────────────────────────────────
def _load_registry():
    if not os.path.exists(REGISTRY):
        return {'next_seq': 1, 'users': []}
    with open(REGISTRY) as f:
        return json.load(f)

def _save_registry(registry):
    if os.path.exists(REGISTRY):
        ts = datetime.utcnow().strftime('%Y%m%dT%H%M%S')
        shutil.copy2(REGISTRY, os.path.join(ARCHIVE_DIR, f'users_{ts}.json'))
    with open(REGISTRY, 'w') as f:
        json.dump(registry, f, indent=2)

def _find_user_by_phone(phone):
    for user in _load_registry()['users']:
        if user.get('phone') == phone:
            return user
    return None

def _find_user_by_handle(handle_type, value):
    for user in _load_registry()['users']:
        if user.get('handles', {}).get(handle_type) == value:
            return user
    return None

def _generate_account_id(registry):
    date_part = datetime.utcnow().strftime('%Y%m%d')
    seq = registry.get('next_seq', 1)
    registry['next_seq'] = seq + 1
    return f"{date_part}{seq:010d}"

def _create_user(phone):
    registry = _load_registry()
    user = {
        'id': _generate_account_id(registry),
        'phone': phone,
        'firstName': '', 'middleName': '', 'lastName': '',
        'handles': {
            'gmail': '', 'yahoo': '', 'twitter': '',
            'instagram': '', 'facebook': '', 'whatsapp': ''
        },
        'address': {
            'line1': '', 'line2': '', 'city': '',
            'district': '', 'state': '', 'pincode': '', 'country': 'India'
        },
        'registered': False,
        'created_at': datetime.utcnow().isoformat(),
    }
    registry['users'].append(user)
    _save_registry(registry)
    os.makedirs(os.path.join(USERS_DIR, user['id'], 'visits'), exist_ok=True)
    return user

def _get_or_create_user(phone):
    return _find_user_by_phone(phone) or _create_user(phone)

# ── Profile ───────────────────────────────────────────────────────────────────
def _profile_path(user_id):
    return os.path.join(USERS_DIR, user_id, 'profile.json')

def _load_profile(user_id):
    path = _profile_path(user_id)
    return json.load(open(path)) if os.path.exists(path) else {}

def _save_profile(user_id, data):
    path = _profile_path(user_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# ── Visits ────────────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'json', 'csv', 'txt', 'dcm', 'doc', 'docx'}

def _visits_dir(user_id):
    return os.path.join(USERS_DIR, user_id, 'visits')

def _visit_meta(user_id, visit_id):
    path = os.path.join(_visits_dir(user_id), visit_id, 'visit.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        meta = json.load(f)
    vdir = os.path.join(_visits_dir(user_id), visit_id)
    meta['id'] = visit_id
    meta['files'] = [fn for fn in os.listdir(vdir) if fn != 'visit.json' and os.path.isfile(os.path.join(vdir, fn))]
    return meta

def _load_visits(user_id):
    vdir = _visits_dir(user_id)
    if not os.path.exists(vdir):
        return []
    visits = []
    for vid in sorted(os.listdir(vdir), reverse=True):
        if os.path.isdir(os.path.join(vdir, vid)):
            meta = _visit_meta(user_id, vid)
            if meta:
                visits.append(meta)
    return visits

def _save_visit(user_id, data, files=None):
    visit_id = datetime.now().strftime('%Y%m%d_%H%M%S')
    vdir = os.path.join(_visits_dir(user_id), visit_id)
    os.makedirs(vdir, exist_ok=True)
    meta = {
        'date':       data.get('date', datetime.now().strftime('%Y-%m-%d')),
        'type':       data.get('type', 'other'),
        'doctor':     data.get('doctor', ''),
        'notes':      data.get('notes', ''),
        'created_at': datetime.now().isoformat(),
    }
    saved = []
    for f in (files or []):
        if f and f.filename:
            ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
            if ext in ALLOWED_EXTENSIONS:
                fn = secure_filename(f.filename)
                f.save(os.path.join(vdir, fn))
                saved.append(fn)
    meta['files'] = saved
    with open(os.path.join(vdir, 'visit.json'), 'w') as fp:
        json.dump(meta, fp, indent=2)
    meta['id'] = visit_id
    return meta

# ── Summary ───────────────────────────────────────────────────────────────────
SUMMARY_FILE = 'summary.json'

def _build_and_save_summary(user_id):
    """Scan all visit folders, aggregate data and write summary.json."""
    vdir = _visits_dir(user_id)
    if not os.path.exists(vdir):
        return {}

    all_visits, blood_history = [], []

    for vid in sorted(os.listdir(vdir)):
        folder = os.path.join(vdir, vid)
        if not os.path.isdir(folder) or vid == SUMMARY_FILE:
            continue
        vmeta_path = os.path.join(folder, 'visit.json')
        if not os.path.exists(vmeta_path):
            continue
        with open(vmeta_path) as f:
            vm = json.load(f)

        files = [fn for fn in os.listdir(folder)
                 if fn != 'visit.json' and os.path.isfile(os.path.join(folder, fn))]
        all_visits.append({
            'id':     vid,
            'date':   vm.get('date', ''),
            'type':   vm.get('type', 'other'),
            'doctor': vm.get('doctor', ''),
            'notes':  vm.get('notes', ''),
            'files':  files,
        })

        # Extract blood work values if present
        bw_path = os.path.join(folder, 'blood_work.json')
        if os.path.exists(bw_path):
            with open(bw_path) as f:
                bw = json.load(f)
            entry = {'date': vm.get('date', ''), 'visit_id': vid}
            for section in ('CBC', 'Metabolic', 'Lipid'):
                if section in bw:
                    entry[section] = {k: v['value'] for k, v in bw[section].items()}
            blood_history.append(entry)

    # Sort newest first
    all_visits.sort(key=lambda v: v['date'], reverse=True)
    blood_history.sort(key=lambda v: v['date'])

    summary = {
        'generated_at':  datetime.now().isoformat(),
        'total_visits':  len(all_visits),
        'visits':        all_visits,
        'blood_work_history': blood_history,
    }
    with open(os.path.join(vdir, SUMMARY_FILE), 'w') as f:
        json.dump(summary, f, indent=2)
    return summary

def _load_summary(user_id):
    path = os.path.join(_visits_dir(user_id), SUMMARY_FILE)
    if not os.path.exists(path):
        return _build_and_save_summary(user_id)
    with open(path) as f:
        return json.load(f)

# ── OTP & sessions (in-memory, ephemeral) ────────────────────────────────────
otp_store     = {}
session_store = {}

def is_valid_phone(phone):
    return bool(re.match(r'^\+?\d{10,15}$', phone))

def set_otp(phone, code):
    otp_store[phone] = {'code': code, 'expiry': time.time() + 3600}

def create_session(phone):
    token = str(uuid.uuid4())
    session_store[token] = {'phone': phone}
    return token

def get_phone_from_token(token):
    if token == 'demo-token':
        return '7327184414'
    entry = session_store.get(token)
    return entry['phone'] if entry else None

def _authed_user(request):
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Unauthorized'}), 401
    phone = get_phone_from_token(auth.split(' ')[1])
    if not phone:
        return None, jsonify({'error': 'Invalid token'}), 401
    return _get_or_create_user(phone), None, None

# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/api/sendOtp', methods=['POST'])
def send_otp():
    data = request.get_json()
    phone = data.get('phone')
    if not phone or not is_valid_phone(phone):
        return jsonify({'error': 'Invalid phone number'}), 400
    code = phone  # mock: OTP == phone number
    set_otp(phone, code)
    return jsonify({'otp': code}), 200

@app.route('/api/verifyOtp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    phone, code = data.get('phone'), data.get('code')
    if not phone or not code or not is_valid_phone(phone):
        return jsonify({'error': 'Invalid input'}), 400
    if code != phone:
        return jsonify({'error': 'Invalid OTP'}), 400
    otp_store.pop(phone, None)
    user = _get_or_create_user(phone)
    return jsonify({
        'token': create_session(phone),
        'is_new_user': not user.get('registered', False),
        'account_id': user['id'],
    }), 200

@app.route('/api/register', methods=['POST'])
def register():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    data = request.get_json()
    registry = _load_registry()
    for u in registry['users']:
        if u['id'] == user['id']:
            u['firstName']  = data.get('firstName', '')
            u['middleName'] = data.get('middleName', '')
            u['lastName']   = data.get('lastName', '')
            u['handles'] = {
                'gmail':     data.get('gmail', ''),
                'yahoo':     data.get('yahoo', ''),
                'twitter':   data.get('twitter', ''),
                'instagram': data.get('instagram', ''),
                'facebook':  data.get('facebook', ''),
                'whatsapp':  data.get('whatsapp', ''),
            }
            u['registered'] = True
            break
    _save_registry(registry)
    return jsonify({'message': 'Registration complete', 'account_id': user['id']}), 200

@app.route('/api/me', methods=['GET', 'PUT'])
def me():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    if request.method == 'GET':
        profile = _load_profile(user['id'])
        return jsonify({**user, 'email': profile.get('email', ''), 'dob': profile.get('dob', '')}), 200
    # PUT — update editable fields only (phone + id are immutable)
    data = request.get_json()
    registry = _load_registry()
    for u in registry['users']:
        if u['id'] == user['id']:
            for field in ('firstName', 'middleName', 'lastName'):
                if field in data:
                    u[field] = data[field]
            if 'handles' in data:
                u.setdefault('handles', {}).update(data['handles'])
            if 'address' in data:
                u['address'] = {
                    'line1':    data['address'].get('line1', ''),
                    'line2':    data['address'].get('line2', ''),
                    'city':     data['address'].get('city', ''),
                    'district': data['address'].get('district', ''),
                    'state':    data['address'].get('state', ''),
                    'pincode':  data['address'].get('pincode', ''),
                    'country':  data['address'].get('country', 'India'),
                }
            break
    _save_registry(registry)
    _save_profile(user['id'], {
        'email': data.get('email', ''),
        'dob':   data.get('dob', ''),
    })
    return jsonify({'message': 'Profile updated'}), 200

@app.route('/api/profile', methods=['GET', 'POST'])
def profile():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    if request.method == 'GET':
        return jsonify(_load_profile(user['id'])), 200
    _save_profile(user['id'], request.get_json())
    return jsonify({'message': 'Profile updated'}), 200

@app.route('/api/records', methods=['GET', 'POST'])
def records():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    if request.method == 'GET':
        return jsonify(_load_visits(user['id'])), 200
    # POST — multipart (with files) or JSON (no files)
    if request.content_type and 'multipart/form-data' in request.content_type:
        data  = request.form.to_dict()
        files = request.files.getlist('files')
    else:
        data  = request.get_json() or {}
        files = []
    visit = _save_visit(user['id'], data, files)
    _build_and_save_summary(user['id'])          # keep summary in sync
    return jsonify(visit), 201

# ── Summary routes (must come before /<visit_id> routes) ─────────────────────
@app.route('/api/records/summary', methods=['GET'])
def get_summary():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    return jsonify(_load_summary(user['id'])), 200

@app.route('/api/records/summary/rescan', methods=['POST'])
def rescan_summary():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    summary = _build_and_save_summary(user['id'])
    return jsonify({'message': 'Summary rebuilt', 'total_visits': summary.get('total_visits', 0)}), 200

@app.route('/api/records/<visit_id>', methods=['DELETE'])
def delete_record(visit_id):
    user, err, code = _authed_user(request)
    if err:
        return err, code
    vdir = os.path.join(_visits_dir(user['id']), secure_filename(visit_id))
    if not os.path.exists(vdir):
        return jsonify({'error': 'Visit not found'}), 404
    shutil.rmtree(vdir)
    _build_and_save_summary(user['id'])          # keep summary in sync
    return jsonify({'message': 'Visit deleted'}), 200

@app.route('/api/records/<visit_id>/files/<filename>', methods=['GET'])
def serve_record_file(visit_id, filename):
    # Accept token via Authorization header OR ?token= query param (for direct links)
    token = request.args.get('token') or (request.headers.get('Authorization', '').replace('Bearer ', '') or None)
    phone = get_phone_from_token(token) if token else None
    if not phone:
        return jsonify({'error': 'Unauthorized'}), 401
    user = _get_or_create_user(phone)
    filepath = os.path.join(_visits_dir(user['id']), secure_filename(visit_id), secure_filename(filename))
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    mime, _ = mimetypes.guess_type(filepath)
    return send_file(filepath, mimetype=mime or 'application/octet-stream',
                     as_attachment=False, download_name=filename)

@app.route('/swagger.json')
def swagger_json():
    with open(os.path.join(os.path.dirname(__file__), 'swagger.json')) as f:
        return jsonify(json.load(f))

SWAGGER_URL = '/swagger'
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL, '/swagger.json', config={'app_name': 'AyushCare API'})
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

@app.route('/')
def root():
    return redirect('/swagger/', code=302)

if __name__ == '__main__':
    app.run(debug=True, port=8000)