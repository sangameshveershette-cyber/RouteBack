import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';
import { useMapsConfig } from '../context/MapsContext.tsx';
import type { LatLng } from '../types.ts';

interface HubCity {
  name: string;
  label: string;
  coords: LatLng;
}

export const CORRIDOR_HUBS: HubCity[] = [
  { name: 'Bengaluru', label: 'Bengaluru, Karnataka', coords: { lat: 12.9716, lng: 77.5946 } },
  { name: 'Mysuru', label: 'Mysuru, Karnataka', coords: { lat: 12.2958, lng: 76.6394 } },
  { name: 'Tumakuru', label: 'Tumakuru, Karnataka', coords: { lat: 13.3379, lng: 77.1173 } },
  { name: 'Chennai', label: 'Chennai, Tamil Nadu', coords: { lat: 13.0827, lng: 80.2707 } },
  { name: 'Hyderabad', label: 'Hyderabad, Telangana', coords: { lat: 17.385, lng: 78.4867 } },
  { name: 'Pune', label: 'Pune, Maharashtra', coords: { lat: 18.5204, lng: 73.8567 } },
  { name: 'Mangaluru', label: 'Mangaluru, Karnataka', coords: { lat: 12.9141, lng: 74.856 } },
  { name: 'Mandya', label: 'Mandya, Karnataka', coords: { lat: 12.5218, lng: 76.8951 } },
  { name: 'Hosur', label: 'Hosur, Tamil Nadu', coords: { lat: 12.7409, lng: 77.8253 } },
  { name: 'Vellore', label: 'Vellore, Tamil Nadu', coords: { lat: 12.9165, lng: 79.1325 } },
  { name: 'Hassan', label: 'Hassan, Karnataka', coords: { lat: 13.0033, lng: 76.1004 } },
  { name: 'Hubballi', label: 'Hubballi, Karnataka', coords: { lat: 15.3647, lng: 75.124 } },
  { name: 'Kurnool', label: 'Kurnool, Andhra Pradesh', coords: { lat: 15.8281, lng: 78.0373 } },
  { name: 'Anantapur', label: 'Anantapur, Andhra Pradesh', coords: { lat: 14.6819, lng: 77.6006 } },
];

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string, coords?: LatLng) => void;
  required?: boolean;
  id?: string;
}

function PlacesAutocompleteInner({
  label,
  value,
  placeholder,
  onChange,
  required,
  id,
}: Props) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [googleSuggestions, setGoogleSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!placesLib || !open || value.trim().length < 2) {
      setGoogleSuggestions([]);
      return;
    }

    let cancelled = false;
    const { AutocompleteSessionToken } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const timer = setTimeout(() => {
      const placesApi = placesLib as unknown as {
        AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestionApi;
      };
      placesApi.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        sessionToken: sessionTokenRef.current!,
        includedRegionCodes: ['in'],
      })
        .then((res: { suggestions?: google.maps.places.AutocompleteSuggestion[] }) => {
          if (!cancelled) {
            setGoogleSuggestions(res.suggestions || []);
          }
        })
        .catch((err: unknown) => {
          const msg = String(err);
          if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          if (!cancelled) setGoogleSuggestions([]);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, value, open]);

  const localMatches = CORRIDOR_HUBS.filter(
    (c) =>
      !value.trim() ||
      c.name.toLowerCase().includes(value.trim().toLowerCase()) ||
      c.label.toLowerCase().includes(value.trim().toLowerCase())
  ).slice(0, 6);

  const handleSelectGoogle = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const text =
        place.displayName ||
        place.formattedAddress ||
        suggestion.placePrediction.text.text;
      const loc = place.location;
      onChange(
        text,
        loc ? { lat: loc.lat(), lng: loc.lng() } : undefined
      );
      sessionTokenRef.current = null;
      setGoogleSuggestions([]);
      setOpen(false);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      onChange(suggestion.placePrediction.text.text);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-700 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder || 'e.g., Mysuru, Bengaluru, Chennai'}
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
        />
      </div>

      {open && (googleSuggestions.length > 0 || localMatches.length > 0) && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto py-1">
          {googleSuggestions.map((s, idx) => (
            <li key={`g-${idx}`}>
              <button
                type="button"
                onMouseDown={() => void handleSelectGoogle(s)}
                className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 flex items-center justify-between gap-2"
              >
                <span className="truncate">{s.placePrediction?.text.text}</span>
                <span className="text-[11px] text-slate-400 shrink-0">Places</span>
              </button>
            </li>
          ))}
          {localMatches.map((hub) => (
            <li key={hub.name}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(hub.name, hub.coords);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-emerald-50/60 flex items-center justify-between gap-2"
              >
                <span>{hub.label}</span>
                <span className="text-[11px] text-emerald-700 font-medium shrink-0">
                  Freight Hub
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LocalFallbackAutocomplete({
  label,
  value,
  placeholder,
  onChange,
  required,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const localMatches = CORRIDOR_HUBS.filter(
    (c) =>
      !value.trim() ||
      c.name.toLowerCase().includes(value.trim().toLowerCase()) ||
      c.label.toLowerCase().includes(value.trim().toLowerCase())
  ).slice(0, 7);

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-700 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type="text"
          required={required}
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder || 'e.g., Mysuru, Bengaluru, Chennai'}
          className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700"
        />
      </div>

      {open && localMatches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto py-1">
          {localMatches.map((hub) => (
            <li key={hub.name}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(hub.name, hub.coords);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-emerald-50/60 flex items-center justify-between gap-2"
              >
                <span>{hub.label}</span>
                <span className="text-[11px] text-slate-500 shrink-0">Corridor Hub</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LocationAutocompleteInput(props: Props) {
  const { hasKey } = useMapsConfig();
  if (hasKey) {
    return <PlacesAutocompleteInner {...props} />;
  }
  return <LocalFallbackAutocomplete {...props} />;
}
