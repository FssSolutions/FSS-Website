// GET /api/reviews — your latest Google reviews, for the Reviews block on the live site.
//
// Uses Google's Places API (New). Set in Cloudflare (Settings → Variables and Secrets):
//   GOOGLE_PLACES_API_KEY  (secret)  API key restricted to "Places API (New)"
//   GOOGLE_PLACE_ID        (text)    your Place ID (starts with "ChIJ"). Optional: if it is
//                                    missing, this looks the business up by name and shows
//                                    the ID it found, so you can copy it in.
//   GOOGLE_PLACE_QUERY     (text)    optional, name to look up (default "FSS Solutions Vancouver")
//
// Reviews are fetched fresh from Google (browsers keep them for an hour); nothing is stored.
import { json } from '../../cloud/github.js';

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl|wget|python|headless/i;
const API = 'https://places.googleapis.com/v1/';

export async function onRequestGet({ request, env }) {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) return json({ configured: false });
  // Search engines see the reviews written into the page; don't spend Google lookups on bots.
  if (BOTS.test(request.headers.get('User-Agent') || '')) return json({ skipped: true });

  let placeId = env.GOOGLE_PLACE_ID || '';
  let found = null;
  try {
    if (!placeId) {
      const res = await fetch(API + 'places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName' },
        body: JSON.stringify({ textQuery: env.GOOGLE_PLACE_QUERY || 'FSS Solutions Vancouver', regionCode: 'CA' })
      });
      const d = await res.json();
      if (!res.ok) return json({ error: 'Google: ' + ((d.error && d.error.message) || res.status) }, 502);
      const place = (d.places || [])[0];
      if (!place) return json({ error: 'Business not found on Google. Set GOOGLE_PLACE_ID.' }, 404);
      placeId = place.id;
      found = { placeId, name: place.displayName && place.displayName.text };
    }
    const res = await fetch(API + 'places/' + encodeURIComponent(placeId) + '?languageCode=en', {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri,googleMapsLinks' }
    });
    const d = await res.json();
    if (!res.ok) return json({ error: 'Google: ' + ((d.error && d.error.message) || res.status) }, 502);
    const links = d.googleMapsLinks || {};
    const out = {
      found, // shown only while GOOGLE_PLACE_ID is not set, so you can copy the ID
      rating: d.rating,
      count: d.userRatingCount,
      url: links.reviewsUri || d.googleMapsUri || '',
      writeUrl: links.writeAReviewUri || '',
      reviews: (d.reviews || []).map(r => {
        const a = r.authorAttribution || {};
        return {
          author: a.displayName || 'Google user',
          authorUrl: a.uri || '',
          photo: a.photoUri || '',
          rating: r.rating,
          text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '',
          when: r.relativePublishTimeDescription || '',
          time: r.publishTime || ''
        };
      })
    };
    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=3600' }
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
