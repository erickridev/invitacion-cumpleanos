const express = require("express");
const path = require("node:path");
const session = require("express-session");
const MysqlSessionStore = require("./stores/mysql-session-store");
const rateLimit = require("./middleware/rate-limit");
const adminRoutes = require("./routes/admin");
const invitationRoutes = require("./routes/invitations");
function createApp({ pool, config, store = new MysqlSessionStore(pool) }) {
    const app = express();
    app.disable("x-powered-by");
    if (config.proxyHops) app.set("trust proxy", config.proxyHops);
    app.use((req, res, next) => {
        res.set("X-Content-Type-Options", "nosniff"); res.set("Referrer-Policy", "no-referrer"); res.set("X-Frame-Options", "DENY"); next();
    });
    app.use(express.json({ limit: "20kb" }));
    app.use(express.urlencoded({ extended: false, limit: "20kb" }));
    app.get("/api/salud", async (req, res) => { await pool.query("SELECT 1"); res.json({ mensaje: "Servidor y MySQL conectados correctamente" }); });
    app.use("/api/admin", session({
        name: "cumple.sid", secret: config.sessionSecret, store, resave: false, saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: "lax", secure: config.production, maxAge: 14400000 }
    }), adminRoutes({ pool, config, loginLimiter: rateLimit({ limit: 5, windowMs: 900000 }) }));
    app.use("/api", invitationRoutes({ pool, publicLimiter: rateLimit({ limit: 120, windowMs: 60000 }) }));
    app.use("/api", (req, res) => res.status(404).json({ mensaje: "La ruta solicitada no existe" }));
    app.use(express.static(path.join(__dirname, "../frontend")));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        if (error.type === "entity.parse.failed") return res.status(400).json({ mensaje: "El JSON enviado no es válido" });
        if (error.type === "entity.too.large") return res.status(413).json({ mensaje: "La solicitud es demasiado grande" });
        console.error("Error del servidor:", error.code || error.message);
        return res.status(500).json({ mensaje: "Ocurrió un error interno del servidor. Inténtalo nuevamente." });
    });
    return app;
}
module.exports = { createApp };
