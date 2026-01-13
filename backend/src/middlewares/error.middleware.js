export function notFound(_req, _res, next) {
    const err = new Error("Route not found");
    err.status = 404;
    next(err);
  }
  
  export function errorHandler(err, _req, res, _next) {
    const status = err.status || 500;
  
    // Don’t leak internals in prod.
    const payload = {
      ok: false,
      error: status === 500 ? "Internal server error" : err.message
    };
  
    if (status === 500) console.error("🔥 Server error:", err);
  
    res.status(status).json(payload);
  }
  