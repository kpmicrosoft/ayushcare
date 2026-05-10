const isLocal = window.location.hostname === 'localhost';

const PROD_API_URL = 'https://ayushcare-api-gnfudrg6ejbadrh0.eastus2-01.azurewebsites.net/api';
const LOCAL_API_URL = 'http://localhost:7071/api';

const config = {
  apiBaseUrl: isLocal ? LOCAL_API_URL : PROD_API_URL,
};

export default config;