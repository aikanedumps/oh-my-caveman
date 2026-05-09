/**
 * SSRF Guard - URL validation to prevent Server-Side Request Forgery
 *
 * Validates URLs to ensure they don't point to:
 * - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
 * - Loopback (127.x.x.x, localhost)
 * - Link-local (169.254.x.x)
 * - Multicast (224-239.x.x.x)
 * - Reserved/documentations ranges
 */

import dns from 'node:dns';

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
}

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.[0-9]+\.[0-9]+\.[0-9]+$/, // Loopback
  /^10\.[0-9]+\.[0-9]+\.[0-9]+$/, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+$/, // Class B private
  /^192\.168\.[0-9]+\.[0-9]+$/, // Class C private
  /^169\.254\.[0-9]+\.[0-9]+$/, // Link-local
  /^(0|22[4-9]|23[0-9])\.[0-9]+\.[0-9]+\.[0-9]+$/, // Multicast, reserved
  /^\[?::1\]?$/, // IPv6 loopback
  /^\[?fc00:/i, // IPv6 unique local
  /^\[?fe80:/i, // IPv6 link-local
  /^\[?::ffff:/i, // IPv6-mapped IPv4 (all private ranges accessible via this prefix)
  /^\[?0{0,4}:{0,2}ffff:/i, // IPv6-mapped IPv4 expanded forms
];

const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * Validate a URL to prevent SSRF attacks
 * @param urlString The URL to validate
 * @returns SSRFValidationResult indicating if URL is safe
 */
export function validateUrlForSSRF(urlString: string): SSRFValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { allowed: false, reason: 'URL is empty or invalid' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { allowed: false, reason: `Protocol '${parsed.protocol}' is not allowed` };
  }

  const hostname = parsed.hostname.toLowerCase();

  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        allowed: false,
        reason: `Hostname '${hostname}' resolves to a blocked internal/private address`,
      };
    }
  }

  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    return {
      allowed: false,
      reason: `Hostname '${hostname}' looks like a hex-encoded IP address`,
    };
  }

  // Block pure decimal IP notation (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(hostname) && hostname.length > 3) {
    return {
      allowed: false,
      reason: `Hostname '${hostname}' looks like a decimal-encoded IP address`,
    };
  }

  // Block octal IP notation (segments starting with 0, e.g., 0177.0.0.1 = 127.0.0.1)
  if (/^0\d+\./.test(hostname)) {
    return {
      allowed: false,
      reason: `Hostname '${hostname}' looks like an octal-encoded IP address`,
    };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'URLs with embedded credentials are not allowed' };
  }

  // Block specific dangerous paths that could access cloud metadata
  const dangerousPaths = [
    '/metadata',
    '/meta-data',
    '/latest/meta-data',
    '/computeMetadata',
  ];
  const pathLower = parsed.pathname.toLowerCase();
  for (const dangerous of dangerousPaths) {
    if (pathLower.startsWith(dangerous)) {
      return {
        allowed: false,
        reason: `Path '${parsed.pathname}' is blocked (cloud metadata access)`,
      };
    }
  }

  return { allowed: true };
}

// ===========================================================================
// validatedLookup — defense against DNS rebinding for https.request callsites
// ===========================================================================

/**
 * Check if a hostname matches a comma-separated NO_PROXY list pattern.
 * Supports leading-dot suffix matches (".example.com" matches "api.example.com")
 * and exact matches.
 */
function hostMatchesNoProxy(hostname: string, noProxy: string | undefined): boolean {
  if (!noProxy) return false;
  const lower = hostname.toLowerCase();
  for (const raw of noProxy.split(',')) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    if (entry === '*') return true;
    if (entry.startsWith('.')) {
      // Suffix match (".foo.com" matches "x.foo.com" and "foo.com")
      if (lower === entry.slice(1) || lower.endsWith(entry)) return true;
    } else if (lower === entry || lower.endsWith('.' + entry)) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether a proxy is configured AND applies to the given hostname.
 * When true, the proxy controls the actual TCP target — local DNS resolution
 * (and our IP-range validation) becomes advisory rather than authoritative.
 */
function isProxiedHost(hostname: string): boolean {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  if (!httpsProxy && !httpProxy) return false;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (hostMatchesNoProxy(hostname, noProxy)) return false;
  return true;
}

/**
 * Extract the embedded IPv4 dotted-quad from an IPv4-mapped IPv6 string,
 * or return null if the input is not such a mapping.
 *
 * Handles `::ffff:127.0.0.1`, `::ffff:7f00:1` (hex form), and `::a.b.c.d`.
 */
function extractMappedIPv4(addr: string): string | null {
  const lower = addr.toLowerCase().replace(/^\[|\]$/g, '');

  // ::ffff:a.b.c.d  (most common form)
  const dottedMapped = /^(?:0{0,4}:){0,5}ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(lower);
  if (dottedMapped) return dottedMapped[1];

  // ::a.b.c.d  (IPv4-compatible IPv6, deprecated but still possible)
  const compatMapped = /^(?:0{0,4}:){1,6}(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(lower);
  if (compatMapped) return compatMapped[1];

  // ::ffff:HHHH:HHHH (hex form of mapped IPv4)
  const hexMapped = /^(?:0{0,4}:){0,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(lower);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  return null;
}

/** Validate a single resolved IPv4 address against private/loopback/link-local ranges. */
function isBlockedIPv4(addr: string): boolean {
  // Loopback 127.0.0.0/8
  if (/^127\./.test(addr)) return true;
  // Private 10.0.0.0/8
  if (/^10\./.test(addr)) return true;
  // Private 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(addr)) return true;
  // Private 192.168.0.0/16
  if (/^192\.168\./.test(addr)) return true;
  // Link-local 169.254.0.0/16
  if (/^169\.254\./.test(addr)) return true;
  // 0.0.0.0/8 (current network / wildcard)
  if (/^0\./.test(addr)) return true;
  // Multicast 224.0.0.0/4 and reserved 240.0.0.0/4
  if (/^(22[4-9]|23[0-9]|24[0-9]|25[0-5])\./.test(addr)) return true;
  return false;
}

/** Validate a single resolved IPv6 address against private/loopback/link-local ranges. */
function isBlockedIPv6(addr: string): boolean {
  const lower = addr.toLowerCase().replace(/^\[|\]$/g, '');

  // First, peel off any IPv4-mapped form and validate as IPv4.
  const mapped = extractMappedIPv4(lower);
  if (mapped !== null) {
    return isBlockedIPv4(mapped);
  }

  // ::1 loopback (any number of leading zero groups before final :1)
  if (/^(?:0{0,4}:)*:?0{0,3}1$/i.test(lower) || lower === '::1') return true;
  // fc00::/7 unique-local (fc00..fdff)
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // fe80::/10 link-local (fe80..febf)
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  // Unspecified ::
  if (lower === '::' || /^0{0,4}(?::0{0,4})*$/.test(lower)) return true;

  return false;
}

/** Result of address-level validation. */
interface AddressValidation {
  allowed: boolean;
  blockedAddress?: string;
}

function validateResolvedAddress(addr: string, family: number): AddressValidation {
  // Always check for IPv4-mapped IPv6 first — some platforms return
  // ::ffff:1.2.3.4 with family=4, others with family=6. Either way the
  // effective destination is the embedded IPv4 address.
  const mapped = extractMappedIPv4(addr);
  if (mapped !== null) {
    if (isBlockedIPv4(mapped)) return { allowed: false, blockedAddress: addr };
    return { allowed: true };
  }
  if (family === 4) {
    if (isBlockedIPv4(addr)) return { allowed: false, blockedAddress: addr };
    return { allowed: true };
  }
  // family === 6 (or 0 — unknown)
  if (isBlockedIPv6(addr)) return { allowed: false, blockedAddress: addr };
  return { allowed: true };
}

/**
 * https.request-compatible DNS lookup that rejects private/loopback/link-local
 * addresses to defend against DNS rebinding attacks.
 *
 * Resolves ALL addresses for the hostname (dns.lookup with {all: true}) and
 * fails closed if any returned address is in a blocked range. This prevents
 * an attacker-controlled DNS server from returning a public IP at validation
 * time and a private IP at connection time.
 *
 * Trust boundaries:
 * - When HTTPS_PROXY/HTTP_PROXY is set AND NO_PROXY does not exempt the
 *   target host, IP-range validation is skipped because the proxy — not
 *   our resolved address — controls the actual TCP target. This is a
 *   deliberate "trust the deployer's proxy config" stance, not a security
 *   guarantee. Operators who want strict validation behind a proxy should
 *   set NO_PROXY to include the proxied host.
 * - When OMC_SSRF_ALLOW_PRIVATE=1, IP-range validation is disabled so that
 *   self-hosted corporate deployments can target internal hosts. The
 *   hostname-level checks in `validateUrlForSSRF` (which run before
 *   `https.request` is even called) still apply.
 *
 * Signature mirrors Node's `dns.lookup` callback contract used by
 * `https.request({lookup})`: when `options.all` is true, the callback receives
 * an array of `{address, family}`; otherwise it receives `(address, family)`.
 */
// The callback shape `https.request({lookup})` actually invokes is the union
// of both single-address and all-addresses forms. We declare it loosely so the
// function is assignable to Node's `LookupFunction` type.
type ValidatedLookupCallback = (
  err: NodeJS.ErrnoException | null,
  addressOrAddresses: string | dns.LookupAddress[],
  family?: number,
) => void;

export function validatedLookup(
  hostname: string,
  options: dns.LookupOptions | dns.LookupOneOptions | number,
  callback: ValidatedLookupCallback,
): void {
  // Normalize the options arg — Node's dns.lookup accepts a number (family),
  // an object, or undefined. We always resolve with {all:true} so we can
  // inspect every candidate, then format the response per caller's request.
  let optsObj: dns.LookupOptions;
  if (typeof options === 'number') {
    optsObj = { family: options };
  } else if (options && typeof options === 'object') {
    optsObj = options;
  } else {
    optsObj = {};
  }
  const wantAll = optsObj.all === true;
  const wantFamily = typeof optsObj.family === 'number' ? optsObj.family : 0;

  // Helper: deliver an error in a way that satisfies both single and all-form
  // callback shapes. The address arg is unused on error paths but kept
  // non-undefined so the signature is assignable to Node's `LookupFunction`.
  const deliverError = (e: NodeJS.ErrnoException) => {
    if (wantAll) callback(e, []);
    else callback(e, '', 0);
  };

  dns.lookup(hostname, { all: true, family: wantFamily, hints: optsObj.hints }, (err, addresses) => {
    if (err) {
      deliverError(err);
      return;
    }
    if (!addresses || addresses.length === 0) {
      const e: NodeJS.ErrnoException = new Error(
        `[SSRF Guard] DNS lookup for '${hostname}' returned no addresses`,
      );
      e.code = 'ENOTFOUND';
      deliverError(e);
      return;
    }

    const allowPrivate = process.env.OMC_SSRF_ALLOW_PRIVATE === '1';
    const proxied = isProxiedHost(hostname);

    // If neither escape hatch applies, validate every address — fail closed
    // on the first blocked one to defeat dual-stack rebinding tricks.
    if (!allowPrivate && !proxied) {
      for (const a of addresses) {
        const v = validateResolvedAddress(a.address, a.family);
        if (!v.allowed) {
          const e: NodeJS.ErrnoException = new Error(
            `[SSRF Guard] Hostname '${hostname}' resolved to blocked address '${v.blockedAddress}' (private/loopback/link-local). Refusing connection to prevent DNS rebinding.`,
          );
          e.code = 'EAI_BLOCKED';
          deliverError(e);
          return;
        }
      }
    }

    if (wantAll) {
      callback(null, addresses);
      return;
    }
    const first = addresses[0];
    callback(null, first.address, first.family);
  });
}

/**
 * Validate ANTHROPIC_BASE_URL for safe usage
 * This is a convenience function that also enforces HTTPS preference
 */
export function validateAnthropicBaseUrl(urlString: string): SSRFValidationResult {
  const result = validateUrlForSSRF(urlString);
  if (!result.allowed) {
    return result;
  }

  // Prefer HTTPS but don't block HTTP for local development
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  // Log warning for HTTP (non-HTTPS) in production contexts
  if (parsed.protocol === 'http:') {
    console.warn('[SSRF Guard] Warning: Using HTTP instead of HTTPS for ANTHROPIC_BASE_URL');
  }

  return { allowed: true };
}
