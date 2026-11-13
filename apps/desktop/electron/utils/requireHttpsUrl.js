/**
 * Enforce https:// for user-facing web URLs (pages, API bases, Swagger, requests).
 */

function assertHttpsWebUrl(str, { allowEmpty = false, fieldName = 'URL' } = {}) {
  const s = str != null ? String(str).trim() : '';
  if (s === '') {
    if (allowEmpty) return;
    throw new Error(`${fieldName} is required and must use https://`);
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`${fieldName} must be a valid https:// URL`);
  }
  if (u.protocol !== 'https:') {
    throw new Error(`${fieldName} must use https:// only (not ${u.protocol})`);
  }
}

/** Full request/navigation URL after substitution — must be https. */
function assertHttpsRequestUrl(urlString, context = 'Request URL') {
  const s = String(urlString || '').trim();
  if (!s) throw new Error(`${context} is empty`);
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`${context} is not a valid absolute URL`);
  }
  if (u.protocol !== 'https:') {
    throw new Error(`${context} must use https:// only`);
  }
}

/** Page open URL: https or about:blank. */
function assertHttpsOrAboutBlank(url, fieldName = 'Page URL') {
  const s = String(url || '').trim();
  if (!s || s === 'about:blank') return;
  assertHttpsWebUrl(s, { allowEmpty: false, fieldName });
}

module.exports = {
  assertHttpsWebUrl,
  assertHttpsRequestUrl,
  assertHttpsOrAboutBlank,
};
