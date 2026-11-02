/**
 * Election Campaign OS — public site, map links for a voting station
 *
 * These are SEARCH links, not coordinates. This build holds station names
 * but no verified latitude and longitude for any of them, and a pin it
 * guessed would send a voter to the wrong place. A name search finds the
 * place when the map service knows it by that name, and the page says to
 * confirm the station with the Electoral Commission.
 *
 * No request is made from the page; the links open in the visitor's own
 * map app. Directions omit the starting point, so the map service uses the
 * visitor's current location if they allow it.
 */
export interface MapLinks {
  google: string;
  googleDirections: string;
  apple: string;
  waze: string;
}

export function stationMapLinks(stationName: string, place: string): MapLinks {
  const query = `${stationName.trim()}, ${place.trim()}, South Africa`;
  const q = encodeURIComponent(query);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}
