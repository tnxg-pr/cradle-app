import { promises as dns } from 'node:dns'
import net from 'node:net'

import { AppError } from '../errors/app-error'
import { outboundFetch } from './outbound-network'

/**
 * Link-preview SSRF guard.
 *
 * Resolves the URL host and rejects anything that points at a private, loopback,
 * link-local, or cloud-metadata address before we issue an outbound fetch.
 * Without this, a user-controlled URL pasted into issue content could coerce the
 * server into probing the internal network.
 */

const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254', // AWS / GCP / Azure IMDS
  'fd00:ec2::254', // AWS IMDSv6
])

export interface ResolvedFetchTarget {
  url: string
  hostname: string
}

export interface ResolveSafeFetchTargetOptions {
  allowPrivateHosts?: ReadonlySet<string> | readonly string[]
  invalidUrlCode?: string
  invalidSchemeCode?: string
  blockedHostCode?: string
  unresolvedHostCode?: string
  message?: string
}

export interface GuardedFetchOptions extends ResolveSafeFetchTargetOptions {
  maxRedirects?: number
}

type AddressLookup = (hostname: string) => Promise<string[]>
type SsrGuardTestGlobal = typeof globalThis & {
  __cradleSsrAddressLookupForTests?: AddressLookup | null
}

const DEFAULT_MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const SENSITIVE_REDIRECT_HEADERS = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-api-key',
])

export function setSsrAddressLookupForTests(lookup: AddressLookup | null): void {
  const testGlobal = globalThis as SsrGuardTestGlobal
  testGlobal.__cradleSsrAddressLookupForTests = lookup
}

export async function resolveSafeFetchTarget(
  rawUrl: string,
  options: ResolveSafeFetchTargetOptions = {},
): Promise<ResolvedFetchTarget> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  }
  catch {
    throw new AppError({
      code: options.invalidUrlCode ?? 'link_preview_invalid_url',
      status: 400,
      message: options.message ?? 'Outbound fetch requires a valid URL',
    })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError({
      code: options.invalidSchemeCode ?? 'link_preview_invalid_scheme',
      status: 400,
      message: options.message ?? 'Outbound fetch only supports http and https URLs',
    })
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_METADATA_HOSTS.has(hostname)) {
    throwBlocked(options)
  }

  // Literal IP hosts are checked directly; hostnames are resolved and every
  // returned address is checked. We resolve before fetching so DNS-rebinding
  // to a private IP at request time is still caught for the resolved name.
  const privateHostAllowed = isAllowedPrivateHost(hostname, options.allowPrivateHosts)
  if (net.isIP(hostname)) {
    if (!privateHostAllowed) {
      assertPublicIp(hostname, options)
    }
  }
  else {
    const addresses = await resolveAllAddresses(hostname)
    if (addresses.length === 0) {
      throw new AppError({
        code: options.unresolvedHostCode ?? 'link_preview_unresolved_host',
        status: 400,
        message: options.message ?? 'Outbound fetch target host could not be resolved',
      })
    }
    if (!privateHostAllowed) {
      for (const address of addresses) {
        assertPublicIp(address, options)
      }
    }
  }

  return { url: parsed.toString(), hostname }
}

export async function guardedFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: GuardedFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  let target = await resolveSafeFetchTarget(rawUrl, options)
  let requestInit = stripRedirectMode(init)

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await outboundFetch(target.url, {
      ...requestInit,
      redirect: 'manual',
    })

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response
    }

    const location = response.headers.get('location')
    if (!location) {
      return response
    }

    if (redirectCount === maxRedirects) {
      throw new AppError({
        code: 'outbound_fetch_redirect_limit',
        status: 400,
        message: 'Outbound fetch followed too many redirects',
        details: { url: target.url, maxRedirects },
      })
    }

    const nextUrl = new URL(location, target.url).toString()
    requestInit = projectRedirectInit(requestInit, target.url, nextUrl)
    target = await resolveSafeFetchTarget(nextUrl, options)
  }

  throw new AppError({
    code: 'outbound_fetch_redirect_limit',
    status: 400,
    message: 'Outbound fetch followed too many redirects',
    details: { url: target.url, maxRedirects },
  })
}

async function resolveAllAddresses(hostname: string): Promise<string[]> {
  const addressLookupForTests = (globalThis as SsrGuardTestGlobal).__cradleSsrAddressLookupForTests
  if (addressLookupForTests) {
    return addressLookupForTests(hostname)
  }
  try {
    const records = await dns.lookup(hostname, { all: true })
    return records.map(record => record.address)
  }
  catch {
    return []
  }
}

function assertPublicIp(ip: string, options: ResolveSafeFetchTargetOptions): void {
  if (BLOCKED_METADATA_HOSTS.has(ip)) {
    throwBlocked(options)
  }

  const version = net.isIP(ip)
  if (version === 4) {
    if (isPrivateIPv4(ip)) {
      throwBlocked(options)
    }
    return
  }

  if (version === 6) {
    if (isPrivateIPv6(ip)) {
      throwBlocked(options)
    }
    return
  }

  // Not an IP we recognize — treat conservatively.
  throwBlocked(options)
}

function throwBlocked(options: ResolveSafeFetchTargetOptions = {}): never {
  throw new AppError({
    code: options.blockedHostCode ?? 'link_preview_blocked_host',
    status: 400,
    message: options.message ?? 'Outbound fetch target is not allowed',
  })
}

function isAllowedPrivateHost(
  hostname: string,
  allowPrivateHosts: ResolveSafeFetchTargetOptions['allowPrivateHosts'],
): boolean {
  if (!allowPrivateHosts || BLOCKED_METADATA_HOSTS.has(hostname)) {
    return false
  }
  const allowed = allowPrivateHosts instanceof Set
    ? allowPrivateHosts
    : new Set(allowPrivateHosts)
  return allowed.has(hostname)
}

function stripRedirectMode(init: RequestInit): RequestInit {
  const { redirect: _redirect, ...rest } = init
  return rest
}

function projectRedirectInit(init: RequestInit, currentUrl: string, nextUrl: string): RequestInit {
  if (new URL(currentUrl).origin === new URL(nextUrl).origin || !init.headers) {
    return init
  }

  const headers = new Headers(init.headers)
  for (const header of SENSITIVE_REDIRECT_HEADERS) {
    headers.delete(header)
  }
  return {
    ...init,
    headers,
  }
}

/**
 * IPv4 private/reserved ranges per RFC1918 + loopback + link-local + carrier-grade NAT.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(part => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts

  if (a === 0) {
    return true // 0.0.0.0/8 "this network"
  }
  if (a === 10) {
    return true // 10.0.0.0/8
  }
  if (a === 127) {
    return true // 127.0.0.0/8 loopback
  }
  if (a === 169 && b === 254) {
    return true // 169.254.0.0/16 link-local
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true // 172.16.0.0/12
  }
  if (a === 192 && b === 168) {
    return true // 192.168.0.0/16
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true // 100.64.0.0/10 CGNAT
  }
  if (a >= 224) {
    return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  }

  return false
}

/**
 * IPv6 private/reserved ranges: loopback (::1), unique-local (fc00::/7),
 * link-local (fe80::/10), and unspecified (::).
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1' || normalized === '::') {
    return true
  }
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true // fc00::/7 unique-local
  }
  if (normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')) {
    return true // fe80::/10 link-local
  }
  // IPv4-mapped (::ffff:a.b.c.d) — delegate to the v4 check.
  const mapped = normalized.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mapped) {
    return isPrivateIPv4(mapped[1])
  }
  return false
}
