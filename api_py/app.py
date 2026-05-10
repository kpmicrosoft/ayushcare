from flask import Flask, request, jsonify, redirect
import random
import re
import time
import uuid
import json
import os
import shutil
from datetime import datetime
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
        'name': '',
        'handles': {
            'gmail': '', 'yahoo': '', 'twitter': '',
            'instagram': '', 'facebook': '', 'whatsapp': ''
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
def _visits_dir(user_id):
    return os.path.join(USERS_DIR, user_id, 'visits')

def _load_visits(user_id):
    vdir = _visits_dir(user_id)
    if not os.path.exists(vdir):
        return []
    visits = []
    for folder in sorted(os.listdir(vdir)):
        rpath = os.path.join(vdir, folder, 'record.json')
        if os.path.exists(rpath):
            with open(rpath) as f:
                visits.append(json.load(f))
    return visits

def _save_visit(user_id, data):
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%S')
    visit_dir = os.path.join(_visits_dir(user_id), ts)
    os.makedirs(visit_dir, exist_ok=True)
    data.update({'id': ts, 'created_at': datetime.utcnow().isoformat()})
    with open(os.path.join(visit_dir, 'record.json'), 'w') as f:
        json.dump(data, f, indent=2)
    return data

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
        return '+7327184414'
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
            u['name'] = data.get('name', '')
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

@app.route('/api/me', methods=['GET'])
def me():
    user, err, code = _authed_user(request)
    if err:
        return err, code
    return jsonify(user), 200


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
    visit = _save_visit(user['id'], request.get_json())
    return jsonify({'message': 'Record added', 'id': visit['id']}), 201

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