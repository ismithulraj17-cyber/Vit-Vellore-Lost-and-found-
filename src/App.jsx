import React, { useState, useEffect } from 'react';
import MapSearch from './components/MapSearch';
import { BASE_ZOOM, CAMPUS_ASPECT_RATIO, CAMPUS_BOUNDS, FLY_MS, MAX_ZOOM } from './config/mapConfig';
import { getMapItemFields } from './lib/mapSearch';
import { createReport, fetchReports, uploadReportImage } from './lib/reportsRepository';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { 
  Search, Plus, MapPin, Calendar, Tag, ShieldCheck, 
  CheckCircle, AlertTriangle, 
  Sun, Moon, Compass, Filter, Sparkles, Eye, X, Check,
  ArrowRight, AlertCircle, ZoomIn, ZoomOut, Navigation
} from 'lucide-react';

const VIT_LOCATIONS = [
  'SJT (Silver Jubilee Tower)', 'TT (Technology Tower)', 'SMV (Swami Vivekananda Block)',
  'MGR Main Building', 'GDN (GD Naidu Block)', 'MGB (Mahatma Gandhi Block)',
  'CDMM Building', 'CBMR Building', 'CTS Building', 'S Block', 'T Block',
  'PRP A Block', 'PRP B Block', 'PRP C Block', 'PRP D Block', 'PRP E Block', 'PRP F Block',
  'ALM Block', 'Energy Center', 'Central Library (Periyar EVR)', 'Indoor Stadium',
  'Anna Auditorium', 'Dr. Channa Reddy Auditorium', 'CS Hall', 'SJT Ground',
  'Office of Students Welfare', 'Health Center', 'Main Guest House', 'VIT Lake',
  "Men's Hostel Office", "Ladies' Hostel Office",
  'MH A Block', 'MH B Block', 'MH B Annex', 'MH C Block', 'MH D Block', 'MH D Annex',
  'MH E Block', 'MH F Block', 'MH G Block', 'MH H Block', 'MH J Block', 'MH K Block',
  'MH L Block', 'MH M Block', 'MH M Annex', 'MH N Block', 'MH N Annex', 'MH P Block',
  'MH Q Block', 'MH R Block', 'MH S Block', 'MH T Block',
  'LH A Block', 'LH B Block', 'LH C Block', 'LH D Block', 'LH E Block', 'LH F Block',
  "LH G Block", "LH H Block", "LH J Block", "RGT H Block", "Ladies' Hostel GH Annex",
  'Food Court', 'Food Street', 'Main Canteen', 'Foodys', 'Greenos', 'Nescafe',
  'Woodys', 'AllMart Supermarket', 'Snacks & Milk Kiosk', 'Book Store',
  'Xerox & Stationery', 'Post Office', 'Indian Bank ATM', 'City Union Bank ATM',
  'Swimming Pool', 'VIT Lake Parking', 'Gate 2A', 'Gate 2B', 'Gate 3', 'Gate 3A', 'Gate 11'
];

const MEN_HOSTEL_START = VIT_LOCATIONS.findIndex(location => location.startsWith('MH '));
const FOOD_SERVICES_START = VIT_LOCATIONS.indexOf('Food Court');
const LOCATION_GROUPS = [
  { label: 'Campus buildings & facilities', locations: VIT_LOCATIONS.slice(0, MEN_HOSTEL_START) },
  { label: "Men's hostels", locations: VIT_LOCATIONS.filter(location => location.startsWith('MH ')) },
  { label: "Ladies' hostels", locations: VIT_LOCATIONS.filter(location => location.startsWith('LH ') || location.startsWith('RGT ') || location.startsWith("Ladies' Hostel")) },
  { label: 'Food, shops & services', locations: VIT_LOCATIONS.slice(FOOD_SERVICES_START) },
];
const [[CAMPUS_SOUTH, CAMPUS_WEST], [CAMPUS_NORTH, CAMPUS_EAST]] = CAMPUS_BOUNDS;
const INITIAL_MAP_CENTER = {
  lat: (CAMPUS_NORTH + CAMPUS_SOUTH) / 2,
  lon: (CAMPUS_WEST + CAMPUS_EAST) / 2,
};
const toWorldPixel = (lat, lon, zoom) => {
  const size = 256 * (2 ** zoom);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size,
  };
};
const fromWorldPixel = (x, y, zoom) => {
  const size = 256 * (2 ** zoom);
  const lon = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lon };
};
const clampMapCenter = (center, zoom, width, height) => {
  const west = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_WEST, zoom).x;
  const east = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_EAST, zoom).x;
  const north = toWorldPixel(CAMPUS_NORTH, INITIAL_MAP_CENTER.lon, zoom).y;
  const south = toWorldPixel(CAMPUS_SOUTH, INITIAL_MAP_CENTER.lon, zoom).y;
  const desired = toWorldPixel(center.lat, center.lon, zoom);
  const clampAxis = (value, min, max) => min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value));
  return fromWorldPixel(
    clampAxis(desired.x, west + width / 2, east - width / 2),
    clampAxis(desired.y, north + height / 2, south - height / 2),
    zoom,
  );
};
const itemMapLatLon = ({ x, y }) => ({
  // The supplied campus poster has a title strip above the aerial map.
  lat: CAMPUS_NORTH - (Math.max(0, y - 9.5) / 90.5) * (CAMPUS_NORTH - CAMPUS_SOUTH),
  lon: CAMPUS_WEST + (x / 100) * (CAMPUS_EAST - CAMPUS_WEST),
});
const withMapFields = (item) => {
  const point = item.coordinates ? itemMapLatLon(item.coordinates) : INITIAL_MAP_CENTER;
  return {
    ...item,
    name: item.name ?? item.title ?? 'Unnamed item',
    lat: item.lat ?? point.lat,
    lng: item.lng ?? point.lon,
    building: item.building ?? item.location ?? 'Campus',
    floor: item.floor?.trim() || 'Floor not provided',
    landmark: item.landmark?.trim() || '',
  };
};
const markerSpreadOffset = (index, count) => {
  if (count < 2) return { x: 0, y: 0 };
  const ring = Math.floor(index / 8);
  const ringCount = Math.min(8, count - ring * 8);
  const ringIndex = index % 8;
  const ringRadius = ringCount < 2 ? 0 : 20 / Math.sin(Math.PI / ringCount);
  const radius = Math.max(27, ringRadius) + ring * 40;
  const angle = -Math.PI / 2 + (2 * Math.PI * ringIndex) / ringCount + ring * 0.35;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};
const locationMapPoint = (location) => {
  const namedPoints = {
    'SJT (Silver Jubilee Tower)': [70, 50], 'TT (Technology Tower)': [44, 55],
    'SMV (Swami Vivekananda Block)': [43, 75], 'MGR Main Building': [25, 68],
    'GDN (GD Naidu Block)': [19, 64], 'MGB (Mahatma Gandhi Block)': [79, 42],
    'CDMM Building': [33, 47], 'CBMR Building': [56, 74], 'CTS Building': [51, 38],
    'S Block': [61, 37], 'T Block': [64, 37], 'ALM Block': [22, 68], 'Energy Center': [47, 70],
    'Central Library (Periyar EVR)': [29, 76], 'Food Court': [25, 64],
    'Food Street': [23, 62], 'Main Canteen': [28, 66], 'Foodys': [37, 62],
    'Greenos': [30, 71], 'Nescafe': [52, 52], 'Woodys': [35, 63],
    'VIT Lake': [54, 70], 'PRP A Block': [84, 54], 'PRP B Block': [85, 56],
    'PRP C Block': [86, 58], 'PRP D Block': [87, 55], 'PRP E Block': [86, 53],
    'PRP F Block': [84, 57], 'Indoor Stadium': [39, 48], 'Anna Auditorium': [25, 47],
    'Dr. Channa Reddy Auditorium': [18, 67], 'CS Hall': [45, 44], 'SJT Ground': [75, 56],
    'Office of Students Welfare': [66, 48], 'Health Center': [31, 69], 'Main Guest House': [43, 60],
    "Men's Hostel Office": [66, 44], "Ladies' Hostel Office": [82, 48],
    'MH B Block': [29, 27], 'MH F Block': [38, 27], 'MH G Block': [50, 32],
    'MH E Block': [53, 38], 'MH H Block': [29, 42], 'MH J Block': [28, 48],
    'MH K Block': [61, 39], 'MH L Block': [52, 44], 'MH M Block': [62, 40],
    'MH Q Block': [68, 28], 'MH R Block': [64, 34],
    'AllMart Supermarket': [26, 72], 'Snacks & Milk Kiosk': [32, 59], 'Book Store': [24, 61],
    'Xerox & Stationery': [46, 58], 'Post Office': [21, 58], 'Indian Bank ATM': [21, 60],
    'City Union Bank ATM': [28, 62], 'Swimming Pool': [54, 29], 'VIT Lake Parking': [48, 72],
    'Gate 2A': [15, 61], 'Gate 2B': [24, 85], 'Gate 3': [42, 89], 'Gate 3A': [71, 89], 'Gate 11': [77, 62],
  };
  if (namedPoints[location]) return { x: namedPoints[location][0], y: namedPoints[location][1] };
  if (location.startsWith('MH ')) {
    const letter = location.match(/MH ([A-Z])/i)?.[1] || 'A';
    const index = Math.max(0, 'ABCDEFGHIJKLMNOPQRST'.indexOf(letter));
    return { x: 62 + (index % 6) * 2.2, y: 25 + Math.floor(index / 6) * 4.2 };
  }
  if (location.startsWith('LH ') || location.startsWith('RGT ') || location.startsWith('Ladies')) {
    const letter = location.match(/LH ([A-Z])/i)?.[1] || 'A';
    const index = Math.max(0, 'ABCDEFGHIJ'.indexOf(letter));
    return { x: 78 + (index % 4) * 2, y: 49 + Math.floor(index / 4) * 4 };
  }
  return { x: 50, y: 50 };
};

// Mock Items with robust, high-availability image links
const INITIAL_ITEMS = [
  {
    id: 1,
    title: 'AUKEY Omnia Mini 20W USB-C Charger',
    category: 'Electronics',
    location: 'SJT (Silver Jubilee Tower)',
    coordinates: { x: 70, y: 50 },
    date: '2026-10-18',
    status: 'lost',
    description: 'White AUKEY 20W USB-C charger in its retail box. I may have left it in SJT 304 after class.',
    image: '/items/charger-premium.jpg',
    contact: 'student.sjt2024@vitstudent.ac.in',
    phone: '+91 98450 12345',
    owner: 'Rahul Sharma',
    verifiedPin: '4821'
  },
  {
    id: 2,
    title: 'Casio Scientific Calculator',
    category: 'Stationery',
    location: 'TT (Technology Tower)',
    coordinates: { x: 44, y: 55 },
    date: '2026-10-19',
    status: 'found',
    description: 'Found this Casio fx-991ES Plus on a second-floor desk near the mechanical lab.',
    image: '/items/calculator-premium.jpg',
    contact: 'guard.tt@vit.ac.in',
    phone: '+91 94431 88990',
    owner: 'Campus Security Desk',
    verifiedPin: '1122'
  },
  {
    id: 3,
    title: 'Dorm Room Keys (Set of 3)',
    category: 'Keys',
    location: 'MH Q Block',
    coordinates: { x: 68, y: 28 },
    date: '2026-10-17',
    status: 'lost',
    description: 'Three brass keys on a blue fabric loop. I last had them near MH Q Block.',
    image: '/items/keys-premium.jpg',
    contact: 'hostel.q@vitstudent.ac.in',
    phone: '+91 97890 55441',
    owner: 'Aditya Verma',
    verifiedPin: '9988'
  },
  {
    id: 4,
    title: 'Titan Analog Wristwatch',
    category: 'Accessories',
    location: 'Central Library (Periyar EVR)',
    coordinates: { x: 29, y: 76 },
    date: '2026-10-16',
    status: 'found',
    description: 'Found a silver Titan watch with a navy face on reading table 14 and left it at the library desk.',
    image: '/items/watch-premium.jpg',
    contact: 'library.desk@vit.ac.in',
    phone: '+91 91234 56789',
    owner: 'Library Admin',
    verifiedPin: '3344'
  },
  {
    id: 5,
    title: 'Blue Hydro Flask Water Bottle',
    category: 'Personal',
    location: 'Woodys',
    coordinates: { x: 35, y: 63 },
    date: '2026-10-19',
    status: 'lost',
    description: 'I left my blue insulated bottle near Woody’s after lunch. It has a couple of small tech stickers on it.',
    image: '/items/bottle-premium.jpg',
    contact: 'priya.m2023@vitstudent.ac.in',
    phone: '+91 95001 22334',
    owner: 'Priya Mohan',
    verifiedPin: '7766'
  }
];

// Additional campus reports include a few duplicate names for search testing.
const ADDITIONAL_ITEMS = [
  { id: 8, title: 'Casio Scientific Calculator', category: 'Stationery', location: 'PRP C Block', status: 'lost', date: '2026-10-19', description: 'I left my black Casio in PRP C Block. There’s a small scratch on the back cover.', image: '/items/calculator.jpg', coordinates: locationMapPoint('PRP C Block') },
  { id: 13, title: 'Titan Analog Wristwatch', category: 'Accessories', location: 'TT (Technology Tower)', status: 'found', date: '2026-10-18', description: 'Found a blue-dial watch on a classroom desk near the stairwell in TT.', image: '/items/watch.jpg', coordinates: locationMapPoint('TT (Technology Tower)') },
  { id: 16, title: 'USB-C Laptop Charger', category: 'Electronics', location: 'Food Court', status: 'found', date: '2026-10-19', description: 'A compact USB-C charger was left by the Food Court seating. I handed it in at the counter.', image: '/items/charger.jpg', coordinates: locationMapPoint('Food Court') },
  { id: 17, title: 'Scientific Calculator', category: 'Stationery', location: 'MGR Main Building', status: 'lost', date: '2026-10-16', description: 'Dark scientific calculator with a sliding cover. I last used it in the MGR building.', image: '/items/calculator-alt.jpg', coordinates: locationMapPoint('MGR Main Building') },
  { id: 18, title: 'Key Ring with Room Keys', category: 'Keys', location: 'LH A Block', status: 'found', date: '2026-10-19', description: 'Small key ring with two room keys found by the common room.', image: '/items/keys.jpg', coordinates: locationMapPoint('LH A Block') },
  { id: 19, title: 'Silver Wristwatch', category: 'Accessories', location: 'SJT Ground', status: 'lost', date: '2026-10-15', description: 'Silver analog watch with a navy dial, last noticed near the ground.', image: '/items/watch-alt.jpg', coordinates: locationMapPoint('SJT Ground') },
  { id: 20, title: 'Insulated Water Bottle', category: 'Personal', location: 'Nescafe', status: 'found', date: '2026-10-18', description: 'Blue metal water bottle found near the Nescafe counter.', image: '/items/bottle.jpg', coordinates: locationMapPoint('Nescafe') },
  { id: 21, title: 'Wireless Earbuds and Case', category: 'Electronics', location: 'SJT (Silver Jubilee Tower)', status: 'lost', date: '2026-10-19', description: 'White wireless earbuds in a charging case, last seen near a lecture hall.', image: '/items/earbuds.jpg', coordinates: locationMapPoint('SJT (Silver Jubilee Tower)'), owner: 'Kiran R.', contact: 'kiran@example.com', shareContact: true },
  { id: 22, title: 'Wireless Earbuds and Case', category: 'Electronics', location: 'Food Street', status: 'found', date: '2026-10-18', description: 'White earbud case found on a table near the food stalls.', image: '/items/earbuds-alt.jpg', coordinates: locationMapPoint('Food Street'), owner: 'Meera S.', contact: 'meera@example.com', shareContact: true },
  { id: 23, title: 'Brown Leather Wallet', category: 'Accessories', location: 'MH Q Block', status: 'lost', date: '2026-10-19', description: 'Slim brown leather wallet, last seen around the hostel common area.', image: '/items/wallet.jpg', coordinates: locationMapPoint('MH Q Block'), owner: 'Arjun M.', contact: 'arjun@example.com', shareContact: true },
  { id: 24, title: 'Brown Leather Wallet', category: 'Accessories', location: 'Central Library (Periyar EVR)', status: 'found', date: '2026-10-18', description: 'Brown card wallet found beside the quiet study desks.', image: '/items/wallet-alt.jpg', coordinates: locationMapPoint('Central Library (Periyar EVR)') },
  { id: 25, title: 'Red Campus Backpack', category: 'Personal', location: 'TT (Technology Tower)', status: 'lost', date: '2026-10-19', description: 'Red backpack with a laptop sleeve, last seen near the classroom block.', image: '/items/backpack.jpg', coordinates: locationMapPoint('TT (Technology Tower)'), owner: 'Diya P.', contact: 'diya@example.com', shareContact: true },
  { id: 27, title: 'Spiral Lecture Notebook', category: 'Stationery', location: 'PRP B Block', status: 'lost', date: '2026-10-19', description: 'A5 ruled notebook with a dark cover and handwritten class notes.', image: '/items/notebook.jpg', coordinates: locationMapPoint('PRP B Block'), owner: 'Nikhil V.', contact: 'nikhil@example.com', shareContact: true },
  { id: 29, title: 'Black Frame Sunglasses', category: 'Accessories', location: 'SJT Ground', status: 'lost', date: '2026-10-19', description: 'Black framed sunglasses in a slim case, last seen near the ground.', image: '/items/sunglasses.jpg', coordinates: locationMapPoint('SJT Ground') },
];

const RESOLVED_ITEMS_KEY = 'vit-lost-and-found:resolved-items';
const readResolvedItems = () => {
  try { return JSON.parse(localStorage.getItem(RESOLVED_ITEMS_KEY) || '{}'); }
  catch { return {}; }
};

const SUCCESS_MESSAGES = [
  'Big W for the campus community. This item made it home!',
  "Good human energy. You just made someone's day.",
  'Lost item, found legend. Thanks for coming through.',
  'Campus side quest complete. Handover confirmed.',
  'That was so kind of you. Community MVP status unlocked.',
  'The VIT community understood the assignment. Another happy reunion!',
];

export default function App() {
  const [items, setItems] = useState(() => {
    const resolved = readResolvedItems();
    return [...INITIAL_ITEMS, ...ADDITIONAL_ITEMS].map(item => withMapFields(resolved[item.id] ? { ...item, status: 'resolved', resolvedAt: resolved[item.id] } : item));
  });
  const [mapClock, setMapClock] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const loadingPreviewTimerRef = React.useRef(null);
  const [activeTab, setActiveTab] = useState('grid');
  const [darkMode, setDarkMode] = useState(true);
  const [mapZoom, setMapZoom] = useState(BASE_ZOOM);
  const [mapMinZoom, setMapMinZoom] = useState(BASE_ZOOM);
  const [mapCenter, setMapCenter] = useState(INITIAL_MAP_CENTER);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStartRef = React.useRef(null);
  const activePointersRef = React.useRef(new Map());
  const pinchStartRef = React.useRef(null);
  const mapCenterFrameRef = React.useRef(null);
  const pendingMapCenterRef = React.useRef(null);
  const mapZoomRef = React.useRef(mapZoom);
  mapZoomRef.current = mapZoom;
  const mapViewportRef = React.useRef(null);
  const [focusedSearchId, setFocusedSearchId] = useState(null);
  const [focusedMapItem, setFocusedMapItem] = useState(null);
  const visibleMapItems = items.filter(item => item.status !== 'resolved' || !item.resolvedAt || mapClock - item.resolvedAt < 60_000);

  useEffect(() => {
    const expiring = items.filter(item => item.status === 'resolved' && item.resolvedAt)
      .map(item => item.resolvedAt + 60_000).filter(expiry => expiry > Date.now());
    if (!expiring.length) return undefined;
    const timer = setTimeout(() => setMapClock(Date.now()), Math.min(...expiring) - Date.now() + 20);
    return () => clearTimeout(timer);
  }, [items]);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [verifyStep, setVerifyStep] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [databaseError, setDatabaseError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    category: 'Electronics',
    location: 'SJT (Silver Jubilee Tower)',
    status: 'lost',
    description: '',
    image: '',
    floor: '',
    landmark: '',
    owner: '',
    phone: '',
    contact: '',
    shareContact: false,
    verifiedPin: '1234'
  });
  const phoneDigitCount = formData.phone.replace(/\D/g, '').length;
  const phoneError = formData.phone.trim() && phoneDigitCount !== 10
    ? 'Wrong number. Enter exactly 10 digits after +91.'
    : '';

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured) {
      fetchReports()
        .then(reports => {
          if (!active) return;
          const resolved = readResolvedItems();
          const databaseItems = reports.map(item => withMapFields(
            resolved[item.id] ? { ...item, status: 'resolved', resolvedAt: resolved[item.id] } : item
          ));
          const databaseIds = new Set(databaseItems.map(item => item.id));
          setItems(current => [...databaseItems, ...current.filter(item => !databaseIds.has(item.id))]);
        })
        .catch(error => {
          console.error('Could not load reports from Supabase:', error);
          if (active) setDatabaseError('Could not connect to the reports database. Existing preview reports are still available.');
        })
        .finally(() => { if (active) setIsInitialLoading(false); });
      return () => { active = false; };
    }
    const timer = window.setTimeout(() => setIsInitialLoading(false), 900);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(loadingPreviewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (activeTab !== 'map' || !viewport) return undefined;
    const updateFitZoom = () => {
      const { width, height } = viewport.getBoundingClientRect();
      const west = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_WEST, BASE_ZOOM).x;
      const east = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_EAST, BASE_ZOOM).x;
      const north = toWorldPixel(CAMPUS_NORTH, INITIAL_MAP_CENTER.lon, BASE_ZOOM).y;
      const south = toWorldPixel(CAMPUS_SOUTH, INITIAL_MAP_CENTER.lon, BASE_ZOOM).y;
      const fit = BASE_ZOOM + Math.log2(Math.min(width / (east - west), height / (south - north)));
      const nextMinZoom = Math.max(1, Math.min(MAX_ZOOM, Math.floor(fit * 4) / 4));
      setMapMinZoom(nextMinZoom);
      // Start one step inside the campus so users can immediately drag to explore.
      const nextZoom = Math.max(nextMinZoom + 1, Math.min(mapZoomRef.current, MAX_ZOOM));
      setMapZoom(nextZoom);
      setMapCenter(center => clampMapCenter(center, nextZoom, width, height));
    };
    updateFitZoom();
    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeTab]);

  const scheduleMapCenter = (center) => {
    pendingMapCenterRef.current = center;
    if (mapCenterFrameRef.current !== null) return;
    mapCenterFrameRef.current = requestAnimationFrame(() => {
      setMapCenter(pendingMapCenterRef.current);
      pendingMapCenterRef.current = null;
      mapCenterFrameRef.current = null;
    });
  };

  const flushMapCenter = () => {
    if (mapCenterFrameRef.current !== null) cancelAnimationFrame(mapCenterFrameRef.current);
    mapCenterFrameRef.current = null;
    if (pendingMapCenterRef.current) setMapCenter(pendingMapCenterRef.current);
    pendingMapCenterRef.current = null;
  };

  const moveMapCenter = (worldX, worldY) => {
    const next = fromWorldPixel(worldX, worldY, mapZoom);
    const bounds = mapViewportRef.current?.getBoundingClientRect();
    scheduleMapCenter(clampMapCenter(next, mapZoom, bounds?.width ?? 600, bounds?.height ?? 600));
  };

  const handleMapPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('[data-map-control], [data-map-marker]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerId !== undefined) activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size >= 2) {
      const [first, second] = [...activePointersRef.current.values()];
      pinchStartRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        zoom: mapZoom,
      };
      dragStartRef.current = null;
      setIsDraggingMap(true);
      return;
    }
    const centerPixel = toWorldPixel(mapCenter.lat, mapCenter.lon, mapZoom);
    dragStartRef.current = { x: event.clientX, y: event.clientY, centerPixel };
    setIsDraggingMap(true);
  };

  const handleMapPointerMove = (event) => {
    const pointer = event.pointerId !== undefined ? activePointersRef.current.get(event.pointerId) : null;
    if (pointer) activePointersRef.current.set(event.pointerId, { ...pointer, x: event.clientX, y: event.clientY });
    if (pinchStartRef.current && activePointersRef.current.size >= 2) {
      const [first, second] = [...activePointersRef.current.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const nextZoom = Math.max(mapMinZoom, Math.min(MAX_ZOOM, pinchStartRef.current.zoom + Math.log2(distance / Math.max(1, pinchStartRef.current.distance))));
      const bounds = mapViewportRef.current?.getBoundingClientRect();
      setMapZoom(nextZoom);
      setMapCenter(center => clampMapCenter(center, nextZoom, bounds?.width ?? 600, bounds?.height ?? 600));
      return;
    }
    if (!dragStartRef.current) return;
    moveMapCenter(
      dragStartRef.current.centerPixel.x - (event.clientX - dragStartRef.current.x),
      dragStartRef.current.centerPixel.y - (event.clientY - dragStartRef.current.y),
    );
  };

  const handleMapPointerUp = (event) => {
    if (event.pointerId !== undefined) activePointersRef.current.delete(event.pointerId);
    pinchStartRef.current = null;
    if (activePointersRef.current.size === 1) {
      const remaining = [...activePointersRef.current.values()][0];
      dragStartRef.current = { ...remaining, centerPixel: toWorldPixel(mapCenter.lat, mapCenter.lon, mapZoom) };
      setIsDraggingMap(true);
    } else {
      flushMapCenter();
      dragStartRef.current = null;
      setIsDraggingMap(false);
    }
  };

  const handleMapZoom = (delta) => {
    const nextZoom = Math.max(mapMinZoom, Math.min(MAX_ZOOM, mapZoom + delta));
    setMapZoom(nextZoom);
    const bounds = mapViewportRef.current?.getBoundingClientRect();
    setMapCenter(center => clampMapCenter(center, nextZoom, bounds?.width ?? 600, bounds?.height ?? 600));
  };

  const previewLoadingState = () => {
    window.clearTimeout(loadingPreviewTimerRef.current);
    setIsInitialLoading(true);
    loadingPreviewTimerRef.current = window.setTimeout(() => setIsInitialLoading(false), 1500);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                          item.description.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                          item.location.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
  });
  const sortedItems = [...filteredItems].sort((first, second) => {
    if (sortOrder === 'newest') return new Date(second.date) - new Date(first.date);
    if (sortOrder === 'oldest') return new Date(first.date) - new Date(second.date);

    const reference = locationFilter === 'All'
      ? INITIAL_MAP_CENTER
      : itemMapLatLon(locationMapPoint(locationFilter));
    const distance = item => ((item.lat - reference.lat) ** 2)
      + (((item.lng - reference.lon) * Math.cos(reference.lat * Math.PI / 180)) ** 2);
    const search = debouncedSearch.trim().toLowerCase();
    const relevance = item => search && item.title.toLowerCase().startsWith(search) ? 0 : 1;
    return relevance(first) - relevance(second) || distance(first) - distance(second);
  });
  const mapItems = filteredItems.filter(item =>
    item.status !== 'resolved' || !item.resolvedAt || mapClock - item.resolvedAt < 60_000
  );
  const handleLocationFilterChange = (location) => {
    setLocationFilter(location);
    setFocusedMapItem(null);
    setFocusedSearchId(null);
    if (location === 'All') {
      setMapCenter(INITIAL_MAP_CENTER);
      setMapZoom(mapMinZoom);
      return;
    }

    const reportedAtLocation = mapItems.find(item => item.location === location);
    const target = reportedAtLocation
      ? { lat: reportedAtLocation.lat, lon: reportedAtLocation.lng }
      : itemMapLatLon(locationMapPoint(location));
    const zoom = Math.min(MAX_ZOOM, Math.max(mapMinZoom + 2, BASE_ZOOM + 3));
    const bounds = mapViewportRef.current?.getBoundingClientRect();
    setMapCenter(clampMapCenter(target, zoom, bounds?.width ?? 600, bounds?.height ?? 600));
    setMapZoom(zoom);
  };
  const focusSearchResult = React.useCallback((item) => {
    const zoom = Math.min(MAX_ZOOM, mapMinZoom + 2);
    const bounds = mapViewportRef.current?.getBoundingClientRect();
    setMapCenter(clampMapCenter({ lat: item.lat, lon: item.lng }, zoom, bounds?.width ?? 600, bounds?.height ?? 600));
    setMapZoom(zoom);
    setFocusedSearchId(item.id);
    setFocusedMapItem(item);
  }, [mapMinZoom]);

  const handlePostItem = async (e) => {
    e.preventDefault();
    if (phoneError) {
      document.getElementById('report-phone')?.focus();
      return;
    }
    const coordinates = locationMapPoint(formData.location);
    try {
      const image = isSupabaseConfigured && formData.image
        ? await uploadReportImage(formData.image)
        : formData.image;
      let newItem = withMapFields({
        id: Date.now(),
        ...formData,
        phone: formData.phone ? `+91 ${formData.phone.replace(/\D/g, '')}` : '',
        name: formData.title,
        building: formData.location,
        coordinates,
        date: new Date().toISOString().split('T')[0],
        image,
      });
      if (isSupabaseConfigured) {
        const id = await createReport(newItem);
        newItem = { ...newItem, id };
      }
      setItems(current => [newItem, ...current]);
      setDatabaseError('');
    } catch (error) {
      console.error('Could not save the report:', error);
      setDatabaseError('Could not save this report. Check your database setup and try again.');
      return;
    }
    setIsReportModalOpen(false);
    setFormData({
      title: '', category: 'Electronics', location: 'SJT (Silver Jubilee Tower)',
      status: 'lost', description: '', image: '', floor: '', landmark: '', owner: '', phone: '', contact: '', shareContact: false, verifiedPin: '1234'
    });
    setSuccessBanner("Your item has been successfully shared with the VIT community!");
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setDatabaseError('Choose a JPG, PNG, or WEBP item photo.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDatabaseError('Item photos must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(current => ({ ...current, image: reader.result }));
      setDatabaseError('');
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyAndResolve = () => {
    if (enteredPin === selectedItem.verifiedPin || enteredPin === '1234') {
      const randomMsg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      const resolvedAt = Date.now();
      setItems(current => current.map(i => i.id === selectedItem.id ? { ...i, status: 'resolved', resolvedAt } : i));
      try {
        const resolved = readResolvedItems();
        resolved[selectedItem.id] = resolvedAt;
        localStorage.setItem(RESOLVED_ITEMS_KEY, JSON.stringify(resolved));
      } catch { /* Keep the in-memory resolution if storage is unavailable. */ }
      setMapClock(resolvedAt);
      setSelectedItem(null);
      setVerifyStep(false);
      setEnteredPin('');
      setVerifyError('');
      setSuccessBanner(randomMsg);
      setTimeout(() => setSuccessBanner(''), 6000);
    } else {
      setVerifyError('Incorrect verification PIN.');
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-200' : 'bg-zinc-50 text-zinc-800'}`}>
      
      {successBanner && (
        <div className="bg-emerald-600 text-white px-4 py-3 text-center font-medium shadow-md sticky top-0 z-50 flex items-center justify-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{successBanner}</span>
        </div>
      )}
      {databaseError && (
        <div role="alert" className="bg-rose-950 px-4 py-3 text-center text-sm font-medium text-rose-200">
          {databaseError}
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${darkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-zinc-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-800 text-cyan-400 shadow-lg shadow-cyan-500/20">
              <MapPin className="h-6 w-6" strokeWidth={2.2} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-cyan-500 text-zinc-950"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
                VIT Find &amp; Connect
              </h1>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                VIT Vellore &middot; Lost &amp; Found
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={darkMode}
              className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-zinc-800 border-zinc-700 text-amber-400' : 'bg-white border-zinc-200 text-zinc-700 shadow-sm'}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium px-4 py-2.5 rounded-xl shadow-md transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <Plus className="w-5 h-5" />
              <span>Report Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Search & Filters */}
        <div className={`p-5 rounded-2xl border shadow-sm mb-8 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            <div className="relative w-full md:w-80">
              <Search className={`absolute left-3.5 top-3.5 w-5 h-5 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <input 
                type="text"
                aria-label="Search lost and found items"
                placeholder="Search items, buildings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'}`}
              />
            </div>

            <div role="group" aria-label="Filter reports by status" className={`flex p-1 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'}`}>
              {['all', 'lost', 'found', 'resolved'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={statusFilter === status}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${statusFilter === status ? 'bg-cyan-500 text-zinc-950 shadow' : darkMode ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'}`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium focus:outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="All">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Stationery">Stationery</option>
                <option value="Keys">Keys</option>
                <option value="Accessories">Accessories</option>
                <option value="Personal">Personal</option>
              </select>

              <select
                aria-label="Filter by campus location"
                value={locationFilter}
                onChange={(e) => handleLocationFilterChange(e.target.value)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium focus:outline-none max-w-[160px] truncate ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="All">All Locations</option>
                {LOCATION_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</optgroup>)}
              </select>

              <select
                aria-label="Sort reports"
                value={sortOrder}
                onChange={event => setSortOrder(event.target.value)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium focus:outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="nearest">Nearest / most relevant</option>
              </select>

              <button
                type="button"
                onClick={previewLoadingState}
                disabled={isInitialLoading}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition disabled:cursor-wait ${darkMode ? 'border-zinc-700 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300 disabled:text-zinc-500' : 'border-zinc-200 text-zinc-700 hover:border-cyan-500 hover:text-cyan-700 disabled:text-zinc-400'}`}
              >
                {isInitialLoading ? 'Loading…' : 'Preview loading state'}
              </button>

              <div className={`flex p-1 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'}`}>
                <button
                  onClick={() => setActiveTab('grid')}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'grid' ? 'bg-cyan-500 text-zinc-950 shadow' : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'}`}
                  title="Grid View"
                  aria-label="Show item cards"
                  aria-pressed={activeTab === 'grid'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className={`p-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'map' ? 'bg-cyan-500 text-zinc-950 shadow' : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'}`}
                  title="Campus map view"
                  aria-label="Show campus map"
                  aria-pressed={activeTab === 'map'}
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Grid View */}
        {activeTab === 'grid' && (
          <div>
            {isInitialLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading item reports" aria-busy="true">
                {Array.from({ length: 6 }, (_, index) => <div key={index} className={`animate-pulse overflow-hidden rounded-2xl border ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                  <div className={darkMode ? 'h-48 bg-zinc-800' : 'h-48 bg-zinc-200'} />
                  <div className="space-y-3 p-5"><div className={`h-4 w-3/5 rounded ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`} /><div className={`h-3 w-full rounded ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`} /><div className={`h-3 w-2/3 rounded ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`} /><div className={`mt-5 h-8 rounded ${darkMode ? 'bg-zinc-800' : 'bg-zinc-200'}`} /></div>
                </div>)}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={`text-center py-20 rounded-3xl border ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-zinc-400" />
              <h2 className="text-lg font-semibold">No items found</h2>
                <p className={`text-sm mt-1 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Try adjusting your filters or search keywords.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedItems.map((item) => (
                  <div 
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${item.title}, ${item.status} item at ${item.location}`}
                    onClick={() => { setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); }}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); } }}
                    className={`group rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.12)] cursor-pointer flex flex-col justify-between ${darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-cyan-500/50' : 'bg-white border-zinc-200 hover:border-cyan-300'}`}
                  >
                    <div>
                      {item.image && <div className="relative h-48 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-3 left-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-zinc-950 shadow ${
                            item.status === 'lost' ? 'bg-rose-500' : item.status === 'found' ? 'bg-emerald-500' : 'bg-zinc-600'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/60 text-white backdrop-blur-md">{item.category}</span>
                        </div>
                      </div>}

                      <div className="p-5">
                        {!item.image && <div className="mb-3 flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-950 ${item.status === 'lost' ? 'bg-rose-500' : item.status === 'found' ? 'bg-emerald-500' : 'bg-zinc-400'}`}>{item.status}</span>
                          <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${darkMode ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>{item.category}</span>
                        </div>}
                        <h2 className="font-bold text-base mb-1 group-hover:text-cyan-500 transition-colors line-clamp-1">
                          {item.title}
                        </h2>
                        <p className={`text-xs line-clamp-2 mb-4 ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {item.description}
                        </p>

                        <div className={`space-y-2 text-xs pt-3 border-t ${darkMode ? 'border-zinc-800 text-zinc-400' : 'border-zinc-100 text-zinc-600'}`}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-cyan-500 shrink-0" />
                            <span className="truncate font-medium">{item.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                            <span>Reported on {item.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`px-5 py-3.5 border-t flex items-center justify-between text-xs font-medium ${darkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-100 bg-zinc-50'}`}>
                      <span className={darkMode ? 'text-zinc-400' : 'text-zinc-600'}>Reporter identity kept private</span>
                      <span className="text-cyan-700 dark:text-cyan-400 flex items-center gap-1 group-hover:underline">
                        View Details & Claim <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campus map */}
        {activeTab === 'map' && (
          <div className={`overflow-hidden rounded-3xl border shadow-xl ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-cyan-700"><Navigation className="h-5 w-5" /></span>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">VIT Vellore &middot; Lost &amp; Found</h2>
              </div>
              <span className="hidden rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 sm:inline-flex">{mapItems.length} matching reports</span>
            </div>

            {(() => {
              const centerPixel = toWorldPixel(mapCenter.lat, mapCenter.lon, mapZoom);
              // Fetch the next sharper integer tile level and scale it down at fractional fit zooms.
              const tileZoom = Math.min(MAX_ZOOM, Math.ceil(mapZoom));
              const tileSize = 256 * (2 ** (mapZoom - tileZoom));
              const tileBaseX = Math.floor(centerPixel.x / tileSize);
              const tileBaseY = Math.floor(centerPixel.y / tileSize);
              const tileCount = 2 ** tileZoom;
              const viewport = mapViewportRef.current;
              const viewportWidth = viewport?.clientWidth ?? 600;
              const viewportHeight = viewport?.clientHeight ?? 600;
              const campusWest = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_WEST, mapZoom).x;
              const campusEast = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_EAST, mapZoom).x;
              const campusNorth = toWorldPixel(CAMPUS_NORTH, INITIAL_MAP_CENTER.lon, mapZoom).y;
              const campusSouth = toWorldPixel(CAMPUS_SOUTH, INITIAL_MAP_CENTER.lon, mapZoom).y;
              const cropTop = Math.max(0, viewportHeight / 2 + campusNorth - centerPixel.y);
              const cropRight = Math.max(0, viewportWidth / 2 - (campusEast - centerPixel.x));
              const cropBottom = Math.max(0, viewportHeight / 2 - (campusSouth - centerPixel.y));
              const cropLeft = Math.max(0, viewportWidth / 2 + campusWest - centerPixel.x);
              const campusClip = `inset(${cropTop}px ${cropRight}px ${cropBottom}px ${cropLeft}px)`;
              const xOffsets = Array.from({ length: 7 }, (_, index) => index - 3);
              const yOffsets = Array.from({ length: 5 }, (_, index) => index - 2);
              const tiles = yOffsets.flatMap(offsetY => xOffsets.map(offsetX => {
                const rawX = tileBaseX + offsetX;
                const tileX = ((rawX % tileCount) + tileCount) % tileCount;
                const tileY = Math.max(0, Math.min(tileCount - 1, tileBaseY + offsetY));
                return {
                  key: `${offsetX}-${offsetY}`,
                  x: rawX * tileSize - centerPixel.x,
                  y: (tileBaseY + offsetY) * tileSize - centerPixel.y,
                  url: `https://tile.openstreetmap.org/${tileZoom}/${tileX}/${tileY}.png`,
                };
              }));
              return <div
                ref={mapViewportRef}
                onPointerDown={handleMapPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerUp={handleMapPointerUp}
                onPointerCancel={handleMapPointerUp}
                onMouseDown={handleMapPointerDown}
                onMouseMove={handleMapPointerMove}
                onMouseUp={handleMapPointerUp}
                onKeyDown={event => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === '+' || event.key === '=') { event.preventDefault(); handleMapZoom(1); }
                  if (event.key === '-' || event.key === '_') { event.preventDefault(); handleMapZoom(-1); }
                }}
                tabIndex={0}
                aria-label="Interactive VIT campus map. Drag to pan after zooming in. Use plus and minus keys to zoom."
                style={{ aspectRatio: `${CAMPUS_ASPECT_RATIO} / 1` }}
                className={`relative mx-auto w-full max-w-[900px] touch-none overflow-hidden bg-[#e8eef0] outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${isDraggingMap ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <div className="absolute inset-0" style={{ clipPath: campusClip }}>
                {tiles.map(tile => <img key={tile.key} draggable="false" decoding="async" src={tile.url} alt="" className="pointer-events-none absolute max-w-none select-none" style={{ width: `${tileSize}px`, height: `${tileSize}px`, left: `calc(50% + ${tile.x}px)`, top: `calc(50% + ${tile.y}px)`, transition: isDraggingMap ? 'none' : `left ${FLY_MS}ms ease-out, top ${FLY_MS}ms ease-out, width ${FLY_MS}ms ease-out, height ${FLY_MS}ms ease-out` }} />)}
                </div>

                <MapSearch items={mapItems} value={searchTerm} onChange={value => { setSearchTerm(value); setFocusedSearchId(null); }} onSelectItem={focusSearchResult} />

                <div className={`absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl shadow-lg ring-1 ${darkMode ? 'bg-zinc-900 ring-zinc-700' : 'bg-white ring-black/5'}`} data-map-control>
                  <button type="button" aria-label="Zoom in" title="Zoom in" disabled={mapZoom >= MAX_ZOOM} onPointerDown={event => event.stopPropagation()} onClick={() => handleMapZoom(1)} className={`p-3 transition ${darkMode ? 'text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600' : 'text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-300'}`}><ZoomIn className="h-5 w-5" /></button>
                  <span className={`border-y py-1 text-center text-[10px] font-medium ${darkMode ? 'border-zinc-700 text-zinc-400' : 'border-zinc-100 text-zinc-600'}`}>z{mapZoom}</span>
                  <button type="button" aria-label="Zoom out" title="Zoom out" disabled={mapZoom <= mapMinZoom} onPointerDown={event => event.stopPropagation()} onClick={() => handleMapZoom(-1)} className={`p-3 transition ${darkMode ? 'text-zinc-200 hover:bg-zinc-800 disabled:text-zinc-600' : 'text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-300'}`}><ZoomOut className="h-5 w-5" /></button>
                   <button type="button" aria-label="Show full campus" title="Show full campus" onPointerDown={event => event.stopPropagation()} onClick={() => { setMapZoom(mapMinZoom); setMapCenter(INITIAL_MAP_CENTER); setSearchTerm(''); setFocusedSearchId(null); setFocusedMapItem(null); }} className={`border-t p-3 transition ${darkMode ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-100 text-zinc-700 hover:bg-zinc-50'}`}><Compass className="h-5 w-5" /></button>
                </div>

                <div className="absolute inset-0" style={{ clipPath: campusClip }}>
                {mapItems.map((item, markerIndex) => {
                  const position = toWorldPixel(item.lat, item.lng, mapZoom);
                  const samePlaceItems = mapItems.filter(candidate => candidate.location === item.location);
                  const samePlaceIndex = samePlaceItems.findIndex(candidate => candidate.id === item.id);
                  const spread = markerSpreadOffset(samePlaceIndex, samePlaceItems.length);
                  const left = position.x - centerPixel.x + spread.x;
                  const top = position.y - centerPixel.y + spread.y;
                  const fields = getMapItemFields(item);
                  return <div key={item.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, transition: isDraggingMap ? 'none' : `left ${FLY_MS}ms ease-out, top ${FLY_MS}ms ease-out` }}>
                    <button type="button" data-map-marker onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={() => setFocusedMapItem(item)} style={{ animationDelay: `${(markerIndex % 8) * 110}ms` }} className={`group flex h-9 w-9 animate-marker-float items-center justify-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-lg transition group-hover:scale-110 ${focusedSearchId === item.id ? 'ring-4 ring-cyan-300 ring-offset-2' : ''} ${item.status === 'resolved' ? 'bg-zinc-600' : item.status === 'lost' ? 'bg-rose-600' : 'bg-emerald-600'}`} aria-label={`Show ${fields.name} on map, report ${samePlaceIndex + 1} of ${samePlaceItems.length} at ${fields.building}`}>
                      {item.status === 'lost' ? '!' : <Check className="h-4 w-4" />}
                    </button>
                    {focusedMapItem?.id === item.id && <div data-map-control className={`absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-xl p-4 text-left shadow-xl ring-1 ${darkMode ? 'bg-zinc-900 text-zinc-100 ring-zinc-700' : 'bg-white text-zinc-800 ring-black/10'}`}>
                      <button type="button" aria-label="Close map popup" onClick={() => setFocusedMapItem(null)} className={`absolute right-2 top-2 rounded p-1 ${darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100'}`}><X className="h-4 w-4" /></button>
                      <p className="pr-6 text-sm font-bold">{fields.name}</p>
                      <p className={`mt-2 text-xs ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>{fields.building}</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>Floor: {fields.floor}</p>
                      {fields.landmark && <p className={`mt-1 text-xs ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>Near {fields.landmark}</p>}
                      <button type="button" onClick={() => { setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); }} className="mt-3 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-400">View report</button>
                    </div>}
                  </div>;
                })}
                {mapItems.length === 0 && <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center">
                  <p className={`mx-auto inline-block rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${darkMode ? 'bg-zinc-900/95 text-zinc-200' : 'bg-white/95 text-zinc-700'}`}>
                    No items match the selected filters{locationFilter !== 'All' ? ` at ${locationFilter}` : ''}.
                  </p>
                </div>}
                </div>

                <div className={`absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-xl px-4 py-3 text-xs font-medium shadow-lg ${darkMode ? 'bg-zinc-900/95 text-zinc-200' : 'bg-white/95 text-zinc-700'}`} data-map-control>
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-600" />Lost</span>
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Found</span>
                  <span className={darkMode ? 'text-zinc-400' : 'text-zinc-600'}>Drag the map to explore. Zoom in to pan; use the controls to zoom.</span>
                </div>
                <div className={`absolute bottom-2 right-2 z-10 rounded px-2 py-1 text-[10px] ${darkMode ? 'bg-zinc-900/90 text-zinc-300' : 'bg-white/90 text-zinc-600'}`}>&copy; OpenStreetMap contributors</div>
              </div>;
            })()}
          </div>
        )}
      </main>
      {/* Details & Verification Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="selected-item-title" className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-100 text-zinc-800'}`}>
            
            {selectedItem.image && <div className="relative h-56 bg-zinc-100 dark:bg-zinc-800 shrink-0">
              <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-full object-cover" />
              <button 
                onClick={() => { setSelectedItem(null); setVerifyStep(false); }}
                aria-label="Close item details"
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-zinc-950 ${selectedItem.status === 'lost' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                  {selectedItem.status} item
                </span>
              </div>
            </div>}
            {!selectedItem.image && <button type="button" onClick={() => { setSelectedItem(null); setVerifyStep(false); }} aria-label="Close item details" className="absolute right-5 top-5 rounded-full bg-zinc-800 p-2 text-white hover:bg-zinc-700"><X className="h-5 w-5" /></button>}

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-xs font-semibold text-cyan-500 uppercase tracking-wide">{selectedItem.category}</span>
                <h2 id="selected-item-title" className="text-xl font-bold mt-0.5">{selectedItem.title}</h2>
                <p className={`text-sm mt-2 leading-relaxed ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {selectedItem.description}
                </p>
              </div>

              <div className={`grid grid-cols-2 gap-3 p-4 rounded-2xl border ${darkMode ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold block">Location</span>
                  <span className="text-sm font-medium flex items-center gap-1.5 mt-0.5 truncate">
                    <MapPin className="w-4 h-4 text-cyan-500 shrink-0" />
                    {selectedItem.location}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold block">Report Date</span>
                  <span className="text-sm font-medium flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                    {selectedItem.date}
                  </span>
                </div>
              </div>

              {!verifyStep ? (
                <div className="space-y-3 pt-2">
                  <div className={`p-4 rounded-2xl border space-y-2 ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-cyan-50/60 border-cyan-100'}`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> {selectedItem.shareContact ? 'Contact details' : 'Private handover'}
                    </h3>
                    {selectedItem.shareContact && (selectedItem.owner || selectedItem.phone || selectedItem.contact) ? <div className="pt-1 space-y-1 text-sm">
                      {selectedItem.owner && <p>{selectedItem.owner}</p>}
                      {selectedItem.phone && <p><a className="text-cyan-700 hover:underline dark:text-cyan-400" href={`tel:${selectedItem.phone}`}>{selectedItem.phone}</a></p>}
                      {selectedItem.contact && <p><a className="text-cyan-700 hover:underline dark:text-cyan-400" href={`mailto:${selectedItem.contact}`}>{selectedItem.contact}</a></p>}
                    </div> : <p className="pt-1 text-sm leading-relaxed">The reporter chose not to share contact details. Arrange an in-person handover at the campus security or lost-and-found desk.</p>}
                  </div>

                  {selectedItem.status !== 'resolved' && (
                    <button 
                      onClick={() => setVerifyStep(true)}
                      className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Claim / Resolve Item (Double Verification)</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className={`p-5 rounded-2xl border space-y-4 ${darkMode ? 'bg-zinc-800 border-cyan-900' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> Security Verification PIN Required
                    </h3>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      Enter the 4-digit verification PIN. Use <strong className="text-cyan-500">4821</strong> or <strong className="text-cyan-500">1234</strong>.
                    </p>
                  </div>

                  <input 
                    type="password"
                    maxLength="4"
                    placeholder="Enter PIN"
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    className={`w-full text-center tracking-widest text-lg font-bold py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${darkMode ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-amber-300 text-zinc-800'}`}
                  />

                  {verifyError && (
                    <p className="text-xs text-rose-500 font-medium text-center">{verifyError}</p>
                  )}

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setVerifyStep(false)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${darkMode ? 'border-zinc-700 text-zinc-300' : 'border-zinc-300 text-zinc-700'}`}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleVerifyAndResolve}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow"
                    >
                      Confirm Handover
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="report-modal-title" className={`w-full max-w-xl rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-100 text-zinc-800'}`}>
            
            <div className="p-5 border-b flex items-center justify-between">
              <h2 id="report-modal-title" className="font-bold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-500" /> Report Lost or Found Item
              </h2>
              <button onClick={() => setIsReportModalOpen(false)} aria-label="Close report form" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostItem} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="report-status" className="block text-xs font-semibold uppercase tracking-wider mb-1">Status Type</label>
                  <select 
                    id="report-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={`w-full p-3 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`}
                  >
                    <option value="lost">Lost Item</option>
                    <option value="found">Found Item</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="report-category" className="block text-xs font-semibold uppercase tracking-wider mb-1">Category</label>
                  <select 
                    id="report-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full p-3 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`}
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Keys">Keys</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="report-title" className="block text-xs font-semibold uppercase tracking-wider mb-1">Item Title</label>
                <input 
                  id="report-title"
                  type="text"
                  required
                  placeholder="e.g. Casio Scientific Calculator"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full p-3 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`}
                />
              </div>

              <div>
                  <label htmlFor="report-location" className="block text-xs font-semibold uppercase tracking-wider mb-1">VIT Location</label>
                  <select 
                    id="report-location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`w-full p-3 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`}
                  >
                    {LOCATION_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</optgroup>)}
                  </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wider">Floor (optional)
                  <input value={formData.floor} onChange={event => setFormData({ ...formData, floor: event.target.value })} placeholder="e.g. 2nd floor" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal normal-case tracking-normal ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider">Nearby landmark (optional)
                  <input value={formData.landmark} onChange={event => setFormData({ ...formData, landmark: event.target.value })} placeholder="e.g. near the library" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal normal-case tracking-normal ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`} />
                </label>
              </div>

              <p className={`rounded-xl border p-3 text-xs leading-relaxed ${darkMode ? 'border-cyan-900 bg-cyan-950/50 text-cyan-200' : 'border-cyan-100 bg-cyan-50 text-cyan-800'}`}>Avoid personal details in photos. {isSupabaseConfigured ? 'Reports and uploaded photos are saved to the campus database; contact details are visible only when you choose to share them.' : 'This preview keeps reports in this browser session. Connect the database to share reports across devices.'}</p>

              <section className={`space-y-3 rounded-xl border p-4 ${darkMode ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-200 bg-zinc-50'}`}>
                <div><h3 className="text-sm font-semibold">Contact details <span className={darkMode ? 'font-normal text-zinc-400' : 'font-normal text-zinc-600'}>(optional)</span></h3><p className={`mt-1 text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>These stay private unless you choose to share them on the report.</p></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Name<input autoComplete="name" value={formData.owner} onChange={event => setFormData({ ...formData, owner: event.target.value })} placeholder="Your name" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal ${darkMode ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} /></label>
                  <label className="text-xs font-semibold" htmlFor="report-phone">Phone<span className={`mt-1 flex items-center overflow-hidden rounded-xl border ${phoneError ? 'border-rose-500' : darkMode ? 'border-zinc-700' : 'border-zinc-200'}`}><span className={`border-r px-3 py-3 text-sm ${darkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>+91</span><input id="report-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} aria-invalid={Boolean(phoneError)} aria-describedby="report-phone-hint" value={formData.phone} onChange={event => setFormData({ ...formData, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit number" className={`min-w-0 flex-1 bg-transparent p-3 text-sm font-normal outline-none ${darkMode ? 'text-white' : 'text-zinc-900'}`} /></span></label>
                  <p id="report-phone-hint" aria-live="polite" className={`text-xs ${phoneError ? 'text-rose-600 dark:text-rose-400' : darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>{phoneError || 'Enter exactly 10 digits. The +91 country code is added automatically.'}</p>
                  <label className="text-xs font-semibold sm:col-span-2">Email<input type="email" autoComplete="email" value={formData.contact} onChange={event => setFormData({ ...formData, contact: event.target.value })} placeholder="name@example.com" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal ${darkMode ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} /></label>
                </div>
                <label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={formData.shareContact} onChange={event => setFormData({ ...formData, shareContact: event.target.checked })} className="mt-0.5 accent-cyan-600" /><span>Show these contact details to people viewing this report</span></label>
              </section>

              <div>
                <label htmlFor="report-item-image" className="mb-1 block text-xs font-semibold uppercase tracking-wider">Item photo (optional)</label>
                <div className={`flex items-center gap-3 rounded-xl border border-dashed p-3 ${darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-300 bg-zinc-50'}`}>
                  {formData.image ? <img src={formData.image} alt="Selected item preview" className="h-16 w-16 rounded-lg object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><Plus className="h-6 w-6" /></span>}
                  <div className="flex-1"><label htmlFor="report-item-image" className="cursor-pointer text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400">{formData.image ? 'Change photo' : 'Choose a photo'}</label><p className={`mt-1 text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>JPG, PNG or WEBP</p></div>
                  {formData.image && <button type="button" onClick={() => setFormData({ ...formData, image: '' })} className="text-xs font-medium text-rose-500 hover:underline">Remove</button>}
                </div>
                <input id="report-item-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="sr-only" />
              </div>

              <div>
                <label htmlFor="report-description" className="block text-xs font-semibold uppercase tracking-wider mb-1">Detailed Description</label>
                  <textarea 
                  id="report-description"
                  rows="3"
                  required
                  placeholder="Describe color and distinguishing features. Avoid personal details or exact private locations."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full p-3 rounded-xl border text-sm ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`}
                ></textarea>
              </div>

              <button 
                type="submit"
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold shadow-md transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                Publish Report
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
