let keys;
async function authenticate(request, response, next) {
  if (
    !process.env.AUTH_JWKS_URL ||
    !process.env.AUTH_ISSUER ||
    !process.env.AUTH_AUDIENCE
  ) {
    return response
      .status(503)
      .json({
        error: 'Authentication is not configured',
        code: 'auth_unavailable',
      });
  }
  const match = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '');
  if (!match) {
    return response
      .status(401)
      .json({ error: 'Sign in required', code: 'unauthenticated' });
  }
  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const jwks = new URL(process.env.AUTH_JWKS_URL);
    if (jwks.protocol !== 'https:') {
      throw new Error('JWKS must use HTTPS');
    }
    keys ??= createRemoteJWKSet(jwks);
    const { payload } = await jwtVerify(match[1], keys, {
      issuer: process.env.AUTH_ISSUER,
      audience: process.env.AUTH_AUDIENCE,
      algorithms: ['RS256', 'ES256'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      throw new Error('Invalid identity');
    }
    request.identity = {
      id: payload.sub,
      role: payload[process.env.AUTH_ROLE_CLAIM ?? 'role'],
    };
    next();
  } catch {
    response
      .status(401)
      .json({ error: 'Invalid or expired session', code: 'unauthenticated' });
  }
}
function requireAdmin(request, response, next) {
  if (request.identity?.role !== 'admin') {
    return response
      .status(403)
      .json({ error: 'Administrator access required', code: 'forbidden' });
  }
  next();
}
module.exports = { authenticate, requireAdmin };
