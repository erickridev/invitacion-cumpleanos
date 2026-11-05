const { loadConfig } = require("./config");
const pool = require("./db");
const { createApp } = require("./app");
async function start() {
    const config = loadConfig();
    await pool.query("SELECT 1 FROM sesiones LIMIT 1");
    const server = createApp({ pool, config }).listen(config.port, () => console.log("Servidor iniciado en http://localhost:" + config.port));
    server.on("error", async error => { console.error("No se pudo iniciar:", error.code || error.message); await pool.end(); process.exitCode = 1; });
    let closing = false;
    const shutdown = () => {
        if (closing) return;
        closing = true;
        const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
        server.close(async () => { await pool.end(); clearTimeout(timeout); });
    };
    process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}
start().catch(async error => {
    console.error("No se pudo iniciar. Revisa .env y ejecuta npm run db:init:", error.code || error.message);
    await pool.end(); process.exitCode = 1;
});
