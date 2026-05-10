// ─── Social handle metadata (label, brand color, short symbol) ───────────────
// Change symbol/color here when switching to proper icon library (e.g. FontAwesome brands)
export const HANDLE_META = {
  gmail:     { label: 'Gmail',      color: '#EA4335', symbol: 'G'  },
  yahoo:     { label: 'Yahoo Mail', color: '#6001D2', symbol: 'Y!' },
  twitter:   { label: 'X (Twitter)',color: '#000000', symbol: '𝕏'  },
  instagram: { label: 'Instagram',  color: '#E1306C', symbol: '◎'  },
  facebook:  { label: 'Facebook',   color: '#1877F2', symbol: 'f'  },
  whatsapp:  { label: 'WhatsApp',   color: '#25D366', symbol: 'W'  },
};
export const EMPTY_ADDRESS = {
  line1: '', line2: '', city: '', district: '', state: '', pincode: '', country: 'India',
};
export const EMPTY_HANDLES = {
  gmail: '', yahoo: '', twitter: '', instagram: '', facebook: '', whatsapp: '',
};
export const EMPTY_REG = { firstName: '', middleName: '', lastName: '', ...EMPTY_HANDLES };

// ─── External lookup APIs ─────────────────────────────────────────────────────
// Swap these for Google APIs later without touching AddressForm logic
export const LOOKUP_APIS = {
  indiaPincode: (pin)  => `https://api.postalpincode.in/pincode/${pin}`,
  usZip:        (zip)  => `https://api.zippopotam.us/us/${zip}`,
};

// ─── India states & UTs ───────────────────────────────────────────────────────
export const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu and Kashmir','Ladakh','Puducherry','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Lakshadweep','Andaman and Nicobar Islands',
];

// ─── US states & DC ───────────────────────────────────────────────────────────
export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia',
];

// ─── India cities / towns / villages (typeahead seed list) ───────────────────
// Major cities + district HQs; the PIN lookup augments this with local names.
export const INDIA_CITIES = [
  // Andhra Pradesh
  'Visakhapatnam','Vijayawada','Guntur','Nellore','Kurnool','Rajahmundry','Tirupati',
  'Kakinada','Kadapa','Anantapur','Eluru','Ongole','Vizianagaram','Srikakulam',
  'Chittoor','Hindupur','Proddatur','Machilipatnam','Nandyal','Narasaraopet',
  // Telangana
  'Hyderabad','Warangal','Nizamabad','Karimnagar','Khammam','Mahbubnagar','Nalgonda',
  'Adilabad','Medak','Rangareddy','Sangareddy','Siddipet','Suryapet','Yadadri',
  'Bhadrachalam','Jagtial','Jangaon','Mancherial','Miryalaguda','Nagarkurnool',
  'Narayanpet','Peddapalli','Rajanna Sircilla','Vikarabad','Wanaparthy','Mahabubnagar',
  // Maharashtra
  'Mumbai','Pune','Nagpur','Nashik','Aurangabad','Solapur','Kolhapur','Amravati',
  'Sangli','Malegaon','Jalgaon','Akola','Latur','Dhule','Ahmednagar','Chandrapur',
  'Parbhani','Ichalkaranji','Jalna','Bhiwandi','Panvel','Thane','Navi Mumbai',
  // Karnataka
  'Bengaluru','Mysuru','Hubli','Mangaluru','Belagavi','Kalaburagi','Davanagere',
  'Ballari','Bidar','Shivamogga','Tumakuru','Raichur','Udupi','Hassan','Bagalkot',
  'Vijayapura','Dharwad','Chitradurga','Gadag','Chikmagalur','Kolar','Yadgir',
  // Tamil Nadu
  'Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem','Tirunelveli','Erode',
  'Vellore','Thoothukudi','Tiruppur','Dindigul','Thanjavur','Ranipet','Sivakasi',
  'Kanchipuram','Nagercoil','Hosur','Ooty','Kumbakonam','Karur',
  // Kerala
  'Thiruvananthapuram','Kochi','Kozhikode','Thrissur','Kollam','Palakkad','Alappuzha',
  'Kannur','Kottayam','Malappuram','Kasaragod','Idukki','Wayanad','Pathanamthitta',
  // Gujarat
  'Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar','Jamnagar','Junagadh','Gandhinagar',
  'Anand','Morbi','Nadiad','Surendranagar','Mehsana','Bhuj','Vapi','Navsari','Porbandar',
  // Rajasthan
  'Jaipur','Jodhpur','Kota','Bikaner','Ajmer','Udaipur','Bhilwara','Alwar','Bharatpur',
  'Sikar','Pali','Sri Ganganagar','Barmer','Tonk','Churu','Dholpur','Banswara',
  // Uttar Pradesh
  'Lucknow','Kanpur','Ghaziabad','Agra','Varanasi','Prayagraj','Meerut','Bareilly',
  'Aligarh','Moradabad','Saharanpur','Gorakhpur','Noida','Firozabad','Muzaffarnagar',
  'Mathura','Jhansi','Hapur','Rampur','Etawah','Shahjahanpur','Faizabad','Mirzapur',
  // Madhya Pradesh
  'Bhopal','Indore','Jabalpur','Gwalior','Ujjain','Sagar','Dewas','Satna','Ratlam',
  'Rewa','Murwara','Singrauli','Burhanpur','Khandwa','Bhind','Chhindwara','Guna',
  // Bihar
  'Patna','Gaya','Muzaffarpur','Bhagalpur','Ara','Begusarai','Katihar','Munger',
  'Purnia','Sitamarhi','Darbhanga','Bihar Sharif','Siwan','Chapra','Hajipur',
  // West Bengal
  'Kolkata','Howrah','Durgapur','Asansol','Siliguri','Bardhaman','Malda','Baharampur',
  'Habra','Kharagpur','Shantipur','Dankuni','Dhulian','Ranaghat','Haldia','Raiganj',
  // Punjab
  'Ludhiana','Amritsar','Jalandhar','Patiala','Bathinda','Mohali','Pathankot',
  'Hoshiarpur','Batala','Moga','Firozpur','Muktsar','Barnala','Sangrur','Gurdaspur',
  // Haryana
  'Faridabad','Gurgaon','Panipat','Ambala','Yamunanagar','Rohtak','Hisar','Karnal',
  'Sonipat','Panchkula','Bhiwani','Sirsa','Bahadurgarh','Jind','Rewari',
  // Delhi
  'New Delhi','Dwarka','Rohini','Janakpuri','Pitampura','Karol Bagh','Lajpat Nagar',
  'Saket','Vasant Kunj','Shahdara','Preet Vihar','Mayur Vihar','Laxmi Nagar',
  // Himachal Pradesh
  'Shimla','Dharamsala','Solan','Mandi','Kullu','Manali','Hamirpur','Una','Kangra',
  // Uttarakhand
  'Dehradun','Haridwar','Rishikesh','Roorkee','Haldwani','Rudrapur','Kashipur','Nainital',
  // Jharkhand
  'Ranchi','Jamshedpur','Dhanbad','Bokaro','Deoghar','Phusro','Hazaribagh','Giridih',
  // Odisha
  'Bhubaneswar','Cuttack','Rourkela','Brahmapur','Sambalpur','Puri','Balasore','Baripada',
  // Assam
  'Guwahati','Silchar','Dibrugarh','Jorhat','Nagaon','Tinsukia','Tezpur','Bongaigaon',
  // Goa
  'Panaji','Margao','Vasco da Gama','Mapusa','Ponda',
  // Jammu & Kashmir / Ladakh
  'Srinagar','Jammu','Anantnag','Sopore','Baramulla','Leh','Kargil',
];
