import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { getMapItemFields, searchLocationItems, searchMapItems } from '../lib/mapSearch';

export default function MapSearch({ items, value, onChange, onSelectItem }) {
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

  return <div className="absolute left-4 top-4 z-30 w-[min(380px,calc(100%-5rem))]" data-map-control>
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/10">
      <Search className="h-5 w-5 shrink-0 text-slate-600" />
      <input aria-label="Search lost and found reports" aria-expanded={isOpen} aria-controls="map-search-results" role="combobox" value={value} onChange={event => { onChange(event.target.value); setIsOpen(true); setActiveIndex(0); }} onFocus={() => value.trim() && setIsOpen(true)} onKeyDown={handleKeyDown} placeholder="Search items or locations" className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-600" />
      {value && <button type="button" aria-label="Clear search" onClick={() => { onChange(''); setLocationValue(''); setIsOpen(false); }} className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button>}
    </div>

    {isOpen && value.trim() && <div id="map-search-results" role="listbox" className="mt-2 max-h-[min(65vh,380px)] overflow-y-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10">
      {!matches.length ? <p className="px-3 py-2 text-sm text-slate-700" role="status">No results found</p> : duplicateName ? <>
        <p className="px-3 py-2 text-xs font-semibold text-slate-700">Multiple results for '{getMapItemFields(matches[0]).name}'. Where is it?</p>
        <label className="mx-2 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <MapPin className="h-4 w-4 shrink-0" />
          <input ref={locationInputRef} aria-label="Narrow by building, floor, or landmark" value={locationValue} onChange={event => { setLocationValue(event.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="e.g. near library" className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-600" />
        </label>
        {debouncedLocation && !locationMatches.length && <p className="px-3 py-2 text-xs text-amber-800" role="status">No location match. Showing all locations.</p>}
        {options.map((item, index) => {
          const fields = getMapItemFields(item);
          return <button key={fields.id} id={`map-search-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} onClick={() => selectItem(item)} className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50 ${activeIndex === index ? 'bg-blue-50' : ''}`}>
            <span className="block truncate text-sm font-semibold text-slate-800">{fields.building}{fields.floor ? ` · ${fields.floor}` : ''}</span>
            <span className="mt-0.5 block text-xs text-slate-600">{fields.landmark || 'Landmark not provided'}</span>
          </button>;
        })}
      </> : <>
        <p className="px-3 py-2 text-xs font-semibold text-slate-600">{matches.length > 1 ? 'Choose a matching report' : 'Search result'}</p>
        {matches.map((item, index) => {
          const fields = getMapItemFields(item);
          return <button key={fields.id} id={`map-search-option-${index}`} type="button" role="option" aria-selected={activeIndex === index} onClick={() => selectItem(item)} className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50 ${activeIndex === index ? 'bg-blue-50' : ''}`}>
            <span className="block truncate text-sm font-semibold text-slate-800">{fields.name}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-600"><MapPin className="h-3 w-3" />{fields.building}{fields.floor ? ` - ${fields.floor}` : ''}{fields.landmark ? ` - ${fields.landmark}` : ''}</span>
          </button>;
        })}
      </>}
    </div>}
  </div>;
}
