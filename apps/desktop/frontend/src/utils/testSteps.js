export const BODY_PREVIEW_LEN = 100;

export const AUTH_STEP_OPTIONS = [
  { value: '', label: 'Use endpoint default' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
];

export function queryRows(step) {
  const q = step.query && typeof step.query === 'object' ? step.query : {};
  const arr = Object.entries(q).map(([k, v]) => ({ key: k, value: v != null ? String(v) : '' }));
  return arr.length ? arr : [{ key: '', value: '' }];
}

export function headerRows(step) {
  const h = step.headers && typeof step.headers === 'object' ? step.headers : {};
  const arr = Object.entries(h).map(([k, v]) => ({ key: k, value: v != null ? String(v) : '' }));
  return arr.length ? arr : [{ key: '', value: '' }];
}

export function elementOptionValue(pageId, webElementId) {
  return pageId && webElementId ? `${pageId}|${webElementId}` : webElementId || '';
}

export function isStepApi(step) {
  return step.type === 'api' || ['request', 'assertStatus', 'assertBody'].includes(step.type);
}

export function getStepApiAction(step) {
  return step.type === 'api' ? step.actionId || 'request' : step.type;
}

export function bodyStringForPreview(step) {
  if (typeof step.body === 'string') return step.body || '{}';
  if (step.body) return JSON.stringify(step.body, null, 2);
  return '{}';
}

/**
 * Short label for step card header (test or shared editor).
 */
export function getStepSummaryLine(step, ctx) {
  const { sharedCatalog = [], elementsWithPage = [], actions = [], endpoints = [], defaultPageId, pages = [] } = ctx;

  if (step.sharedStepId) {
    const s = sharedCatalog.find((x) => x.id === step.sharedStepId);
    return s?.title ? `Shared: ${s.title}` : `Shared: ${step.sharedStepId}`;
  }
  if (isStepApi(step)) {
    const apiAction = getStepApiAction(step);
    if (apiAction === 'request') {
      const ep = endpoints.find((e) => e.id === (step.endpointId ?? step.targetId));
      if (ep) return `${ep.method} ${ep.path}`;
      return 'HTTP request';
    }
    if (apiAction === 'assertStatus') return `Assert status ${step.value ?? '200'}`;
    if (apiAction === 'assertBody') return `Assert body ${step.jsonPath || '…'}`;
    return 'API step';
  }
  const pageId = step.pageId || defaultPageId;
  const el =
    elementsWithPage.find((e) => e.id === step.webElementId && (!pageId || e.pageId === pageId)) ||
    elementsWithPage.find((e) => e.id === step.webElementId);
  const act = actions.find((a) => a.id === step.actionId);
  const target = el ? el.title || el.selector : 'Element';
  const verb = act?.name || 'Action';
  const pageMeta = pageId ? pages.find((p) => p.id === pageId) : null;
  const pageLabel = pageMeta ? pageMeta.title || pageMeta.url || pageMeta.id : null;
  if (pageLabel && pages.length > 1) return `${verb} — ${pageLabel} — ${target}`;
  return `${verb} — ${target}`;
}

export function resolveBaseUrl(endpoint, apiBases) {
  if (!endpoint) return '';
  const bid = endpoint.baseId;
  const base = Array.isArray(apiBases) ? apiBases.find((b) => b.id === bid) : null;
  return (base?.baseUrl || endpoint.baseUrl || '').trim().replace(/\/+$/, '');
}

/** Query params from endpoint.parameters (Swagger-style array). */
export function endpointParametersToQueryObject(parameters) {
  const out = {};
  if (!Array.isArray(parameters)) return out;
  for (const p of parameters) {
    if (!p || !p.name) continue;
    if (p.in && p.in !== 'query') continue;
    out[p.name] = p.value != null ? String(p.value) : '';
  }
  return out;
}

export function buildFullRequestUrl(endpoint, step, apiBases) {
  const base = resolveBaseUrl(endpoint, apiBases);
  const path = endpoint?.path || '/';
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  const q = {
    ...endpointParametersToQueryObject(endpoint?.parameters),
    ...((step && step.query) || {}),
  };
  const qs = new URLSearchParams(q).toString();
  const suffix = qs ? `${pathPart}?${qs}` : pathPart;
  if (!base) return suffix;
  return `${base}${suffix}`;
}

function normalizeAuthForEditor(a) {
  if (!a || a.type === 'none' || !a.type) {
    return { type: 'none', token: '', username: '', password: '' };
  }
  if (a.type === 'bearer') {
    return { type: 'bearer', token: a.token ?? '', username: '', password: '' };
  }
  if (a.type === 'basic') {
    return {
      type: 'basic',
      token: '',
      username: a.username ?? '',
      password: a.password ?? '',
    };
  }
  return { type: 'none', token: '', username: '', password: '' };
}

function normalizeFormFieldsBody(body) {
  if (!body) return [{ key: '', value: '', fieldType: 'text' }];
  if (Array.isArray(body)) {
    const rows = body.map((row) => ({
      key: String(row.key ?? row.name ?? ''),
      value: row.value != null ? String(row.value) : '',
      fieldType: row.fieldType === 'file' || row.type === 'file' ? 'file' : 'text',
    }));
    return rows.filter((r) => r.key || r.value).length ? rows : [{ key: '', value: '', fieldType: 'text' }];
  }
  if (typeof body === 'object') {
    return Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      fieldType: 'text',
    }));
  }
  return [{ key: '', value: '', fieldType: 'text' }];
}

/**
 * Initial snapshot for ApiRequestEditor (step variant).
 */
export function buildApiStepEditorInitial(endpoint, step, apiBases) {
  if (!endpoint) {
    return {
      method: 'GET',
      requestUrl: '',
      paramRows: [{ key: '', value: '' }],
      headerRows: [{ key: '', value: '' }],
      auth: { type: 'none', token: '', username: '', password: '' },
      bodyMode: 'none',
      rawBody: '',
      rawSubtype: 'json',
      formFields: [{ key: '', value: '', fieldType: 'text' }],
      baselineMethod: 'GET',
      baselinePath: '/',
    };
  }

  const epHeaders = endpoint.headers && typeof endpoint.headers === 'object' ? endpoint.headers : {};
  const stHeaders = step?.headers && typeof step.headers === 'object' ? step.headers : {};
  const mergedHeaders = { ...epHeaders, ...stHeaders };

  const epQ = endpointParametersToQueryObject(endpoint.parameters);
  const stQ = step?.query && typeof step.query === 'object' ? step.query : {};
  const mergedQ = { ...epQ, ...stQ };

  const auth =
    step?.auth !== undefined && step?.auth !== null
      ? step.auth
      : endpoint.auth || { type: 'none' };

  const bodyMode = step?.bodyMode ?? endpoint.bodyMode ?? 'none';

  let rawBody = '';
  if (typeof step?.body === 'string') {
    rawBody = step.body;
  } else if (step?.body && typeof step.body === 'object' && !Array.isArray(step.body)) {
    rawBody = JSON.stringify(step.body, null, 2);
  } else if (bodyMode === 'raw') {
    if (typeof endpoint.body === 'string') rawBody = endpoint.body;
    else if (endpoint.requestBody != null) {
      rawBody =
        typeof endpoint.requestBody === 'string'
          ? endpoint.requestBody
          : JSON.stringify(endpoint.requestBody, null, 2);
    } else if (endpoint.body && typeof endpoint.body === 'object') {
      rawBody = JSON.stringify(endpoint.body, null, 2);
    }
  }

  const formFields =
    bodyMode === 'x-www-form-urlencoded' || bodyMode === 'form-data'
      ? normalizeFormFieldsBody(step?.body ?? endpoint.body)
      : [{ key: '', value: '', fieldType: 'text' }];

  const paramRows = Object.keys(mergedQ).length
    ? Object.entries(mergedQ).map(([key, value]) => ({ key, value }))
    : [{ key: '', value: '' }];

  const headerRows = Object.keys(mergedHeaders).length
    ? Object.entries(mergedHeaders).map(([key, value]) => ({ key, value: String(value) }))
    : [{ key: '', value: '' }];

  return {
    method: (endpoint.method || 'GET').toUpperCase(),
    requestUrl: buildFullRequestUrl(endpoint, step, apiBases),
    paramRows,
    headerRows,
    auth: normalizeAuthForEditor(auth),
    bodyMode,
    rawBody,
    rawSubtype: 'json',
    formFields,
    baselineMethod: (endpoint.method || 'GET').toUpperCase(),
    baselinePath: endpoint.path || '/',
  };
}

/** One-line preview for collapsed API step card. */
export function getApiRequestDetailPreview(endpoint, step) {
  const epLine = endpoint ? `${endpoint.method} ${endpoint.path}` : 'HTTP';
  const mode = step?.bodyMode ?? endpoint?.bodyMode ?? 'none';
  if (mode === 'none') return epLine;
  let b = '';
  if (typeof step?.body === 'string') b = step.body;
  else if (step?.body) b = JSON.stringify(step.body);
  else if (typeof endpoint?.body === 'string') b = endpoint.body;
  else if (endpoint?.body) b = JSON.stringify(endpoint.body);
  const short = (b || '').length > 80 ? `${(b || '').slice(0, 80)}…` : b || '';
  return short ? `${epLine} · ${short}` : epLine;
}
