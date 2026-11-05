const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
function loadConfig(env = process.env) {
    const sessionSecret = env.SESSION_SECRET || "";
    if (sessionSecret.length < 32 || sessionSecret === "cambia-esta-clave-en-.env") throw new Error("Configura SESSION_SECRET con al menos 32 caracteres aleatorios en backend/.env");
    if (!env.ADMIN_PASSWORD) throw new Error("Configura ADMIN_PASSWORD en backend/.env");
    const port = Number(env.PORT || 3000);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT no es válido");
    const proxyHops = Number(env.TRUST_PROXY_HOPS || 0);
    if (!Number.isInteger(proxyHops) || proxyHops < 0) throw new Error("TRUST_PROXY_HOPS no es válido");
    return { port, sessionSecret, adminPassword: env.ADMIN_PASSWORD, production: env.NODE_ENV === "production", proxyHops };
}
module.exports = { loadConfig };
