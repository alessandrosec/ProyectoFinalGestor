// backend/middlewares/auth.js
exports.isAuthenticated = (req, res, next) => {
    // Si la sesión tiene un usuario, significa que está logueado
    if (req.session.usuario && req.session.usuario.id) {
        return next(); // Continúa con la siguiente función en la cadena de middleware/ruta
    }
    // Si no está logueado, guarda un mensaje y redirige al login
    req.session.mensaje = 'Debes iniciar sesión para acceder a esta página.';
    res.redirect('/'); // Asumiendo que '/' es tu página de login
};