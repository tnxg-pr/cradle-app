import { createHash, timingSafeEqual } from 'node:crypto'

import { Elysia } from 'elysia'

import { loadServerAuthConfig } from '../config/server-config'
import { AppError } from '../errors/app-error'
import { listActiveRelayAuthTokens } from '../modules/relay-transport/relay-auth-token-service'
import { OPENAPI_DOCS_PATH, OPENAPI_JSON_ALIAS_PATH, OPENAPI_JSON_PATH } from './openapi'

export const CRADLE_TOKEN_HEADER = 'x-cradle-token'
export const CRADLE_RELAY_TOKEN_HEADER = 'x-cradle-relay-token'

interface AuthConfig {
  authRequired: boolean
  authToken: string | null
}

interface VerifyRequestTokenOptions {
  token?: string | null
  config?: AuthConfig
}

function readAuthConfig(): AuthConfig {
  const { authRequired, authToken } = loadServerAuthConfig()
  return { authRequired, authToken }
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest()
}

function tokenMatches(actual: string, expected: string): boolean {
  return timingSafeEqual(hashToken(actual), hashToken(expected))
}

function readBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null
  }

  const [scheme, ...parts] = authorization.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || parts.length !== 1) {
    return null
  }

  return parts[0] || null
}

function readPresentedToken(headers: Headers, options: VerifyRequestTokenOptions): string | null {
  return readBearerToken(headers.get('authorization'))
    ?? headers.get(CRADLE_TOKEN_HEADER)?.trim()
    ?? headers.get(CRADLE_RELAY_TOKEN_HEADER)?.trim()
    ?? options.token?.trim()
    ?? null
}

function isPublicAuthPath(method: string, pathname: string): boolean {
  if ((method === 'GET' || method === 'HEAD') && pathname === '/health') {
    return true
  }

  return pathname === OPENAPI_JSON_PATH
    || pathname === OPENAPI_JSON_ALIAS_PATH
    || pathname === OPENAPI_DOCS_PATH
    || pathname.startsWith(`${OPENAPI_DOCS_PATH}/`)
}

export function createUnauthorizedError(): AppError {
  return new AppError({
    code: 'unauthorized',
    status: 401,
    message: 'Unauthorized',
  })
}

export function verifyRequestToken(
  headers: Headers,
  options: VerifyRequestTokenOptions = {},
): boolean {
  const config = options.config ?? readAuthConfig()
  if (!config.authRequired) {
    return true
  }

  const presentedToken = readPresentedToken(headers, options)
  if (!presentedToken) {
    return false
  }

  if (config.authToken && tokenMatches(presentedToken, config.authToken)) {
    return true
  }

  return listRelayAuthTokens().some(token => tokenMatches(presentedToken, token))
}

export function verifyWebSocketRequestToken(
  request: Request,
  options: Pick<VerifyRequestTokenOptions, 'config'> = {},
): boolean {
  const url = new URL(request.url)
  return verifyRequestToken(request.headers, {
    ...options,
    token: url.searchParams.get('token'),
  })
}

export function createAuthPlugin(config: AuthConfig = readAuthConfig()) {
  return new Elysia({ name: 'cradle.http.auth' })
    .onBeforeHandle({ as: 'global' }, ({ request }) => {
      const { pathname } = new URL(request.url)
      if (isPublicAuthPath(request.method, pathname)) {
        return undefined
      }

      if (!verifyRequestToken(request.headers, { config })) {
        throw createUnauthorizedError()
      }

      return undefined
    })
}

function listRelayAuthTokens(): string[] {
  try {
    return listActiveRelayAuthTokens()
  }
  catch {
    return []
  }
}
