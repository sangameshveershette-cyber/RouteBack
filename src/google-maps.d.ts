declare namespace google {
  namespace maps {
    interface LatLng {
      lat(): number;
      lng(): number;
    }

    interface LatLngBounds {
      extend(point: LatLng | { lat: number; lng: number }): void;
    }

    interface PolylineOptions {
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }

    class Polyline {
      setMap(map: unknown): void;
      setOptions(options: PolylineOptions): void;
    }

    namespace places {
      class AutocompleteSessionToken {}

      interface PlaceResult {
        displayName?: string;
        formattedAddress?: string;
        location?: LatLng;
        fetchFields(options: { fields: string[] }): Promise<void>;
      }

      interface PlacePrediction {
        text: { text: string };
        toPlace(): PlaceResult;
      }

      interface AutocompleteSuggestion {
        placePrediction?: PlacePrediction;
      }

      class AutocompleteSuggestionApi {
        static fetchAutocompleteSuggestions(request: {
          input: string;
          sessionToken?: AutocompleteSessionToken;
          includedRegionCodes?: string[];
        }): Promise<{ suggestions: AutocompleteSuggestion[] }>;
      }
    }
  }
}
