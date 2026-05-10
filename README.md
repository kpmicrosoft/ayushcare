# ayushcare

Electronic Health Records web + mobile app built with Expo web and Azure.
-------------
-------------
## Project goal
Build a single codebase experience for patients to:
- login with mobile number and OTP
- view and manage their profile
- add and manage medical records
- approve doctors/hospitals to access their profile

## Selected architecture
- Frontend: `Expo` + `React Native Web` + `TypeScript` in `app/`
- Backend: `Python Flask` API in `api_py/` (runs on port 8000)
- Database: JSON flat-file store in `data/` (no external DB required)
- Deployment: `Azure Static Web Apps` (frontend) + `Azure App Service` (backend)
- Domain: GoDaddy custom domain attached to Azure

## Development plan
Each item is marked so the project can restart cleanly.

### Phase 1: scaffold and login
- [x] Create Expo + TypeScript app scaffold
- [x] Configure Expo web support for browser development
- [x] Create Python Flask backend scaffold
- [x] Implement mock OTP login flow
- [x] Implement local auth state and token/session handling
- [ ] Add backend unit tests for OTP endpoints
- [x] Add frontend UI validation for login screens
- [x] Run test cases and manually validate login UI on web

### Phase 2: patient core features
- [x] Add patient profile view/edit UI
- [x] Add medical record creation and listing
- [x] File-based data store (users registry + per-user visit folders)
- [ ] **Next: Add user registration flow**
  - Unique account ID: `yyyyMMdd` + 10-digit zero-padded sequence (e.g. `202605090000000001`)
  - Primary login: phone + OTP
  - Additional handles: Gmail, Yahoo Mail, Twitter, Instagram, Facebook, WhatsApp
  - All handles stored in `metadata/users.json` under the same account ID
- [ ] **Next: Add medical record entry flow** — structured visit records (doctor, diagnosis, prescriptions, notes) saved as timestamped folders under `users/{id}/visits/`
- [ ] Add access request workflow for doctors/hospitals
- [ ] Add patient approval step for external access
- [ ] Add backend tests for patient/profile record APIs
- [ ] Add frontend tests for profile and records UI
- [ ] Perform manual validation of profile and record flows

### Phase 3: deployment and integration
- [x] Connect repository to GitHub (initialize repo if needed)
- [x] Create Azure Static Web App and attach GitHub workflow
- [x] Deploy frontend + backend to Azure
- [x] Configure data storage (JSON flat-file, no Cosmos DB needed)
- [ ] Connect GoDaddy custom domain to Azure Static Web Apps
- [ ] Add CI test pipeline for backend and frontend
- [ ] Perform end-to-end validation after deployment

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Azure deployment instructions.
When restarting, review this README and follow the first incomplete item under "Development plan." Use the status checkboxes to continue with the next task.

### Current status
- [x] Project initialization complete
- [x] Stack selected and plan agreed
- [x] Mock OTP flow selected for initial MVP
- [x] Backend OTP endpoints implemented
- [x] Backend unit tests passing
- [x] Frontend UI validation complete
- [x] Frontend deployed to Azure Static Web Apps (auto-deploy on push to `main`)
- [x] Backend deployed to Azure App Service (auto-deploy on push to `main`)
- [x] Frontend connects to backend via externalized config (`app/config.js`)
- [ ] GoDaddy custom domain pending
- [ ] CI test pipeline pending

## Notes for the assistant
- Keep this file updated as tasks are completed.
- Mark completed checklist items with `- [x]`.
- Preserve the plan during restarts so work can resume immediately.

## Helpful commands
- `./scripts/start-dev.sh` to start both frontend and backend servers
- `cd app && npm install`
- `cd app && npm run web`
- `cd api_py && pip install -r requirements.txt`
- `cd api_py && python3 app.py` (runs on port 8000)
- `cd app && npm run build` for frontend production builds
- API URL switching is automatic: `app/config.js` uses `localhost:8000` locally and the Azure backend URL in production

## Data storage

All data is stored as JSON files under `data/` (gitignored — only the folder scaffold is committed):

```
data/
├── metadata/
│   ├── users.json              # master user registry
│   └── archive/                # auto-snapshot on every write
└── users/
    └── {userId}/               # e.g. usr_a1b2c3
        ├── profile.json        # name, dob, etc.
        └── visits/
            └── 20260509T204440/    # one folder per doctor visit
                └── record.json
```

**`metadata/users.json`** maps identity handles to a unique user ID:
```json
{
  "users": [
    {
      "id": "usr_a1b2c3",
      "phone": "+1234567890",
      "emails": [],
      "handles": {},
      "created_at": "2026-05-09T20:44:40"
    }
  ]
}
```

Users are created automatically on first OTP login. Every write to `users.json` archives the previous version under `metadata/archive/`.
