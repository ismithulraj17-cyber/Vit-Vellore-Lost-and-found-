import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { getMapItemFields, searchLocationItems, searchMapItems } from '../lib/mapSearch';

export default function MapSearch({ items, value, onChange, onSelectItem, darkMode = false }) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [locationValue, setLocationValue] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const locationInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), 280);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLocation(locationValue), 350);
    return () => clearTimeout(timer);
  }, [locationValue]);

  useEffect(() => { setLocationValue(''); setDebouncedLocation(''); }, [debouncedValue]);

  const matches = useMemo(() => searchMapItems(items, debouncedValue), [items, debouncedValue]);
  const duplicateName = matches.length > 1 && matches.every(item => getMapItemFields(item).name.toLocaleLowerCase() === getMapItemFields(matches[0]).name.toLocaleLowerCase());
  const locationMatches = useMemo(() => duplicateName ? searchLocationItems(matches, debouncedLocation) : [], [duplicateName, matches, debouncedLocation]);
  const options = duplicateName
    ? (debouncedLocation ? (locationMatches.length ? locationMatches : matches) : matches)
    : matches;

  const selectItem = (item) => {
    setIsOpen(false);
    setLocationValue('');
    onSelectItem(item);
  };

  useEffect(() => {
    if (duplicateName && debouncedLocation.trim() && locationMatches.length === 1) selectItem(locationMatches[0]);
  // A unique location keyword match should focus the matching report.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateName, debouncedLocation, locationMatches]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); setLocationValue(''); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isOpen) setIsOpen(true);
      if (options.length) {
        event.preventDefault();
        setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (duplicateName && event.currentTarget !== locationInputRef.current) {
        locationInputRef.current?.focus();
        return;
      }
      if (isOpen && options.length === 1) selectItem(options[0]);
      else if (isOpen && options.length > 1) selectItem(options[Math.min(activeIndex, options.length - 1)]);
      else if (matches.length === 1) selectItem(matches[0]);
      else setIsOpen(true);
    }
  };

  return <div className="absolute left-4 top-4 z-30 w-[min(380px,calc(100%-5.5rem))]" data-map-control>
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ${darkMode ? 'border-zinc-700 bg-zinc-900/95 text-zinc-100' : 'border-[#e3dfd4] bg-[#fffefa]/95 text-[#19372e]'}`}>
      <Search className={`h-5 w-5 shrink-0 ${darkMode ? 'text-[#a4bdaa]' : 'text-[#668271]'}`} />
      <input aria-label="Search lost and found reports" aria-expanded={isOpen} aria-controls="map-search-results" role="combobox" value={value} onChange={event => { onChange(event.target.value); setIsOpen(true); setActiveIndex(0); }} onFocus={() => value.trim() && setIsOpen(true)} onKeyDown={handleKeyDown} placeholder="Search items or locations" className={`w-full bg-transparent text-sm outline-none placeholder:opacity-65 ${darkMode ? 'text-zinc-100 placeholder:text-zinc-400' : 'text-[#19372e] placeholder:text-[#768178]'}`} />
      {value && <button type="button" aria-label="Clear search" onClick={() => { onChange(''); setLocationValue(''); setIsOpen(false); }} className={`rounded p-1 ${darkMode ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100' : 'text-[#768178] hover:bg-[#edf3ed] hover:text-[#19372e]'}`}><X className="h-4 w-4" /></button>}
    </div>

    {isOpen && value.trim() && <div id="map-search-results" role="listbox" className={`mt-2 max-h-[min(65vh,380px)] overflow-y-auto rounded-2xl border p-2 shadow-xl ${darkMode ? 'border-zinc-700 bg-zinc-900 text-zinc-100' : 'border-[#e3dfd4] bg-[#fffefa] text-[#19372e]'}`}>
      {!matches.length ? <p className={`px-3 py-2 text-sm ${darkMode ? 'text-zinc-300' : 'text-[#5f6d62]'}`} role="status">No results found</p> : duplicateName ? <>
        <p className={`px-3 py-2 text-xs font-semibold ${darkMode ? 'text-zinc-200' : 'text-[#405549]'}`}>Multiple results for '{getMapItemFields(matches[0]).name}'. Where is it?</p>
        <label className={`mx-2 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${darkMode ? 'border-zinc-700 text-zinc-300' : 'border-[#e3dfd4] text-[#5f6d62]'}`}>
          <MapPin className="h-4 w-4 shrink-0" />
          <input ref={locationInputRef} aria-label="Narrow by building, floor, or landmark" value={locationValue} onChange={event => { setLocationValue(event.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="e.g. near library" className={`min-w-0 flex-1 bg-transparent outline-none placeholder:opacity-65 ${darkMode ? 'text-zinc-100 placeholder:text-zinc-400' : 'text-[#19372e] placeholder:text-[#768178]'}`} />
        </label>
        {debouncedLocation && !locationMatches.length && <p className={`px-3 py-2 text-xs ${darkMode ? 'text-[#e5d6b6]' : 'text-[#705a31]'}`} role="status">No location match. Showing all locations.</p>}
        {options.map((item, index) => {
          const fields = getMapItemFields(item);
          return <button key={fields.id} id={`map-search-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} onClick={() => selectItem(item)} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-[#edf3ed]'} ${activeIndex === index ? (darkMode ? 'bg-zinc-800' : 'bg-[#edf3ed]') : ''}`}>
            <span className={`block truncate text-sm font-semibold ${darkMode ? 'text-zinc-100' : 'text-[#19372e]'}`}>{fields.building}{fields.floor ? ` · ${fields.floor}` : ''}</span>
            <span className={`mt-0.5 block text-xs ${darkMode ? 'text-zinc-400' : 'text-[#768178]'}`}>{fields.landmark || 'Landmark not provided'}</span>
          </button>;
        })}
      </> : <>
        <p className={`px-3 py-2 text-xs font-semibold ${darkMode ? 'text-zinc-400' : 'text-[#768178]'}`}>{matches.length > 1 ? 'Choose a matching report' : 'Search result'}</p>
        {matches.map((item, index) => {
          const fields = getMapItemFields(item);
          return <button key={fields.id} id={`map-search-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} onClick={() => selectItem(item)} className={`w-full rounded-xl px-3 py-2.5 text-left transition ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-[#edf3ed]'} ${activeIndex === index ? (darkMode ? 'bg-zinc-800' : 'bg-[#edf3ed]') : ''}`}>
            <span className={`block truncate text-sm font-semibold ${darkMode ? 'text-zinc-100' : 'text-[#19372e]'}`}>{fields.name}</span>
            <span className={`mt-0.5 flex items-center gap-1 text-xs ${darkMode ? 'text-zinc-400' : 'text-[#768178]'}`}><MapPin className="h-3 w-3" />{fields.building}{fields.floor ? ` - ${fields.floor}` : ''}{fields.landmark ? ` - ${fields.landmark}` : ''}</span>
          </button>;
        })}
      </>}
    </div>}
  </div>;
}
