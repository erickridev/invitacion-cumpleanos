const express = require("express");
const { secretMatches } = require("../security");
const requiereAdmin = require("../middleware/require-admin");

module.exports = function adminRoutes({ pool, config, loginLimiter }) {
    const router = express.Router();
    router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
    router.post("/login", loginLimiter, (req, res) => {
        const { password } = req.body || {};
        if (!config.adminPassword) {
            return res.status(500).json({ mensaje: "Falta configurar ADMIN_PASSWORD en .env" });
        }
        if (typeof password !== "string" || !secretMatches(password, config.adminPassword)) {
            return res.status(401).json({ mensaje: "Contraseña incorrecta" });
        }
        req.session.regenerate(error => {
            if (error) {
                console.error("Error al iniciar sesión:", error);
                return res.status(500).json({ mensaje: "No se pudo iniciar sesión" });
            }
            req.session.esAdmin = true;
            req.session.save(saveError => {
                if (saveError) {
                    console.error("Error al guardar sesión:", saveError);
                    return res.status(500).json({ mensaje: "No se pudo guardar la sesión" });
                }
                return res.json({ mensaje: "Inicio de sesión correcto" });
            });
        });
    });

    router.get("/sesion", requiereAdmin, (req, res) => res.json({ autenticado: true }));

    router.post("/logout", (req, res) => {
        if (!req.session) {
            res.clearCookie("cumple.sid");
            return res.json({ mensaje: "Sesión cerrada correctamente" });
        }
        req.session.destroy(error => {
            if (error) {
                console.error("Error al cerrar sesión:", error);
                return res.status(500).json({ mensaje: "No se pudo cerrar la sesión" });
            }
            res.clearCookie("cumple.sid", {
                httpOnly: true, sameSite: "lax",
                secure: config.production
            });
            return res.json({ mensaje: "Sesión cerrada correctamente" });
        });
    });

    router.get("/resumen", requiereAdmin, async (req, res) => {
        try {
            const [filas] = await pool.query(`
                SELECT COUNT(*) AS total_familias,
                    COALESCE(SUM(estado_asistencia = 'confirmado'), 0) AS confirmados,
                    COALESCE(SUM(estado_asistencia = 'no_asistira'), 0) AS no_asistiran,
                    COALESCE(SUM(estado_asistencia = 'pendiente'), 0) AS pendientes
                FROM familias
            `);
            const r = filas[0];
            return res.json({
                total_familias: Number(r.total_familias),
                confirmados: Number(r.confirmados),
                no_asistiran: Number(r.no_asistiran),
                pendientes: Number(r.pendientes)
            });
        } catch (error) {
            console.error("Error al obtener estadísticas:", error);
            return res.status(500).json({ mensaje: "No se pudieron obtener las estadísticas" });
        }
    });

    router.get("/familias", requiereAdmin, async (req, res) => {
        try {
            const [familias] = await pool.query(`
                SELECT id AS familia_id, nombre_familia, estado_asistencia, fecha_creacion, token_invitacion
                FROM familias ORDER BY nombre_familia ASC
            `);
            return res.json(familias);
        } catch (error) {
            console.error("Error al obtener familias:", error);
            return res.status(500).json({ mensaje: "No se pudo obtener la lista de familias" });
        }
    });


    return router;
};
