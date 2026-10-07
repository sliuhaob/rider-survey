const allowed = new Set(['https://survey.roxy-design.com','https://survey-api.roxy-design.com','https://sliuhaob.github.io','http://127.0.0.1:5173','http://127.0.0.1:4173','http://127.0.0.1:8787']);
type Environment = {LOCAL_DEVELOPMENT?: string};
export function originAllowed(origin: string, url: URL, env: Environment): boolean {
 // Let already-open HTTP questionnaires follow the method-preserving upgrade
 // and finish their existing draft. This does not grant access to admin export.
 if (origin === 'http://survey.roxy-design.com' && url.protocol === 'https:' &&
     ['survey.roxy-design.com','survey-api.roxy-design.com'].includes(url.hostname) &&
     url.pathname === '/api/responses') return true;
 const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
 return allowed.has(origin) && (!origin.startsWith('http:') || local || env.LOCAL_DEVELOPMENT === 'true');
}

export function requestAllowed(request: Request, url: URL, env: Environment): boolean {
 const origin = request.headers.get('Origin');
 // Explicit foreign origins and opaque/absent preflights never use a fallback.
 if (origin && origin !== 'null') return originAllowed(origin, url, env);
 if (request.method !== 'POST' || !originAllowed(url.origin, url, env)) return false;
 const site = request.headers.get('Sec-Fetch-Site');
 if (site && site !== 'same-origin') return false;
 const referer = request.headers.get('Referer');
 if (referer) {
  try { return new URL(referer).origin === url.origin; }
  catch { return false; }
 }
 if (site === 'same-origin') return true;
 // Privacy modes can omit both browser headers. This non-simple header is
 // gated by CORS preflight for foreign pages; it is not an authentication key.
 return url.pathname === '/api/responses' &&
  request.headers.get('X-Survey-Request') === '1' &&
  request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() === 'application/json';
}
