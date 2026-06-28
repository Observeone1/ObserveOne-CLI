import { describe, it, expect } from 'vitest';
import { isAllowedHost } from '../../utils/host-allowlist.js';

describe('isAllowedHost', () => {
  it('allows the canonical observeone.com and its subdomains', () => {
    expect(isAllowedHost('https://api.observeone.com/api')).toBe(true);
    expect(isAllowedHost('https://observeone.com')).toBe(true);
    expect(isAllowedHost('https://app.observeone.com/anything')).toBe(true);
    expect(isAllowedHost('https://API.ObserveOne.com/api')).toBe(true);
  });

  it('rejects non-observeone hosts', () => {
    expect(isAllowedHost('https://evil.example.com/api')).toBe(false);
    expect(isAllowedHost('https://evil.com/api')).toBe(false);
  });

  it('rejects look-alike hosts that merely contain observeone.com', () => {
    expect(isAllowedHost('https://observeone.com.evil.com/api')).toBe(false);
    expect(isAllowedHost('https://evilobserveone.com/api')).toBe(false);
    expect(isAllowedHost('https://notobserveone.com/api')).toBe(false);
  });

  it('allows loopback addresses (own machine; local dev + e2e)', () => {
    expect(isAllowedHost('http://localhost:8080/api')).toBe(true);
    expect(isAllowedHost('http://127.0.0.1:8080/api')).toBe(true);
    expect(isAllowedHost('http://[::1]:8080/api')).toBe(true);
  });

  it('treats empty/unparseable URLs as not allowed', () => {
    expect(isAllowedHost(undefined)).toBe(false);
    expect(isAllowedHost('')).toBe(false);
    expect(isAllowedHost('not a url')).toBe(false);
  });
});
