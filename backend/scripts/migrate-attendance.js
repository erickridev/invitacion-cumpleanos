// Añadir el nuevo estado al final conserva los índices de los valores existentes.
module.exports = async function migrateAttendance(pool) {
    const [[column]] = await pool.query("SHOW COLUMNS FROM familias LIKE 'estado_asistencia'");
    if (column?.Type === "enum('confirmado','pendiente','no_asistira')") return;
    if (column?.Type !== "enum('confirmado','pendiente')") {
        throw new Error("El esquema de estado_asistencia no es el esperado; no se modificó la columna");
    }
    await pool.query("ALTER TABLE familias MODIFY estado_asistencia ENUM('confirmado','pendiente','no_asistira') NOT NULL DEFAULT 'pendiente'");
};
