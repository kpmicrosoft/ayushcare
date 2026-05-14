# Azure Deployment Guide for AyushCare

This guide walks through deploying the AyushCare application to Azure using the Python Flask backend in `api_py/` and the Expo frontend in `app/`.

## Prerequisites
- Azure subscription
- GitHub account with repository access
- Azure CLI installed locally (`az` command)
- Python 3.12+ and Node.js 18+

## Step 1: Create Azure Resources

### 1.1 Create Resource Group
```bash
az group create --name ayushcare-rg --location eastus2
```

### 1.2 Create App Service for Backend (Python Flask)
```bash
az appservice plan create \
  --name ayushcare-plan \
  --resource-group ayushcare-rg \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group ayushcare-rg \
  --plan ayushcare-plan \
  --name ayushcare-api \
  --runtime "PYTHON|3.12"
```

### 1.3 Create Azure Static Web App for Frontend
```bash
az staticwebapp create \
  --name ayushcare-web \
  --resource-group ayushcare-rg \
  --source https://github.com/YOUR_GITHUB_USERNAME/ayushcare \
  --location eastus2 \
  --branch main \
  --token YOUR_GITHUB_TOKEN
```

## Step 2: Configure GitHub Actions

1. In your GitHub repository, go to **Settings > Secrets and variables > Actions**
2. Add the following secrets:
   - `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - `AZURE_RESOURCE_GROUP` set to `ayushcare-rg`
   - `AZURE_SUBSCRIPTION_ID` set to your subscription ID

## Step 3: Configure Environment Variables

### Frontend
The frontend automatically selects the API URL based on the environment via `app/config.js`:
- **Local**: `http://localhost:7071/api`
- **Production**: `https://ayushcare-api-gnfudrg6ejbadrh0.eastus2-01.azurewebsites.net/api`

No manual changes are needed. If the backend URL changes, update `PROD_API_URL` in `app/config.js`.

### Backend — Persistent Data Storage on Azure

On Azure App Service Linux, the container file system is ephemeral and is **wiped on every restart or redeploy**. The `/home` volume is the only path that persists across restarts, slot swaps, and scale-out instances.

The backend automatically detects Azure by checking the `WEBSITE_SITE_NAME` environment variable (set by Azure App Service). When detected, it stores all data under `/home/data` instead of the local `../data` folder. No manual configuration is required.

To override the path explicitly, set the `DATA_DIR` app setting in the Azure portal:
```bash
az webapp config appsettings set \
  --resource-group ayushcare-rg \
  --name ayushcare-api \
  --settings DATA_DIR=/home/data
```

> **Important**: If you are migrating an existing deployment, copy any data from the old location to `/home/data` before restarting the app service.

## Step 4: Deploy

### Automatic Deployment (GitHub Actions)
Push to the `main` branch and let GitHub Actions deploy the frontend and backend automatically.

### Manual Deployment

**Frontend:**
```bash
cd app
npm install
npm run build
```
Then use Azure Static Web Apps deployment if needed.

**Backend:**
```bash
cd api_py
/opt/homebrew/bin/python3.12 -m pip install -r requirements.txt
az webapp up --resource-group ayushcare-rg --name ayushcare-api --sku B1 --runtime "PYTHON|3.12"
```

## Step 5: Domain Configuration

### Connect GoDaddy Domain
1. In Azure portal, go to Static Web App > Custom domains
2. Add your custom domain, e.g. `ayushcare.com`
3. Copy the required DNS TXT record
4. Add the TXT record in GoDaddy DNS settings
5. Wait for domain verification and binding

## Step 6: Verify Deployment

1. **Frontend**: Visit `https://ayushcare-web.azurestaticapps.net`
2. **Backend**: Test `https://ayushcare-api-gnfudrg6ejbadrh0.eastus2-01.azurewebsites.net/api/sendOtp`
3. Confirm the full login flow works end-to-end

## Troubleshooting

### Build Failures
- Check GitHub Actions logs
- Verify Python 3.12 and Node.js 18+ compatibility
- Confirm `requirements.txt` and `package.json` have the right dependencies

### API Connection Issues
- Ensure frontend points to the correct backend URL
- Check backend app service health in Azure
- Confirm no port or firewall restrictions prevent access

## Next Steps

1. Monitor the app in Azure Portal
2. Add Application Insights for observability
3. Configure production scaling
4. Add a CI/CD workflow for predeploy tests
5. Improve deployment automation where needed
