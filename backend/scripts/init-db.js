const fs = require("node:fs");
const path = require("node:path");
const pool = require("../db");
const migrateAttendance = require("./migrate-attendance");
(async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, "../sql/schema.sql"), "utf8");
        for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await pool.query(statement);
        await migrateAttendance(pool);
        console.log("Tablas listas. Los datos existentes se conservaron.");
    } catch (error) { console.error("No se pudo preparar la base de datos:", error.code || error.message); process.exitCode = 1; }
    finally { await pool.end(); }
})();
