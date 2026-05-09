import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateUrlForSSRF, validateAnthropicBaseUrl, validatedLookup } from '../utils/ssrf-guard.js';
import dns from 'node:dns';
describe('SSRF Guard', () => {
    describe('validateUrlForSSRF', () => {
        describe('blocks private/internal IPs', () => {
            it('blocks localhost', () => {
                expect(validateUrlForSSRF('http://localhost/api')).toEqual({
                    allowed: false,
                    reason: "Hostname 'localhost' resolves to a blocked internal/private address",
                });
            });
            it('blocks 127.0.0.1', () => {
                expect(validateUrlForSSRF('http://127.0.0.1/api')).toEqual({
                    allowed: false,
                    reason: "Hostname '127.0.0.1' resolves to a blocked internal/private address",
                });
            });
            it('blocks 10.x.x.x', () => {
                expect(validateUrlForSSRF('http://10.0.0.1/api').allowed).toBe(false);
                expect(validateUrlForSSRF('http://10.255.255.255/api').allowed).toBe(false);
            });
            it('blocks 172.16-31.x.x', () => {
                expect(validateUrlForSSRF('http://172.16.0.1/api').allowed).toBe(false);
                expect(validateUrlForSSRF('http://172.31.255.255/api').allowed).toBe(false);
                expect(validateUrlForSSRF('http://172.15.0.1/api').allowed).toBe(true);
                expect(validateUrlForSSRF('http://172.32.0.1/api').allowed).toBe(true);
            });
            it('blocks 192.168.x.x', () => {
                expect(validateUrlForSSRF('http://192.168.0.1/api').allowed).toBe(false);
                expect(validateUrlForSSRF('http://192.168.255.255/api').allowed).toBe(false);
            });
            it('blocks 169.254.x.x (link-local)', () => {
                expect(validateUrlForSSRF('http://169.254.0.1/api').allowed).toBe(false);
            });
            it('blocks IPv6 loopback', () => {
                expect(validateUrlForSSRF('http://[::1]/api').allowed).toBe(false);
            });
            it('blocks IPv6 link-local', () => {
                expect(validateUrlForSSRF('http://[fe80::1]/api').allowed).toBe(false);
            });
        });
        describe('blocks dangerous protocols', () => {
            it('blocks file://', () => {
                expect(validateUrlForSSRF('file:///etc/passwd').allowed).toBe(false);
            });
            it('blocks ftp://', () => {
                expect(validateUrlForSSRF('ftp://example.com/file').allowed).toBe(false);
            });
            it('blocks gopher://', () => {
                expect(validateUrlForSSRF('gopher://example.com').allowed).toBe(false);
            });
        });
        describe('blocks credentials in URL', () => {
            it('blocks user:pass@host', () => {
                expect(validateUrlForSSRF('https://user:pass@example.com').allowed).toBe(false);
            });
        });
        describe('blocks cloud metadata endpoints', () => {
            it('blocks AWS metadata', () => {
                expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data/').allowed).toBe(false);
            });
        });
        describe('blocks encoded IP bypass forms', () => {
            it('blocks decimal-encoded IPv4 hostnames', () => {
                const result = validateUrlForSSRF('http://2130706433/');
                expect(result.allowed).toBe(false);
                expect(String(result.reason)).toMatch(/decimal-encoded IP address|blocked internal\/private address/);
            });
            it('blocks octal-encoded IPv4 hostnames', () => {
                const result = validateUrlForSSRF('http://0177.0.0.1/');
                expect(result.allowed).toBe(false);
                expect(String(result.reason)).toMatch(/octal-encoded IP address|blocked internal\/private address/);
            });
        });
        describe('allows valid URLs', () => {
            it('allows https://api.anthropic.com', () => {
                expect(validateUrlForSSRF('https://api.anthropic.com/v1').allowed).toBe(true);
            });
            it('allows https://custom-proxy.example.com', () => {
                expect(validateUrlForSSRF('https://custom-proxy.example.com/v1').allowed).toBe(true);
            });
            it('allows http:// for non-production (with warning)', () => {
                expect(validateUrlForSSRF('http://example.com').allowed).toBe(true);
            });
        });
        describe('handles invalid inputs', () => {
            it('rejects empty string', () => {
                expect(validateUrlForSSRF('').allowed).toBe(false);
            });
            it('rejects non-string input', () => {
                expect(validateUrlForSSRF(null).allowed).toBe(false);
                expect(validateUrlForSSRF(undefined).allowed).toBe(false);
            });
            it('rejects malformed URLs', () => {
                expect(validateUrlForSSRF('not-a-url').allowed).toBe(false);
            });
        });
    });
    describe('validateAnthropicBaseUrl', () => {
        it('blocks internal IPs', () => {
            expect(validateAnthropicBaseUrl('http://127.0.0.1:8080').allowed).toBe(false);
        });
        it('allows valid external URLs', () => {
            expect(validateAnthropicBaseUrl('https://api.anthropic.com').allowed).toBe(true);
        });
    });
});
describe('validatedLookup (DNS rebinding defense)', () => {
    // Snapshot env vars touched by validatedLookup so each test starts clean.
    const ENV_KEYS = [
        'OMC_SSRF_ALLOW_PRIVATE',
        'HTTPS_PROXY',
        'https_proxy',
        'HTTP_PROXY',
        'http_proxy',
        'NO_PROXY',
        'no_proxy',
    ];
    const savedEnv = {};
    beforeEach(() => {
        for (const k of ENV_KEYS) {
            savedEnv[k] = process.env[k];
            delete process.env[k];
        }
    });
    afterEach(() => {
        for (const k of ENV_KEYS) {
            if (savedEnv[k] === undefined)
                delete process.env[k];
            else
                process.env[k] = savedEnv[k];
        }
        vi.restoreAllMocks();
    });
    /** Stub dns.lookup so it returns a fixed list of resolved addresses. */
    function mockDnsLookup(addresses) {
        return vi.spyOn(dns, 'lookup').mockImplementation(((_hostname, _options, cb) => {
            if ('err' in addresses) {
                cb(addresses.err);
                return;
            }
            cb(null, addresses);
        }));
    }
    it('rejects when hostname resolves to 127.0.0.1', async () => {
        mockDnsLookup([{ address: '127.0.0.1', family: 4 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('evil.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
        expect(err.message).toMatch(/blocked address '127\.0\.0\.1'/);
        expect(err.message).toMatch(/DNS rebinding/);
    });
    it('rejects IPv4-mapped IPv6 (::ffff:127.0.0.1)', async () => {
        mockDnsLookup([{ address: '::ffff:127.0.0.1', family: 6 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('evil.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
        expect(err.message).toMatch(/::ffff:127\.0\.0\.1/);
    });
    it('rejects IPv4-mapped IPv6 even when family is reported as 4', async () => {
        // Some platforms canonicalize ::ffff:a.b.c.d to family=4. Defensive check.
        mockDnsLookup([{ address: '::ffff:127.0.0.1', family: 4 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('evil.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
    });
    it('rejects link-local IPv6 (fe80::)', async () => {
        mockDnsLookup([{ address: 'fe80::1', family: 6 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('evil.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
    });
    it('rejects unique-local IPv6 (fc00::/7)', async () => {
        mockDnsLookup([{ address: 'fc00::1', family: 6 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('evil.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
    });
    it('rejects dual-stack response containing one private + one public IP', async () => {
        // Attacker DNS returns [public, private] hoping we only check the first.
        mockDnsLookup([
            { address: '93.184.216.34', family: 4 }, // example.com (public)
            { address: '10.0.0.5', family: 4 }, // private — should fail closed
        ]);
        const err = await new Promise((resolve) => {
            validatedLookup('attacker.example.com', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
        expect(err.message).toMatch(/10\.0\.0\.5/);
    });
    it('allows fully-public resolution (single address)', async () => {
        mockDnsLookup([{ address: '93.184.216.34', family: 4 }]);
        const result = await new Promise((resolve) => {
            validatedLookup('example.com', { all: false }, (err, addr, family) => resolve({ err, addr, family }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toBe('93.184.216.34');
        expect(result.family).toBe(4);
    });
    it('returns array form when options.all is true', async () => {
        const addrs = [
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ];
        mockDnsLookup(addrs);
        const result = await new Promise((resolve) => {
            validatedLookup('example.com', { all: true }, (err, addr) => resolve({ err, addr }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toEqual(addrs);
    });
    it('OMC_SSRF_ALLOW_PRIVATE=1 allows private IP', async () => {
        process.env.OMC_SSRF_ALLOW_PRIVATE = '1';
        mockDnsLookup([{ address: '10.0.0.5', family: 4 }]);
        const result = await new Promise((resolve) => {
            validatedLookup('internal.corp', { all: false }, (err, addr) => resolve({ err, addr }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toBe('10.0.0.5');
    });
    it('HTTPS_PROXY set + private IP is allowed (proxy controls target)', async () => {
        process.env.HTTPS_PROXY = 'http://corp.proxy:8080';
        mockDnsLookup([{ address: '10.0.0.5', family: 4 }]);
        const result = await new Promise((resolve) => {
            validatedLookup('proxied.host', { all: false }, (err, addr) => resolve({ err, addr }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toBe('10.0.0.5');
    });
    it('HTTP_PROXY set + private IP is allowed (proxy controls target)', async () => {
        process.env.HTTP_PROXY = 'http://corp.proxy:8080';
        mockDnsLookup([{ address: '10.0.0.5', family: 4 }]);
        const result = await new Promise((resolve) => {
            validatedLookup('proxied.host', { all: false }, (err, addr) => resolve({ err, addr }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toBe('10.0.0.5');
    });
    it('NO_PROXY exemption: proxy is set but host is in NO_PROXY -> still validated', async () => {
        process.env.HTTPS_PROXY = 'http://corp.proxy:8080';
        process.env.NO_PROXY = 'internal.corp,localhost';
        mockDnsLookup([{ address: '10.0.0.5', family: 4 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('internal.corp', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
    });
    it('NO_PROXY suffix match: ".corp" matches "internal.corp"', async () => {
        process.env.HTTPS_PROXY = 'http://corp.proxy:8080';
        process.env.NO_PROXY = '.corp';
        mockDnsLookup([{ address: '10.0.0.5', family: 4 }]);
        const err = await new Promise((resolve) => {
            validatedLookup('internal.corp', { all: false }, (e) => resolve(e));
        });
        expect(err).not.toBeNull();
        expect(err.code).toBe('EAI_BLOCKED');
    });
    it('propagates dns.lookup errors (e.g. ENOTFOUND)', async () => {
        const dnsErr = new Error('lookup failed');
        dnsErr.code = 'ENOTFOUND';
        mockDnsLookup({ err: dnsErr });
        const err = await new Promise((resolve) => {
            validatedLookup('does-not-exist.example', { all: false }, (e) => resolve(e));
        });
        expect(err).toBe(dnsErr);
    });
    it('accepts numeric family argument (legacy form)', async () => {
        mockDnsLookup([{ address: '93.184.216.34', family: 4 }]);
        const result = await new Promise((resolve) => {
            // dns.lookup(host, 4, cb)
            validatedLookup('example.com', 4, (err, addr) => resolve({ err, addr }));
        });
        expect(result.err).toBeNull();
        expect(result.addr).toBe('93.184.216.34');
    });
});
//# sourceMappingURL=ssrf-guard.test.js.map