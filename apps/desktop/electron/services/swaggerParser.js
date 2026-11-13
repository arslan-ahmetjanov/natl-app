const axios = require('axios');
const fs = require('fs');
const filestore = require('../store/filestore');
const { assertHttpsWebUrl } = require('../utils/requireHttpsUrl');

/**
 * Fetch Swagger/OpenAPI JSON from URL or use provided object.
 */
function buildAxiosAuthOptions(requestOptions = {}) {
  const headers = requestOptions && requestOptions.headers && typeof requestOptions.headers === 'object'
    ? requestOptions.headers
    : {};
  const auth = requestOptions && requestOptions.auth && typeof requestOptions.auth === 'object'
    ? requestOptions.auth
    : null;
  const axiosOptions = { headers };
  if (auth && auth.type === 'basic' && auth.username != null && auth.password != null) {
    axiosOptions.auth = { username: String(auth.username), password: String(auth.password) };
  }
  return axiosOptions;
}

async function fetchSwaggerSpec(urlOrSpec, requestOptions = {}) {
  if (urlOrSpec && typeof urlOrSpec === 'object' && urlOrSpec.mode === 'file' && urlOrSpec.filePath) {
    const raw = fs.readFileSync(String(urlOrSpec.filePath), 'utf8');
    return JSON.parse(raw);
  }
  if (typeof urlOrSpec === 'string') {
    const trimmed = urlOrSpec.trim();
    if (trimmed.startsWith('https://')) {
      const res = await axios.get(trimmed, {
        timeout: 15000,
        ...buildAxiosAuthOptions(requestOptions),
      });
      return res.data;
    }
    if (trimmed.startsWith('http://')) {
      throw new Error('Swagger URL must use https://');
    }
  }
  if (typeof urlOrSpec === 'object' && urlOrSpec !== null) return urlOrSpec;
  throw new Error('Invalid Swagger source: URL or JSON object required');
}

/**
 * Parse OpenAPI 2 (Swagger) or 3 spec into a list of endpoint descriptors.
 */
function parsePaths(spec) {
  const paths = spec.paths || {};
  const baseUrl = spec.servers?.[0]?.url || spec.host ? `${spec.schemes?.[0] || 'https'}://${spec.host}${(spec.basePath || '')}` : '';
  const list = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (typeof pathItem !== 'object' || pathItem === null) continue;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of methods) {
      const op = pathItem[method];
          if (!op) continue;
          const summary = op.summary || op.description || `${method.toUpperCase()} ${path}`;
          const parameters = op.parameters || pathItem.parameters || [];
          const requestBody = op.requestBody != null
            ? (typeof op.requestBody.content === 'object' && op.requestBody.content['application/json']
                ? op.requestBody.content['application/json'].schema
                : op.requestBody)
            : null;
          list.push({
            method: method.toUpperCase(),
            path,
            summary: typeof summary === 'string' ? summary : '',
            baseUrl,
            parameters: Array.isArray(parameters) ? parameters : [],
            requestBody: requestBody || null,
            responses: op.responses || {},
          });
    }
  }
  return list;
}

/**
 * Import Swagger from URL or JSON: create one API base (baseUrl from servers) and endpoints linked via baseId.
 */
async function importSwagger(workspacePath, urlOrSpec, requestOptions = {}) {
  const spec = await fetchSwaggerSpec(urlOrSpec, requestOptions);
  const baseUrl = spec.servers?.[0]?.url || (spec.host ? `${spec.schemes?.[0] || 'https'}://${spec.host}${(spec.basePath || '')}` : '');
  const normalizedBase = baseUrl.replace(/\/$/, '');
  if (!normalizedBase) {
    throw new Error('OpenAPI spec has no server URL; add an https:// server');
  }
  assertHttpsWebUrl(normalizedBase, { allowEmpty: false, fieldName: 'API base URL from OpenAPI servers' });
  const apiBase = filestore.createBase(workspacePath, {
    title: spec.info?.title || 'Imported API',
    baseUrl: normalizedBase,
  });
  const parsed = parsePaths(spec);
  const created = [];
  for (const p of parsed) {
    const endpoint = filestore.createEndpoint(workspacePath, {
      title: `${p.method} ${p.path}`,
      method: p.method,
      path: p.path,
      summary: p.summary,
      baseId: apiBase.id,
      baseUrl: '',
      parameters: p.parameters,
      requestBody: p.requestBody,
      responses: p.responses,
    });
    created.push(endpoint);
  }
  return created;
}

module.exports = { fetchSwaggerSpec, parsePaths, importSwagger };
