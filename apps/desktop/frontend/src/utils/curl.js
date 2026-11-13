import fetchToCurl from 'fetch-to-curl';
import { HTTPSnippet } from 'httpsnippet-lite';

/** Lazy: curlconverter pulls web-tree-sitter + WASM; static import blocked WorkspaceView from loading in Electron. */
let curlconverterLoad = null;
function getCurlconverter() {
  if (!curlconverterLoad) curlconverterLoad = import('curlconverter');
  return curlconverterLoad;
}

function objectToHar(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value: value != null ? String(value) : '',
  }));
}

/**
 * Split absolute URL into pathname and query object.
 */
export function splitUrl(url) {
  if (!url || typeof url !== 'string') {
    return { path: '/', query: {}, origin: '' };
  }
  try {
    const u = new URL(url);
    const query = {};
    u.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    return {
      path: u.pathname || '/',
      query,
      origin: u.origin,
    };
  } catch {
    return { path: url.startsWith('/') ? url : `/${url}`, query: {}, origin: '' };
  }
}

/**
 * Parse cURL into editor-friendly shape (via curlconverter).
 */
export async function parseCurl(curlString) {
  const trimmed = curlString.trim();
  if (!trimmed.toLowerCase().startsWith('curl')) {
    throw new Error('Command must start with curl');
  }
  const { toJsonObject } = await getCurlconverter();
  const j = toJsonObject(trimmed);
  const method = (j.method || 'GET').toUpperCase();
  let url = j.url || j.raw_url || '';

  const headers = {};
  if (j.headers && typeof j.headers === 'object') {
    for (const [k, v] of Object.entries(j.headers)) {
      if (v != null && v !== '') headers[k] = String(v);
    }
  }

  const query = {};
  if (j.queries && typeof j.queries === 'object') {
    for (const [k, v] of Object.entries(j.queries)) {
      if (Array.isArray(v)) query[k] = v[0] != null ? String(v[0]) : '';
      else query[k] = v != null ? String(v) : '';
    }
  }
  try {
    const u = new URL(url);
    if (Object.keys(query).length === 0 && u.search) {
      u.searchParams.forEach((val, key) => {
        query[key] = val;
      });
    }
  } catch {
    /* ignore */
  }

  let auth = { type: 'none', token: '', username: '', password: '' };
  const authHdr = headers.Authorization || headers.authorization;
  if (authHdr && /^Bearer\s+/i.test(authHdr)) {
    auth = {
      type: 'bearer',
      token: authHdr.replace(/^Bearer\s+/i, '').trim(),
      username: '',
      password: '',
    };
    delete headers.Authorization;
    delete headers.authorization;
  } else if (authHdr && /^Basic\s+/i.test(authHdr)) {
    try {
      const b64 = authHdr.replace(/^Basic\s+/i, '').trim();
      const decoded = atob(b64);
      const idx = decoded.indexOf(':');
      auth = {
        type: 'basic',
        token: '',
        username: idx >= 0 ? decoded.slice(0, idx) : decoded,
        password: idx >= 0 ? decoded.slice(idx + 1) : '',
      };
    } catch {
      auth = { type: 'basic', username: '', password: '', token: '' };
    }
    delete headers.Authorization;
    delete headers.authorization;
  } else if (j.auth && j.auth.user) {
    auth = {
      type: 'basic',
      username: j.auth.user,
      password: j.auth.password || '',
      token: '',
    };
  }

  const ct = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
  let bodyMode = 'none';
  let rawBody = '';
  let rawSubtype = 'json';
  /** @type {{ key: string, value: string, fieldType: string }[]} */
  let formFields = [{ key: '', value: '', fieldType: 'text' }];

  const hasFiles = j.files && typeof j.files === 'object' && Object.keys(j.files).length > 0;

  if (hasFiles) {
    bodyMode = 'form-data';
    formFields = Object.entries(j.files).map(([name, pathVal]) => ({
      key: name,
      value: String(pathVal),
      fieldType: 'file',
    }));
  } else if (j.data != null && j.data !== '') {
    if (typeof j.data === 'object' && !Array.isArray(j.data)) {
      if (ct.includes('application/x-www-form-urlencoded')) {
        bodyMode = 'x-www-form-urlencoded';
        formFields = Object.entries(j.data).map(([k, v]) => ({
          key: k,
          value: String(v),
          fieldType: 'text',
        }));
      } else if (ct.includes('multipart')) {
        bodyMode = 'form-data';
        formFields = Object.entries(j.data).map(([k, v]) => ({
          key: k,
          value: String(v),
          fieldType: 'text',
        }));
      } else {
        bodyMode = 'raw';
        rawBody = JSON.stringify(j.data, null, 2);
        rawSubtype = 'json';
      }
    } else if (typeof j.data === 'string') {
      if (ct.includes('multipart')) {
        bodyMode = 'form-data';
        rawBody = j.data;
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        bodyMode = 'x-www-form-urlencoded';
        const params = new URLSearchParams(j.data);
        const pRows = [];
        params.forEach((val, key) => {
          pRows.push({ key, value: val, fieldType: 'text' });
        });
        formFields = pRows.length ? pRows : [{ key: '', value: '', fieldType: 'text' }];
      } else {
        bodyMode = 'raw';
        rawBody = j.data;
        rawSubtype = ct.includes('json') ? 'json' : 'text';
      }
    }
  }

  if (method === 'GET' || method === 'HEAD') {
    bodyMode = 'none';
  }

  return {
    method,
    url,
    headers,
    query,
    auth,
    bodyMode,
    rawBody,
    rawSubtype,
    formFields: formFields.length ? formFields : [{ key: '', value: '', fieldType: 'text' }],
  };
}

/**
 * Build cURL string from editor state.
 */
export async function generateCurl(opts) {
  const {
    method = 'GET',
    url,
    headers = {},
    query = {},
    bodyMode = 'none',
    rawBody = '',
    formFields = [],
    auth,
    rawSubtype = 'json',
  } = opts;

  let fullUrl = url;
  try {
    const u = new URL(url);
    const base = `${u.origin}${u.pathname}`;
    const search = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k != null && String(k).trim() !== '') search.set(String(k).trim(), v != null ? String(v) : '');
    });
    const qs = search.toString();
    fullUrl = qs ? `${base}?${qs}` : base;
  } catch {
    const qs = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => {
      if (k != null && String(k).trim() !== '') qs.append(String(k).trim(), v != null ? String(v) : '');
    });
    const qstr = qs.toString();
    fullUrl = qstr ? `${url}?${qstr}` : url;
  }

  let hdrs = { ...headers };
  const m = method.toUpperCase();

  if (auth?.type === 'bearer' && auth.token) {
    hdrs.Authorization = `Bearer ${auth.token}`;
  } else if (auth?.type === 'basic' && auth.username != null) {
    const raw = `${auth.username}:${auth.password || ''}`;
    const enc = btoa(unescape(encodeURIComponent(raw)));
    hdrs.Authorization = `Basic ${enc}`;
  }

  /** @type {{ mimeType?: string, text?: string|null, params?: { name: string, value: string }[] }} */
  let postData = { mimeType: undefined, text: null };

  if (bodyMode === 'raw' && rawBody) {
    const ct =
      hdrs['Content-Type'] ||
      hdrs['content-type'] ||
      (rawSubtype === 'json' ? 'application/json' : 'text/plain');
    postData = { mimeType: ct, text: rawBody };
    hdrs['Content-Type'] = ct;
  } else if (bodyMode === 'x-www-form-urlencoded') {
    const obj = {};
    for (const row of formFields) {
      const k = row.key != null ? String(row.key).trim() : '';
      if (k) obj[k] = row.value != null ? String(row.value) : '';
    }
    postData = {
      mimeType: 'application/x-www-form-urlencoded',
      params: objectToHar(obj),
    };
    hdrs['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (bodyMode === 'form-data') {
    const obj = {};
    for (const row of formFields) {
      const k = row.key != null ? String(row.key).trim() : '';
      if (k) obj[k] = row.fieldType === 'file' ? `@${row.value}` : String(row.value ?? '');
    }
    postData = {
      mimeType: 'multipart/form-data',
      params: objectToHar(obj),
    };
  }

  if (m === 'GET' || m === 'HEAD') {
    delete hdrs['Content-Type'];
    delete hdrs['content-type'];
  }

  try {
    const snippet = new HTTPSnippet({
      url: fullUrl,
      method: m,
      headers: objectToHar(hdrs),
      postData,
    });
    const curlResolve = await snippet.convert('shell', 'curl', {});
    const s = Array.isArray(curlResolve) ? curlResolve[0] : curlResolve;
    if (typeof s === 'string' && s.startsWith('curl ')) {
      return s.replace(/(\r\n|\n|\r)/g, '');
    }
  } catch (e) {
    console.warn('HTTPSnippet failed', e);
  }

  let bodyForFetch = undefined;
  if (bodyMode === 'raw' && rawBody) bodyForFetch = rawBody;
  else if (bodyMode === 'x-www-form-urlencoded') {
    const params = new URLSearchParams();
    for (const row of formFields) {
      const k = row.key != null ? String(row.key).trim() : '';
      if (k) params.append(k, row.value != null ? String(row.value) : '');
    }
    bodyForFetch = params.toString();
    hdrs['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const rawCurl = fetchToCurl({
    url: fullUrl,
    body: bodyForFetch,
    headers: hdrs,
    method: m,
  });
  return rawCurl.replace(/(\r\n|\n|\r)/g, '');
}
