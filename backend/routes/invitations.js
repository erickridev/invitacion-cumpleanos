const express = require("express");
const { secretMatches } = require("../security");

module.exports = function invitationRoutes({ pool, publicLimiter }) {
    const router = express.Router();
    router.use(publicLimiter);
    router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
    router.post("/invitacion", async (req, res) => {
        const codigo = req.body?.codigo;
        if (typeof codigo !== "string" || codigo.length !== 36) {
            return res.status(400).json({ mensaje: "El código de invitación no es válido" });
        }
        const [familias] = await pool.execute(
            "SELECT id AS familia_id, nombre_familia, estado_asistencia FROM familias WHERE token_invitacion = ?",
            [codigo]
        );
        if (!familias.length) return res.status(404).json({ mensaje: "No encontramos esa invitación. Consulta con la persona organizadora." });
        return res.json(familias[0]);
    });
    // Búsqueda pública: solo expone nombre, ID y estado de las coincidencias.
    router.get("/familias/buscar", async (req, res) => {
        const busqueda = String(req.query.q || "").trim();
        if (busqueda.length < 2) return res.json([]);
        if (busqueda.length > 150) {
            return res.status(400).json({ mensaje: "La búsqueda es demasiado larga" });
        }
        try {
            const [familias] = await pool.execute(
                `SELECT id AS familia_id, nombre_familia, estado_asistencia
                 FROM familias
                 WHERE nombre_familia LIKE ?
                 ORDER BY nombre_familia ASC
                 LIMIT 15`,
                [`%${busqueda}%`]
            );
            return res.json(familias);
        } catch (error) {
            console.error("Error al buscar familias:", error);
            return res.status(500).json({ mensaje: "No se pudieron buscar las familias" });
        }
    });

    // Actualiza una familia existente y evita dobles confirmaciones simultáneas.
    router.post("/asistencia", async (req, res) => {
        const familiaId = Number(req.body?.familiaId);
        if (!Number.isSafeInteger(familiaId) || familiaId <= 0) {
            return res.status(400).json({ mensaje: "Selecciona una familia válida de la lista" });
        }

        const codigo = req.body?.codigo;
        if (typeof codigo !== "string" || codigo.length !== 36) {
            return res.status(400).json({ mensaje: "Introduce el código privado de tu invitación" });
        }
        const estado = req.body?.estado;
        if (estado !== "confirmado" && estado !== "no_asistira") {
            return res.status(400).json({ mensaje: "Selecciona si tu familia asistirá o no asistirá" });
        }
        let conexion;
        try {
            conexion = await pool.getConnection();
            await conexion.beginTransaction();

            const [familias] = await conexion.execute(
                `SELECT id, nombre_familia, estado_asistencia, token_invitacion
                 FROM familias WHERE id = ? FOR UPDATE`,
                [familiaId]
            );

            if (!familias.length || !secretMatches(codigo, familias[0].token_invitacion)) {
                await conexion.rollback();
                return res.status(403).json({ mensaje: "El código no corresponde a la familia seleccionada" });
            }

            const familia = familias[0];
            const mensaje = estado === "confirmado"
                ? "¡Gracias! Hemos registrado que su familia asistirá. ¡Les esperamos!"
                : "Gracias por avisarnos. Hemos registrado que su familia no podrá asistir.";
            if (familia.estado_asistencia === estado) {
                await conexion.commit();
                return res.json({
                    yaRegistrada: true,
                    mensaje,
                    familia: familia.nombre_familia,
                    estado
                });
            }

            await conexion.execute(
                "UPDATE familias SET estado_asistencia = ? WHERE id = ?",
                [estado, familiaId]
            );
            await conexion.commit();

            return res.json({
                yaRegistrada: false,
                mensaje,
                familia: familia.nombre_familia,
                estado
            });
        } catch (error) {
            if (conexion) {
                try { await conexion.rollback(); }
                catch (rollbackError) { console.error("Error al revertir transacción:", rollbackError); }
            }
            console.error("Error al registrar asistencia:", error);
            return res.status(500).json({
                mensaje: "No se pudo registrar la confirmación. Inténtalo nuevamente."
            });
        } finally {
            if (conexion) conexion.release();
        }
    });


    return router;
};
