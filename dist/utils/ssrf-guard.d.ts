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
/**
 * Validate a URL to prevent SSRF attacks
 * @param urlString The URL to validate
 * @returns SSRFValidationResult indicating if URL is safe
 */
export declare function validateUrlForSSRF(urlString: string): SSRFValidationResult;
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
type ValidatedLookupCallback = (err: NodeJS.ErrnoException | null, addressOrAddresses: string | dns.LookupAddress[], family?: number) => void;
export declare function validatedLookup(hostname: string, options: dns.LookupOptions | dns.LookupOneOptions | number, callback: ValidatedLookupCallback): void;
/**
 * Validate ANTHROPIC_BASE_URL for safe usage
 * This is a convenience function that also enforces HTTPS preference
 */
export declare function validateAnthropicBaseUrl(urlString: string): SSRFValidationResult;
export {};
//# sourceMappingURL=ssrf-guard.d.ts.map