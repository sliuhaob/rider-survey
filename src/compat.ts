// Older mobile webviews have getRandomValues but no randomUUID.
export function submissionId(): string {
 const bytes = new Uint8Array(16);
 crypto.getRandomValues(bytes);
 bytes[6] = (bytes[6] & 15) | 64;
 bytes[8] = (bytes[8] & 63) | 128;
 const hex = Array.from(bytes, byte => ('0' + byte.toString(16)).slice(-2));
 return hex.slice(0,4).join('')+'-'+hex.slice(4,6).join('')+'-'+hex.slice(6,8).join('')+'-'+hex.slice(8,10).join('')+'-'+hex.slice(10).join('');
}

// Do not depend on the newer AbortSignal.timeout static method.
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
 const controller = new AbortController();
 const timer = window.setTimeout(() => controller.abort(), ms);
 try {
  return await fetch(url, {...init, signal: controller.signal});
 } finally {
  window.clearTimeout(timer);
 }
}
