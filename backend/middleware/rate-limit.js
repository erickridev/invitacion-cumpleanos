// Límite por IP y proceso; varias instancias requieren un almacén compartido.
module.exports = function rateLimit({ limit, windowMs, now = Date.now }) {
    const attempts = new Map();
    return (req, res, next) => {
        const time = now();
        for (const [ip, entry] of attempts) if (entry.expires <= time) attempts.delete(ip);
        let entry = attempts.get(req.ip);
        if (!entry) { entry = { count: 0, expires: time + windowMs }; attempts.set(req.ip, entry); }
        if (entry.count >= limit) {
            res.set("Retry-After", String(Math.ceil((entry.expires - time) / 1000)));
            return res.status(429).json({ mensaje: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." });
        }
        entry.count++;
        next();
    };
};
