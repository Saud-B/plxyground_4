const buckets = new Map();

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'Too many requests',
        retry_in_ms: bucket.resetAt - now,
      });
    }
    return next();
  };
}

module.exports = { rateLimit };
