from flask import Flask, request, jsonify
import random
import time
import uuid
import json
import os
from flask_swagger_ui import get_swaggerui_blueprint
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

otp_store = {}
session_store = {}
profile_store = {}
records_store = {}

def generate_otp_code():
    return str(random.randint(100000, 999999))

def set_otp_for_phone(phone, code):
    expiry = time.time() + 60 * 60  # 1 hour for testing
    otp_store[phone] = {'code': code, 'expiry': expiry}

def get_otp_for_phone(phone):
    entry = otp_store.get(phone)
    if not entry or time.time() > entry['expiry']:
        return None
    return entry

def remove_otp_for_phone(phone):
    otp_store.pop(phone, None)

def create_session_token(phone):
    token = str(uuid.uuid4())
    session_store[token] = {'phone': phone, 'created_at': time.time()}
    return token

def get_session_phone(token):
    entry = session_store.get(token)
    return entry['phone'] if entry else None

def is_valid_phone(phone):
    import re
    return bool(re.match(r'^\+?\d{10,15}$', phone))

@app.route('/api/sendOtp', methods=['POST'])
def send_otp():
    data = request.get_json()
    phone = data.get('phone')
    if not phone or not is_valid_phone(phone):
        return jsonify({'error': 'Invalid phone number'}), 400
    
    code = phone  # Mock OTP is the phone number
    set_otp_for_phone(phone, code)
    # For mock, return the OTP
    return jsonify({'otp': code}), 200

@app.route('/api/verifyOtp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    phone = data.get('phone')
    code = data.get('code')
    if not phone or not code or not is_valid_phone(phone):
        return jsonify({'error': 'Invalid input'}), 400
    
    entry = get_otp_for_phone(phone)
    if code != phone:
        return jsonify({'error': 'Invalid OTP'}), 400
    
    remove_otp_for_phone(phone)
    token = create_session_token(phone)
    return jsonify({'token': token}), 200

@app.route('/api/profile', methods=['GET', 'POST'])
def profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split(' ')[1]
    if token == 'demo-token':
        phone = '+7327184414'
    else:
        phone = get_session_phone(token)
        if not phone:
            return jsonify({'error': 'Invalid token'}), 401
    
    if request.method == 'GET':
        profile_data = profile_store.get(phone, {})
        return jsonify(profile_data), 200
    elif request.method == 'POST':
        data = request.get_json()
        profile_store[phone] = data
        return jsonify({'message': 'Profile updated'}), 200

@app.route('/api/records', methods=['GET', 'POST'])
def records():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Unauthorized'}), 401
    
    token = auth_header.split(' ')[1]
    if token == 'demo-token':
        phone = '+7327184414'
    else:
        phone = get_session_phone(token)
        if not phone:
            return jsonify({'error': 'Invalid token'}), 401
    
    if request.method == 'GET':
        user_records = records_store.get(phone, [])
        return jsonify(user_records), 200
    elif request.method == 'POST':
        data = request.get_json()
        if not records_store.get(phone):
            records_store[phone] = []
        data['id'] = str(uuid.uuid4())
        records_store[phone].append(data)
        return jsonify({'message': 'Record added', 'id': data['id']}), 201

@app.route('/swagger.json')
def swagger():
    with open(os.path.join(os.path.dirname(__file__), 'swagger.json'), 'r') as f:
        return jsonify(json.load(f))

SWAGGER_URL = '/swagger'
API_URL = '/swagger.json'
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "AyushCare API"
    }
)
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

@app.route('/')
def root():
    from flask import redirect
    return redirect('/swagger/', code=302)

if __name__ == '__main__':
    app.run(debug=True, port=5000)