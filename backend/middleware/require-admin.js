module.exports = function requiereAdmin(req, res, next) {
    if (req.session?.esAdmin === true) return next();
    return res.status(401).json({ mensaje: "Debes iniciar sesión como administrador" });
};
