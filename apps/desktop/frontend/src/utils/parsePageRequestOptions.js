/**
 * Build requestOptions for parser:parsePage (Playwright extraHTTPHeaders + basic auth).
 */
export function buildParsePageRequestOptions({
  authType,
  authToken,
  authUsername,
  authPassword,
  headerName,
  headerValue,
}) {
  const headers = {};
  if (authType === 'bearer' && authToken != null && String(authToken).trim() !== '') {
    headers.Authorization = `Bearer ${String(authToken).trim()}`;
  }
  if (headerName != null && String(headerName).trim() !== '') {
    headers[String(headerName).trim()] = headerValue != null ? String(headerValue) : '';
  }
  const auth =
    authType === 'basic' && authUsername != null && authPassword != null
      ? { type: 'basic', username: String(authUsername), password: String(authPassword) }
      : null;
  return { headers, auth };
}
