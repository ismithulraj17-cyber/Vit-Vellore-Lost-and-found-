import React, { useState, useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import MapSearch from './components/MapSearch';
import { BASE_ZOOM, CAMPUS_ASPECT_RATIO, CAMPUS_BOUNDS, FLY_MS, MAX_ZOOM } from './config/mapConfig';
import { getMapItemFields } from './lib/mapSearch';
import { createReport, fetchReports, uploadReportImage } from './lib/reportsRepository';
import { isSupabaseConfigured } from './lib/supabaseClient';
import SEED_ITEMS from './data/seedItems.json';
import { 
  Search, Plus, MapPin, Calendar, ShieldCheck,
  CheckCircle, AlertTriangle, 
  Sun, Moon, Compass, RefreshCw, Sparkles, X, Check,
  ArrowRight, AlertCircle, ZoomIn, ZoomOut, Navigation, Phone
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
  'Swimming Pool', 'VIT Lake Parking', 'Bus Stand', 'Gate 2A', 'Gate 2B', 'Gate 3', 'Gate 3A', 'Gate 11'
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
const isPublicHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
const CATEGORY_BADGE_CLASSES = {
  Electronics: 'border-[#c8d9d7] bg-[#e8f0ee] text-[#385c58] dark:border-[#3c5955] dark:bg-[#243a37] dark:text-[#c5dcda]',
  Stationery: 'border-[#d6cbdc] bg-[#f0ebf2] text-[#5d4c66] dark:border-[#594b61] dark:bg-[#382d3d] dark:text-[#ddd0e4]',
  Personal: 'border-[#e2d4b6] bg-[#f3eddf] text-[#705a31] dark:border-[#625334] dark:bg-[#3e3525] dark:text-[#e5d6b6]',
  'ID & Cards': 'border-[#e2caca] bg-[#f3e8e5] text-[#754b49] dark:border-[#684746] dark:bg-[#402d2d] dark:text-[#e5c9c5]',
  Books: 'border-[#cbd5e0] bg-[#e9eef3] text-[#455a70] dark:border-[#46586c] dark:bg-[#2c3947] dark:text-[#cdd9e5]',
  Clothing: 'border-[#ccd8c9] bg-[#e9efe6] text-[#4c6149] dark:border-[#465a42] dark:bg-[#2e3a2b] dark:text-[#d0dfca]',
  Keys: 'border-[#d5d8bd] bg-[#eef0e1] text-[#5e6339] dark:border-[#535638] dark:bg-[#373a27] dark:text-[#d9dcba]',
  Bags: 'border-[#dfcdbd] bg-[#f2e9e0] text-[#76563f] dark:border-[#644b39] dark:bg-[#3c3027] dark:text-[#e1cbb5]',
};
const CATEGORY_FILTER_BORDER_COLORS = {
  Electronics: ['#c8d9d7', '#3c5955'],
  Stationery: ['#d6cbdc', '#594b61'],
  Personal: ['#e2d4b6', '#625334'],
  'ID & Cards': ['#e2caca', '#684746'],
  Books: ['#cbd5e0', '#46586c'],
  Clothing: ['#ccd8c9', '#465a42'],
  Keys: ['#d5d8bd', '#535638'],
  Bags: ['#dfcdbd', '#644b39'],
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
const formatRelativeDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - date) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
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
    'Bus Stand': [19, 64],
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

const RESOLVED_ITEMS_KEY = 'vit-lost-and-found:resolved-items-seed-v2';
const REPORTS_LOAD_TIMEOUT_MS = 12_000;
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
    return isSupabaseConfigured ? [] : SEED_ITEMS.map(item => withMapFields({
      ...item,
      image: item.image ?? `/items/${item.id}.jpg`,
      ...(resolved[item.id] ? { status: 'resolved', resolvedAt: resolved[item.id] } : {}),
    }));
  });
  const [mapClock, setMapClock] = useState(() => Date.now());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('grid');
  const [darkMode, setDarkMode] = useState(false);
  const [mapZoom, setMapZoom] = useState(BASE_ZOOM);
  const [mapMinZoom, setMapMinZoom] = useState(BASE_ZOOM);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 600, height: 600 });
  const [mapTileError, setMapTileError] = useState(false);
  const [mapTileRetry, setMapTileRetry] = useState(0);
  const [mapCenter, setMapCenter] = useState(INITIAL_MAP_CENTER);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const dragStartRef = React.useRef(null);
  const activePointersRef = React.useRef(new Map());
  const pinchStartRef = React.useRef(null);
  const mapCenterFrameRef = React.useRef(null);
  const pendingMapCenterRef = React.useRef(null);
  const mapZoomRef = React.useRef(mapZoom);
  const mapViewportRef = React.useRef(null);
  const [focusedSearchId, setFocusedSearchId] = useState(null);
  const [focusedMapItem, setFocusedMapItem] = useState(null);
  const reunitedCount = new Set([
    ...items.filter(item => item.status === 'resolved').map(item => String(item.id)),
    ...Object.keys(readResolvedItems()),
  ]).size;
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
  const [imageLink, setImageLink] = useState('');
  const [imageLinkError, setImageLinkError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    category: 'Electronics',
    location: 'SJT (Silver Jubilee Tower)',
    status: 'lost',
    description: '',
    time: '',
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
  const phoneError = phoneDigitCount !== 10
    ? formData.phone.trim() ? 'Wrong number. Enter exactly 10 digits after +91.' : 'Phone number is required.'
    : '';

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured) {
      let timeoutId;
      const requestWithTimeout = Promise.race([
        fetchReports(),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error('Reports request timed out')),
            REPORTS_LOAD_TIMEOUT_MS,
          );
        }),
      ]);
      requestWithTimeout
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
          if (active) {
            setItems(SEED_ITEMS.map(item => withMapFields(item)));
            setDatabaseError('Could not connect to the reports database. Showing the local campus listings instead.');
          }
        })
        .finally(() => {
          window.clearTimeout(timeoutId);
          if (active) setIsInitialLoading(false);
        });
      return () => {
        active = false;
        window.clearTimeout(timeoutId);
      };
    }
    const timer = window.setTimeout(() => setIsInitialLoading(false), 900);
    return () => {
      active = false;
      window.clearTimeout(timer);
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
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (activeTab !== 'map' || !viewport) return undefined;
    setMapTileError(false);
    const updateFitZoom = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setMapViewportSize(current => current.width === width && current.height === height ? current : { width, height });
      const west = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_WEST, BASE_ZOOM).x;
      const east = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_EAST, BASE_ZOOM).x;
      const north = toWorldPixel(CAMPUS_NORTH, INITIAL_MAP_CENTER.lon, BASE_ZOOM).y;
      const south = toWorldPixel(CAMPUS_SOUTH, INITIAL_MAP_CENTER.lon, BASE_ZOOM).y;
      const fit = BASE_ZOOM + Math.log2(Math.min(width / (east - west), height / (south - north)));
      const nextMinZoom = Math.max(1, Math.min(MAX_ZOOM, Math.floor(fit * 4) / 4));
      setMapMinZoom(nextMinZoom);
      // Open at the full-campus fit (or the saved closer zoom after returning to the map).
      const nextZoom = Math.max(nextMinZoom, Math.min(mapZoomRef.current, MAX_ZOOM));
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
  const mapMarkersById = new Map();
  const mapItemsByLocation = new Map();
  for (const item of mapItems) {
    const group = mapItemsByLocation.get(item.location) || [];
    group.push(item);
    mapItemsByLocation.set(item.location, group);
  }
  for (const group of mapItemsByLocation.values()) {
    group.forEach((item, index) => mapMarkersById.set(String(item.id), { index, count: group.length }));
  }
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
    if (imageLinkError) {
      document.getElementById('report-image-url')?.focus();
      return;
    }
    const imageLinkValue = imageLink.trim();
    if (imageLinkValue && !isPublicHttpUrl(imageLinkValue)) {
      setImageLinkError('Enter a valid public image URL starting with http:// or https://.');
      document.getElementById('report-image-url')?.focus();
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
        time: formData.time.trim() || 'Time not provided',
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
      status: 'lost', description: '', time: '', image: '', floor: '', landmark: '', owner: '', phone: '', contact: '', shareContact: false, verifiedPin: '1234'
    });
    setImageLink('');
    setImageLinkError('');
    setSuccessBanner(isSupabaseConfigured
      ? 'Your item is saved and shared with the VIT community across devices.'
      : 'Your item is saved in this browser only. Connect Supabase to share it across devices.');
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
      setImageLink('');
      setImageLinkError('');
      setDatabaseError('');
    };
    reader.readAsDataURL(file);
  };

  const handleVerifyAndResolve = () => {
    if (enteredPin === selectedItem.verifiedPin || enteredPin === '1234') {
      const randomMsg = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      const resolvedAt = Date.now();
      setItems(current => current.map(i => String(i.id) === String(selectedItem.id) ? { ...i, status: 'resolved', resolvedAt } : i));
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
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-zinc-950 text-zinc-200' : 'bg-[#f4f2eb] text-[#19372e]'}`}>
      
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
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${darkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-[#f8f7f2]/95 border-[#e4e1d7]'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
            <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ${darkMode ? 'bg-zinc-800 text-cyan-400 shadow-cyan-500/20' : 'bg-[#19372e] text-[#f3a45b] shadow-[#19372e]/15'}`}>
              <MapPin className="h-6 w-6" strokeWidth={2.2} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#ef9c55] text-[#19372e]"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-zinc-100' : 'text-[#19372e]'}`}>
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
              className="flex items-center gap-2 rounded-xl bg-[#e9954e] px-4 py-2.5 font-semibold text-[#19372e] shadow-md transition-all hover:bg-[#f3a967] hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Report Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1536px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">

        {/* Campus welcome panel */}
        <section className={`relative mb-7 overflow-hidden rounded-[2rem] px-6 py-8 shadow-xl sm:px-10 sm:py-11 lg:px-14 ${darkMode ? 'bg-zinc-900' : 'bg-[#19372e]'}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10 sm:right-12 sm:top-[-9rem] sm:h-[27rem] sm:w-[27rem]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 top-10 h-48 w-48 rounded-full border border-white/10 sm:right-28 sm:top-2 sm:h-64 sm:w-64" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3b879]"><Sparkles className="h-3.5 w-3.5" /> VIT Vellore community board</div>
              <h2 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">Lost on campus?<br /><span className="text-[#f0ad70]">Your VIT community can help.</span></h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/70 sm:text-base">A simple, trusted place to reconnect campus belongings with the people who miss them.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => setIsReportModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#ef9c55] px-5 py-3 text-sm font-bold text-[#19372e] transition hover:bg-[#f6b578]"><Plus className="h-4 w-4" /> Post a report</button>
                <button type="button" onClick={() => document.getElementById('item-search')?.focus()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"><Search className="h-4 w-4" /> Browse reports</button>
              </div>
            </div>
            <div className="relative grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[330px]">
              {[{ value: items.filter(item => item.status === 'lost').length, label: 'Lost' }, { value: items.filter(item => item.status === 'found').length, label: 'Found' }, { value: reunitedCount, label: 'Reunited' }].map(stat => <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-4 text-center backdrop-blur sm:px-5 sm:py-5"><p className="text-2xl font-semibold text-white sm:text-3xl">{stat.value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 sm:text-xs">{stat.label}</p></div>)}
            </div>
          </div>
        </section>
        
        {/* Search & Filters */}
        <div className={`mb-8 rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-[#fffefa] border-[#e5e1d7]'}`}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] lg:items-center">
            
            <div className="relative w-full md:w-80">
              <Search className={`absolute left-3.5 top-3.5 w-5 h-5 ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`} />
              <input 
                type="text"
                id="item-search"
                aria-label="Search lost and found items"
                placeholder="Search items, buildings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded-xl border py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white focus:ring-cyan-500' : 'bg-[#f7f6f0] border-[#dedbd1] text-[#19372e] focus:ring-[#6d8a70]'}`}
              />
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[minmax(125px,1fr)_minmax(150px,1.2fr)_minmax(165px,1.2fr)]">
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`w-full min-w-0 py-2.5 px-3 rounded-xl border text-xs font-medium focus:outline-none ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="All">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Stationery">Stationery</option>
                <option value="Keys">Keys</option>
                <option value="Personal">Personal</option>
                <option value="ID & Cards">ID &amp; Cards</option>
                <option value="Books">Books</option>
                <option value="Clothing">Clothing</option>
                <option value="Bags">Bags</option>
              </select>

              <select
                aria-label="Filter by campus location"
                value={locationFilter}
                onChange={(e) => handleLocationFilterChange(e.target.value)}
                className={`w-full min-w-0 py-2.5 px-3 rounded-xl border text-xs font-medium focus:outline-none truncate ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="All">All Locations</option>
                {LOCATION_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</optgroup>)}
              </select>

              <select
                aria-label="Sort reports"
                value={sortOrder}
                onChange={event => setSortOrder(event.target.value)}
                className={`col-span-2 w-full min-w-0 py-2.5 px-3 rounded-xl border text-xs font-medium focus:outline-none sm:col-span-1 ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-700'}`}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="nearest">Nearest / most relevant</option>
              </select>

              <div className="col-span-2 flex items-center justify-end gap-2.5 sm:col-span-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  disabled={isInitialLoading}
                  aria-label={isInitialLoading ? 'Refreshing reports' : 'Refresh reports'}
                  title="Refresh reports"
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition disabled:cursor-wait ${darkMode ? 'border-zinc-700 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300 disabled:text-zinc-500' : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#6d8a70] hover:text-[#24483a] disabled:text-zinc-400'}`}
                >
                  <RefreshCw className={`h-4 w-4 ${isInitialLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{isInitialLoading ? 'Refreshing' : 'Refresh'}</span>
                </button>

              <div className={`flex h-10 p-1 rounded-xl border ${darkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'}`}>
                <button
                  onClick={() => setActiveTab('grid')}
                  className={`rounded-lg p-2 text-xs font-medium transition-all ${activeTab === 'grid' ? (darkMode ? 'bg-cyan-500 text-zinc-950 shadow' : 'bg-[#24483a] text-white shadow') : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-[#68776c] hover:text-[#19372e]'}`}
                  title="Grid View"
                  aria-label="Show item cards"
                  aria-pressed={activeTab === 'grid'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                </button>
                <button
                  onClick={() => setActiveTab('map')}
                  className={`rounded-lg p-2 text-xs font-medium transition-all ${activeTab === 'map' ? (darkMode ? 'bg-cyan-500 text-zinc-950 shadow' : 'bg-[#24483a] text-white shadow') : darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-[#68776c] hover:text-[#19372e]'}`}
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
        </div>

        {activeTab === 'grid' && <div className="mb-4 flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${darkMode ? 'text-cyan-400' : 'text-[#5f705f]'}`}>The campus board</p>
            <h2 className={`mt-1 text-2xl font-semibold tracking-tight ${darkMode ? 'text-white' : 'text-[#19372e]'}`}>Recent reports</h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={`text-sm ${darkMode ? 'text-zinc-400' : 'text-[#5d6c62]'}`}>{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} to explore</span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${isSupabaseConfigured ? (darkMode ? 'border-emerald-800 bg-emerald-950 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800') : (darkMode ? 'border-amber-800 bg-amber-950 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800')}`}>
              {isSupabaseConfigured ? 'Shared board' : 'This device only'}
            </span>
          </div>
        </div>}

        {activeTab === 'grid' && <div className="mb-6 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter reports by category">
            {['All', ...Object.keys(CATEGORY_BADGE_CLASSES)].map(category => {
              const isSelected = categoryFilter === category;
              const categoryBorder = category === 'All'
                ? (darkMode ? '#52525b' : '#dfddd3')
                : CATEGORY_FILTER_BORDER_COLORS[category][darkMode ? 1 : 0];
              const borderColor = isSelected ? '#e9954e' : categoryBorder;
              return <button key={category} type="button" onClick={() => setCategoryFilter(category)} aria-pressed={isSelected} style={{ borderColor, '--category-border-color': '#e9954e' }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--category-border-color)] ${category === 'All' ? (isSelected ? 'border-[#24483a] bg-[#24483a] text-white' : darkMode ? 'border-zinc-700 bg-zinc-900 text-zinc-300' : 'border-[#fffefa] bg-[#fffefa] text-[#64746a]') : `border-2 ${CATEGORY_BADGE_CLASSES[category]} ${isSelected ? 'font-bold' : ''}`}`}>{category}</button>;
            })}
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Show lost or found reports">
            {[['all', 'All items'], ['lost', 'Lost'], ['found', 'Found'], ['resolved', 'Resolved']].map(([status, label]) => <button key={status} type="button" onClick={() => setStatusFilter(status)} aria-pressed={statusFilter === status} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === status ? 'bg-[#ef9c55] text-[#19372e]' : darkMode ? 'text-zinc-400 hover:bg-zinc-900' : 'text-[#5d6c62] hover:bg-white'}`}>{label}</button>)}
          </div>
        </div>}

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
              <div className="grid grid-cols-1 gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {sortedItems.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${item.title}, ${item.status} item at ${item.location}`}
                    onClick={() => { setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); }}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); } }}
                    className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[1.6rem] border transition-all duration-200 hover:-translate-y-0.5 ${darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-[#668271] hover:shadow-[0_14px_32px_rgba(0,0,0,0.24)]' : 'bg-[#fffefa] border-[#e2ded4] shadow-[0_4px_16px_rgba(34,52,41,0.055)] hover:border-[#c7cbbb] hover:shadow-[0_12px_28px_rgba(34,52,41,0.1)]'}`}
                  >
                    <div>
                      {item.image ? <div className="item-photo relative aspect-[16/9] overflow-hidden bg-[#e9e8df] dark:bg-zinc-800">
                        <img src={item.image} alt={`Illustrative reference photo for ${item.title}`} loading="lazy" onError={event => { event.currentTarget.hidden = true; }} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                        <div className="absolute top-3 left-3">
                        <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${item.status === 'lost' ? 'bg-[#c21f4b] text-white' : item.status === 'found' ? 'bg-[#00bd88] text-[#073b31]' : 'bg-zinc-300 text-zinc-700'}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                          <span className={`rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm ${CATEGORY_BADGE_CLASSES[item.category] || 'border-zinc-200 bg-zinc-100 text-zinc-700'}`}>{item.category}</span>
                        </div>
                      </div> : <div className="flex aspect-[16/9] flex-col justify-between bg-[#f4f2eb] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${item.status === 'lost' ? 'bg-[#c21f4b] text-white' : item.status === 'found' ? 'bg-[#00bd88] text-[#073b31]' : 'bg-zinc-300 text-zinc-700'}`}>{item.status}</span>
                          <span className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${CATEGORY_BADGE_CLASSES[item.category] || 'border-zinc-200 bg-zinc-100 text-zinc-700'}`}>{item.category}</span>
                        </div>
                        <div className="border-t border-[#e3dfd4] pt-3">
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#5d6c62]">VIT Vellore · Campus report</span>
                        </div>
                      </div>}

                      <div className="px-6 pb-5 pt-6">
                        <h2 className={`mb-1.5 line-clamp-1 text-xl font-bold tracking-[-0.02em] transition-colors ${darkMode ? 'text-zinc-100 group-hover:text-[#f0ad70]' : 'text-[#173b2c] group-hover:text-[#a9683a]'}`}>
                          {item.title}
                        </h2>
                        <p className={`mb-5 line-clamp-2 min-h-10 text-sm leading-5 ${darkMode ? 'text-zinc-400' : 'text-[#657168]'}`}>
                          {item.description}
                        </p>

                        <div className={`space-y-2.5 border-t pt-3.5 text-sm ${darkMode ? 'border-zinc-800 text-zinc-400' : 'border-[#f0eee8] text-[#526058]'}`}>
                          <div className="flex items-center gap-2">
                            <MapPin className={`h-4 w-4 shrink-0 ${darkMode ? 'text-cyan-500' : 'text-[#71866d]'}`} />
                            <span className="truncate font-medium">{item.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
                            <span title={`${item.date} · ${item.time || 'Time not provided'}`}>{formatRelativeDate(item.date)}{item.time ? ` · ${item.time}` : ''}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`flex flex-col gap-2 border-t px-6 py-4 text-sm font-medium sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-[#f0eee8] bg-[#faf9f6]'}`}>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        {item.shareContact && item.owner && <span className={darkMode ? 'text-zinc-200' : 'text-[#35483b]'}>{item.owner}</span>}
                        {item.phone && <a className={`inline-flex items-center gap-1.5 hover:underline ${darkMode ? 'text-zinc-300' : 'text-[#526058]'}`} href={`tel:${item.phone}`} aria-label={`Call reporter at ${item.phone}`}><Phone className="h-3.5 w-3.5" />{item.phone}</a>}
                      </div>
                      <span className={`flex items-center gap-1 group-hover:underline ${darkMode ? 'text-[#a4bdaa]' : 'text-[#8c5935]'}`}>
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
          <div className={`mx-auto max-w-[900px] overflow-hidden rounded-3xl border shadow-xl ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-[#e3dfd4] bg-[#fffefa] shadow-[0_12px_36px_rgba(34,52,41,0.08)]'}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? 'border-zinc-800' : 'border-[#e8e4da]'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${darkMode ? 'bg-[#243a37] text-[#a4bdaa]' : 'bg-[#e8f0ee] text-[#49685c]'}`}><Navigation className="h-5 w-5" /></span>
                <div><h2 className={`font-semibold ${darkMode ? 'text-zinc-100' : 'text-[#19372e]'}`}>VIT Vellore · Campus map</h2><p className={`mt-0.5 text-xs ${darkMode ? 'text-zinc-400' : 'text-[#5d6c62]'}`}>Lost &amp; found reports around campus</p></div>
              </div>
              <span className={`hidden rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex ${darkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-[#e5e1d7] bg-[#f7f6f0] text-[#64746a]'}`}>{mapItems.length} matching reports</span>
            </div>

            {mapTileError && <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs ${darkMode ? 'border-zinc-800 bg-zinc-800/60 text-zinc-200' : 'border-[#e8e4da] bg-[#f7f6f0] text-[#3c5146]'}`}>
              <span>Some map tiles did not load.</span>
              <button type="button" onClick={() => { setMapTileError(false); setMapTileRetry(value => value + 1); }} className="shrink-0 font-semibold underline underline-offset-2">Retry map</button>
            </div>}

            {(() => {
              const centerPixel = toWorldPixel(mapCenter.lat, mapCenter.lon, mapZoom);
              // Fetch the next sharper integer tile level and scale it down at fractional fit zooms.
              const tileZoom = Math.min(MAX_ZOOM, Math.ceil(mapZoom));
              const tileSize = 256 * (2 ** (mapZoom - tileZoom));
              const tileBaseX = Math.floor(centerPixel.x / tileSize);
              const tileBaseY = Math.floor(centerPixel.y / tileSize);
              const tileCount = 2 ** tileZoom;
              const viewportWidth = mapViewportSize.width;
              const viewportHeight = mapViewportSize.height;
              const campusWest = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_WEST, mapZoom).x;
              const campusEast = toWorldPixel(INITIAL_MAP_CENTER.lat, CAMPUS_EAST, mapZoom).x;
              const campusNorth = toWorldPixel(CAMPUS_NORTH, INITIAL_MAP_CENTER.lon, mapZoom).y;
              const campusSouth = toWorldPixel(CAMPUS_SOUTH, INITIAL_MAP_CENTER.lon, mapZoom).y;
              const cropTop = Math.max(0, viewportHeight / 2 + campusNorth - centerPixel.y);
              const cropRight = Math.max(0, viewportWidth / 2 - (campusEast - centerPixel.x));
              const cropBottom = Math.max(0, viewportHeight / 2 - (campusSouth - centerPixel.y));
              const cropLeft = Math.max(0, viewportWidth / 2 + campusWest - centerPixel.x);
              const campusClip = `inset(${cropTop}px ${cropRight}px ${cropBottom}px ${cropLeft}px)`;
              const firstVisibleTileX = Math.floor((centerPixel.x - viewportWidth / 2) / tileSize);
              const lastVisibleTileX = Math.floor((centerPixel.x + viewportWidth / 2) / tileSize);
              const firstVisibleTileY = Math.max(0, Math.floor((centerPixel.y - viewportHeight / 2) / tileSize));
              const lastVisibleTileY = Math.min(tileCount - 1, Math.floor((centerPixel.y + viewportHeight / 2) / tileSize));
              const xOffsets = Array.from(
                { length: lastVisibleTileX - firstVisibleTileX + 1 },
                (_, index) => firstVisibleTileX + index - tileBaseX,
              );
              const yOffsets = Array.from(
                { length: lastVisibleTileY - firstVisibleTileY + 1 },
                (_, index) => firstVisibleTileY + index - tileBaseY,
              );
              const tiles = yOffsets.flatMap(offsetY => xOffsets.map(offsetX => {
                const rawX = tileBaseX + offsetX;
                const tileX = ((rawX % tileCount) + tileCount) % tileCount;
                const tileY = tileBaseY + offsetY;
                return {
                  key: `${offsetX}-${offsetY}-${mapTileRetry}`,
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
                onKeyDown={event => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === '+' || event.key === '=') { event.preventDefault(); handleMapZoom(1); }
                  if (event.key === '-' || event.key === '_') { event.preventDefault(); handleMapZoom(-1); }
                }}
                tabIndex={0}
                aria-label="Interactive VIT campus map. Drag to pan after zooming in. Use plus and minus keys to zoom."
                style={{ aspectRatio: `${CAMPUS_ASPECT_RATIO} / 1` }}
                className={`relative w-full touch-none overflow-hidden bg-[#e8eef0] outline-none focus-visible:ring-2 focus-visible:ring-[#668271] dark:focus-visible:ring-[#a4bdaa] ${isDraggingMap ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <div className="absolute inset-0" style={{ clipPath: campusClip }}>
                {tiles.map(tile => <img key={tile.key} draggable="false" decoding="async" src={tile.url} onError={() => setMapTileError(true)} alt="" className="pointer-events-none absolute max-w-none select-none" style={{ width: `${tileSize}px`, height: `${tileSize}px`, left: `calc(50% + ${tile.x}px)`, top: `calc(50% + ${tile.y}px)`, transition: isDraggingMap ? 'none' : `left ${FLY_MS}ms ease-out, top ${FLY_MS}ms ease-out, width ${FLY_MS}ms ease-out, height ${FLY_MS}ms ease-out` }} />)}
                </div>

                <MapSearch items={mapItems} value={searchTerm} onChange={value => { setSearchTerm(value); setFocusedSearchId(null); }} onSelectItem={focusSearchResult} darkMode={darkMode} />

                <div className={`absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-2xl border shadow-lg ${darkMode ? 'border-zinc-700 bg-zinc-900/95 text-zinc-200' : 'border-[#e3dfd4] bg-[#fffefa]/95 text-[#3c5146]'}`} data-map-control>
                  <button type="button" aria-label="Zoom in" title="Zoom in" disabled={mapZoom >= MAX_ZOOM} onPointerDown={event => event.stopPropagation()} onClick={() => handleMapZoom(1)} className="p-3 transition hover:bg-[#edf3ed] disabled:opacity-35 dark:hover:bg-zinc-800"><ZoomIn className="h-5 w-5" /></button>
                  <span className={`border-y py-1 text-center text-[10px] font-medium ${darkMode ? 'border-zinc-700 text-zinc-400' : 'border-[#e8e4da] text-[#5d6c62]'}`}>z{mapZoom}</span>
                  <button type="button" aria-label="Zoom out" title="Zoom out" disabled={mapZoom <= mapMinZoom} onPointerDown={event => event.stopPropagation()} onClick={() => handleMapZoom(-1)} className="p-3 transition hover:bg-[#edf3ed] disabled:opacity-35 dark:hover:bg-zinc-800"><ZoomOut className="h-5 w-5" /></button>
                  <button type="button" aria-label="Show full campus" title="Show full campus" onPointerDown={event => event.stopPropagation()} onClick={() => { setMapZoom(mapMinZoom); setMapCenter(INITIAL_MAP_CENTER); setSearchTerm(''); setFocusedSearchId(null); setFocusedMapItem(null); }} className={`border-t p-3 transition hover:bg-[#edf3ed] dark:hover:bg-zinc-800 ${darkMode ? 'border-zinc-700' : 'border-[#e8e4da]'}`}><Compass className="h-5 w-5" /></button>
                </div>

                <div className="absolute inset-0" style={{ clipPath: campusClip }}>
                {mapItems.map((item, markerIndex) => {
                  const position = toWorldPixel(item.lat, item.lng, mapZoom);
                  const samePlace = mapMarkersById.get(String(item.id)) || { index: 0, count: 1 };
                  const spread = markerSpreadOffset(samePlace.index, samePlace.count);
                  const left = position.x - centerPixel.x + spread.x;
                  const top = position.y - centerPixel.y + spread.y;
                  const fields = getMapItemFields(item);
                  return <div key={item.id} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(50% + ${left}px)`, top: `calc(50% + ${top}px)`, transition: isDraggingMap ? 'none' : `left ${FLY_MS}ms ease-out, top ${FLY_MS}ms ease-out` }}>
                    <button type="button" data-map-marker onPointerDown={event => event.stopPropagation()} onClick={() => setFocusedMapItem(item)} style={{ animationDelay: `${(markerIndex % 8) * 110}ms` }} className={`group flex h-9 w-9 animate-marker-float motion-reduce:animate-none items-center justify-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-md transition group-hover:scale-110 ${focusedSearchId === item.id ? 'ring-4 ring-[#e2a267] ring-offset-2' : ''} ${item.status === 'resolved' ? 'bg-[#787d74]' : item.status === 'lost' ? 'bg-[#a75c49]' : 'bg-[#54755a]'}`} aria-label={`Show ${fields.name} on map, report ${samePlace.index + 1} of ${samePlace.count} at ${fields.building}`}>
                      {item.status === 'lost' ? '!' : <Check className="h-4 w-4" />}
                    </button>
                    {focusedMapItem?.id === item.id && <div data-map-control className={`absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-2xl border p-4 text-left shadow-xl ${darkMode ? 'border-zinc-700 bg-zinc-900 text-zinc-100' : 'border-[#e3dfd4] bg-[#fffefa] text-[#19372e]'}`}>
                      <button type="button" aria-label="Close map popup" onClick={() => setFocusedMapItem(null)} className={`absolute right-2 top-2 rounded p-1 ${darkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-[#5d6c62] hover:bg-[#edf3ed]'}`}><X className="h-4 w-4" /></button>
                      <p className="pr-6 text-sm font-bold">{fields.name}</p>
                      <p className={`mt-2 text-xs ${darkMode ? 'text-zinc-300' : 'text-[#5f6d62]'}`}>{fields.building}</p>
                      <p className={`mt-1 text-xs ${darkMode ? 'text-zinc-300' : 'text-[#5f6d62]'}`}>Floor: {fields.floor}</p>
                      {fields.landmark && <p className={`mt-1 text-xs ${darkMode ? 'text-zinc-300' : 'text-[#5f6d62]'}`}>Near {fields.landmark}</p>}
                      <button type="button" onClick={() => { setSelectedItem(item); setVerifyStep(false); setEnteredPin(''); setVerifyError(''); }} className="mt-3 text-xs font-semibold text-[#49685c] hover:underline dark:text-[#a4bdaa]">View report</button>
                    </div>}
                  </div>;
                })}
                {mapItems.length === 0 && <div className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center">
                  <p className={`mx-auto inline-block rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg ${darkMode ? 'border-zinc-700 bg-zinc-900/95 text-zinc-200' : 'border-[#e3dfd4] bg-[#fffefa]/95 text-[#3c5146]'}`}>
                    No items match the selected filters{locationFilter !== 'All' ? ` at ${locationFilter}` : ''}.
                  </p>
                </div>}
                </div>

                <div className={`absolute bottom-4 left-4 z-20 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-xs font-medium shadow-lg backdrop-blur-sm ${darkMode ? 'border-zinc-700 bg-zinc-900/95 text-zinc-200' : 'border-[#e3dfd4] bg-[#fffefa]/95 text-[#3c5146]'}`} data-map-control>
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#a75c49]" />Lost</span>
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#54755a]" />Found</span>
                  <span className={`hidden md:inline ${darkMode ? 'text-zinc-400' : 'text-[#5d6c62]'}`}>Drag to explore · Zoom with the controls</span>
                </div>
                <div className={`absolute bottom-2 right-2 z-10 rounded-lg px-2 py-1 text-[10px] ${darkMode ? 'bg-zinc-900/90 text-zinc-300' : 'bg-[#fffefa]/90 text-[#657168]'}`}>&copy; OpenStreetMap contributors</div>
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
              <img src={selectedItem.image} alt={`Illustrative reference photo for ${selectedItem.title}`} loading="lazy" onError={event => event.currentTarget.remove()} className="h-full w-full object-cover" />
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
                <h2 id="selected-item-title" className={`mt-0.5 text-xl font-bold tracking-tight ${darkMode ? 'text-zinc-100' : 'text-[#173b2c]'}`}>{selectedItem.title}</h2>
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
                      <ShieldCheck className="w-4 h-4" /> Contact reporter
                    </h3>
                    <div className="pt-1 space-y-1 text-sm">
                      {selectedItem.shareContact && selectedItem.owner && <p>{selectedItem.owner}</p>}
                      {selectedItem.phone ? <p><a className="text-cyan-700 hover:underline dark:text-cyan-400" href={`tel:${selectedItem.phone}`}>{selectedItem.phone}</a></p> : <p className="leading-relaxed">Phone details are unavailable for this older report. Arrange an in-person handover at the campus security or lost-and-found desk.</p>}
                      {selectedItem.shareContact && selectedItem.contact && <p><a className="text-cyan-700 hover:underline dark:text-cyan-400" href={`mailto:${selectedItem.contact}`}>{selectedItem.contact}</a></p>}
                    </div>
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
                <Plus className={`h-5 w-5 ${darkMode ? 'text-[#e8ad77]' : 'text-[#a9683a]'}`} /> Report Lost or Found Item
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
                    <option value="Personal">Personal</option>
                    <option value="ID & Cards">ID &amp; Cards</option>
                    <option value="Books">Books</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Bags">Bags</option>
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
                <label className="block text-xs font-semibold uppercase tracking-wider">Approx. time seen (optional)
                  <input value={formData.time} onChange={event => setFormData({ ...formData, time: event.target.value })} placeholder="e.g. around 1:30 PM" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal normal-case tracking-normal ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider">Floor (optional)
                  <input value={formData.floor} onChange={event => setFormData({ ...formData, floor: event.target.value })} placeholder="e.g. 2nd floor" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal normal-case tracking-normal ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`} />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider">Nearby landmark (optional)
                  <input value={formData.landmark} onChange={event => setFormData({ ...formData, landmark: event.target.value })} placeholder="e.g. near the library" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal normal-case tracking-normal ${darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200'}`} />
                </label>
              </div>

              <p className={`rounded-xl border p-3 text-xs leading-relaxed ${darkMode ? 'border-[#3c5955] bg-[#243a37] text-[#c5dcda]' : 'border-[#d5e1d7] bg-[#edf3ed] text-[#42604d]'}`}>Your phone number is required and visible on the report so people can contact you. Your name is shown only if you opt in. Avoid personal details in item photos. {isSupabaseConfigured ? 'Reports and uploaded photos are saved to the campus database.' : 'This preview keeps reports in this browser session. Connect the database to share reports across devices.'}</p>

              <section className={`space-y-3 rounded-xl border p-4 ${darkMode ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-200 bg-zinc-50'}`}>
                <div><h3 className="text-sm font-semibold">Contact details</h3><p className={`mt-1 text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>A phone number is required and will appear on the report. Your name is optional and stays private unless you choose to show it.</p></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Name<input autoComplete="name" value={formData.owner} onChange={event => setFormData({ ...formData, owner: event.target.value })} placeholder="Your name" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal ${darkMode ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} /></label>
                  <label className="text-xs font-semibold" htmlFor="report-phone">Phone <span className="text-rose-600">(required)</span><span className={`mt-1 flex items-center overflow-hidden rounded-xl border ${phoneError ? 'border-rose-500' : darkMode ? 'border-zinc-700' : 'border-zinc-200'}`}><span className={`border-r px-3 py-3 text-sm ${darkMode ? 'border-zinc-700 bg-zinc-800 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600'}`}>+91</span><input id="report-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} required aria-invalid={Boolean(phoneError)} aria-describedby="report-phone-hint" value={formData.phone} onChange={event => setFormData({ ...formData, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit number" className={`min-w-0 flex-1 bg-transparent p-3 text-sm font-normal outline-none ${darkMode ? 'text-white' : 'text-zinc-900'}`} /></span></label>
                  <p id="report-phone-hint" aria-live="polite" className={`text-xs ${phoneError ? 'text-rose-600 dark:text-rose-400' : darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>{phoneError || 'Enter exactly 10 digits. The +91 country code is added automatically and this number will be shown on your report.'}</p>
                  <label className="text-xs font-semibold sm:col-span-2">Email<input type="email" autoComplete="email" value={formData.contact} onChange={event => setFormData({ ...formData, contact: event.target.value })} placeholder="name@example.com" className={`mt-1 w-full rounded-xl border p-3 text-sm font-normal ${darkMode ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-200'}`} /></label>
                </div>
                <label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={formData.shareContact} onChange={event => setFormData({ ...formData, shareContact: event.target.checked })} className="mt-0.5 accent-cyan-600" /><span>Share my name and email (if provided) in the report details. My phone number is always shown for contact.</span></label>
              </section>

              <div>
                <label htmlFor="report-item-image" className="mb-1 block text-xs font-semibold uppercase tracking-wider">{formData.status === 'lost' ? 'Photo of lost item (optional)' : 'Photo of found item (optional)'}</label>
                <div className={`flex items-center gap-3 rounded-xl border border-dashed p-3 ${darkMode ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-300 bg-zinc-50'}`}>
                  {formData.image ? <img src={formData.image} alt="Selected item preview" onError={() => { if (imageLink) setImageLinkError('The link could not load an image. Use a direct, publicly accessible image URL.'); }} className="h-16 w-16 rounded-lg object-cover" /> : <button type="button" onClick={() => document.getElementById('report-item-image')?.click()} aria-label="Add item photo" title="Add item photo" className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#668271] ${darkMode ? 'bg-[#243a37] text-[#a4bdaa]' : 'bg-[#e8f0ee] text-[#49685c]'}`}><Plus className="h-6 w-6" /></button>}
                  <div className="flex-1"><label htmlFor="report-item-image" className={`cursor-pointer text-sm font-semibold hover:underline ${darkMode ? 'text-[#a4bdaa]' : 'text-[#49685c]'}`}>{formData.image ? 'Change photo' : 'Choose a photo'}</label><p className={`mt-1 text-xs ${darkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Upload a photo for either a lost or found report. JPG, PNG or WEBP (up to 5 MB).</p></div>
                  {formData.image && <button type="button" onClick={() => { setFormData(current => ({ ...current, image: '' })); setImageLink(''); setImageLinkError(''); }} className="text-xs font-medium text-rose-500 hover:underline">Remove</button>}
                </div>
                <input id="report-item-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="sr-only" />
                <div className="mt-3 flex items-center gap-3" aria-hidden="true"><span className={`h-px flex-1 ${darkMode ? 'bg-zinc-700' : 'bg-zinc-200'}`} /><span className={`text-[10px] font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-zinc-500'}`}>or paste an image link</span><span className={`h-px flex-1 ${darkMode ? 'bg-zinc-700' : 'bg-zinc-200'}`} /></div>
                <label htmlFor="report-image-url" className="sr-only">Image URL</label>
                <input id="report-image-url" type="url" inputMode="url" autoComplete="url" value={imageLink} onChange={event => { const value = event.target.value; const trimmedValue = value.trim(); setImageLink(value); setImageLinkError(''); setFormData(current => ({ ...current, image: isPublicHttpUrl(trimmedValue) ? trimmedValue : '' })); }} onBlur={() => { if (!imageLink.trim()) return; setImageLinkError(isPublicHttpUrl(imageLink.trim()) ? '' : 'Enter a valid public image URL starting with http:// or https://.'); }} aria-invalid={Boolean(imageLinkError)} aria-describedby="report-image-url-hint" placeholder="https://example.com/item-photo.jpg" className={`mt-2 w-full rounded-xl border p-3 text-sm ${imageLinkError ? 'border-rose-500' : darkMode ? 'border-zinc-700 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-900'}`} />
                <p id="report-image-url-hint" aria-live="polite" className={`mt-1 text-xs ${imageLinkError ? 'text-rose-500' : darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>{imageLinkError || 'Paste a direct, publicly accessible image URL (HTTP or HTTPS). Some image sites block external links.'}</p>
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
                className="w-full rounded-xl bg-[#e9954e] py-3.5 font-semibold text-[#19372e] shadow-sm transition hover:bg-[#f3a967] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#78947c] focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
              >
                Publish Report
              </button>
            </form>

          </div>
        </div>
      )}

      <SpeedInsights />
    </div>
  );
}
