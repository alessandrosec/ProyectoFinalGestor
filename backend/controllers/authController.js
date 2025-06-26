// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const sql = require('mssql');
const config = require('../db.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

// Validaciones para el registro de usuario
exports.validateRegister = [
    body('nombre')
        .notEmpty().withMessage('El nombre es obligatorio')
        .trim(), // Elimina espacios en blanco al inicio/final
    body('correo')
        .isEmail().withMessage('Debe ser un correo electrónico válido')
        .normalizeEmail(), // Normaliza el correo (ej. quita puntos de gmail)
    body('contrasena')
        .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
        .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una letra minúscula')
        .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
        .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un carácter especial'),
];

// Validaciones para el login de usuario
exports.validateLogin = [
    body('correo')
        .isEmail().withMessage('El correo es obligatorio y debe ser válido')
        .normalizeEmail(),
    body('contrasena')
        .notEmpty().withMessage('La contraseña es obligatoria')
];

// Validaciones para enviar correo de recuperación
exports.validateSendRecoverEmail = [
    body('correo')
        .isEmail().withMessage('El correo es obligatorio y debe ser válido')
        .normalizeEmail()
];

// Validaciones para resetear contraseña
exports.validateResetPassword = [
    body('contrasena')
        .isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
        .matches(/[A-Z]/).withMessage('La nueva contraseña debe contener al menos una letra mayúscula')
        .matches(/[a-z]/).withMessage('La nueva contraseña debe contener al menos una letra minúscula')
        .matches(/[0-9]/).withMessage('La nueva contraseña debe contener al menos un número')
        .matches(/[^A-Za-z0-9]/).withMessage('La nueva contraseña debe contener al menos un carácter especial'),
];

//Muestra el formulario del login
exports.getLogin = (req, res) => {
    res.render('login', {
        mensaje: req.session.mensaje,
        csrfToken: req.session.csrfToken
    });
    req.session.mensaje = null;
};

//Muestra el formulario del registro con imagenes predeterminadas
exports.getRegister = (req, res) => {
    // Lista de imágenes predeterminadas (del 1 al 11)
    const imagenes = Array.from({ length: 12 }, (_, i) => `/images/${i + 1}.png`);
    res.render('register', {
        imagenes,
        oldInput: {},
        mensaje: null,
        csrfToken: req.session.csrfToken
    });
};

exports.getIndex = (req, res) => {
    res.render('Index')
}

//Valida al usuario desde la base de datos
exports.postLogin = async (req, res, next) => {
    // 1. Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.mensaje = errors.array().map(e => e.msg).join(', '); // Une todos los mensajes de error
        return res.redirect('/');
    }

    const { correo, contrasena } = req.body;
    const loginLimiter = require('../middlewares/loginAttempts.js');

    if (loginLimiter.isBlocked(correo)) {
        req.session.mensaje = 'Demasiados intentos fallidos. Intenta nuevamente en unos minutos.';
        return res.redirect('/');
    }

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('correo', sql.VarChar, correo)
            .query('SELECT * FROM Usuarios WHERE correoUsuario = @correo');

        const usuario = result.recordset[0];

        if (!usuario || !bcrypt.compareSync(contrasena, usuario.contrasenia)) {
            req.session.mensaje = 'Credenciales incorrectas';
            loginLimiter.registerFailedAttempt(correo);
            return res.redirect('/');
        }

        req.session.usuario = {
            id: usuario.idUsuario,
            nombre: usuario.nombreUsuario,
            foto: usuario.fotoPerfil
        };

        loginLimiter.resetAttempts(correo);

        res.redirect('/index');
    } catch (error) {
        console.error("Error en postLogin:", error); // Mensaje específico de en donde se produce el error
        req.session.mensaje = 'Error interno del servidor. Inténtalo de nuevo.'; // Mensaje genérico para el usuario
        next(error); // Pasa el error al middleware de errores centralizado
    }
};

// Registra a un nuevo ususario (con imagen de perfil)
exports.postRegister = async (req, res, next) => {
    try {
        // Validaciones de Express-Validator
        await Promise.all(exports.validateRegister.map(validation => validation.run(req)));
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const imagenes = Array.from({ length: 12 }, (_, i) => `/images/${i + 1}.png`);
            if (req.file) { // Si Multer ya subió un archivo y la validación falla, elimínalo
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error al eliminar archivo subido (validación fallida):', unlinkErr);
                });
            }
            return res.render('register', {
                imagenes,
                errors: errors.array(),
                oldInput: req.body,
                mensaje: null,
                csrfToken: req.session.csrfToken
            });
        }

        // Registro en la base de datos
        const { nombre, correo, contrasena, imagenSeleccionada } = req.body;
        const fotoPerfil = req.file ? `/uploads/${req.file.filename}` : imagenSeleccionada; // req.file ya está disponible

        const hash = bcrypt.hashSync(contrasena, 10);
        const pool = await sql.connect(config);

        await pool.request()
            .input('nombreUsuario', sql.VarChar, nombre)
            .input('correoUsuario', sql.VarChar, correo)
            .input('contrasenia', sql.VarChar, hash)
            .input('fotoPerfil', sql.VarChar, fotoPerfil)
            .query(`
                INSERT INTO Usuarios (nombreUsuario, correoUsuario, contrasenia, fotoPerfil, rol)
                VALUES (@nombreUsuario, @correoUsuario, @contrasenia, @fotoPerfil, 'usuario')
            `);

        req.session.mensaje = '¡Registro exitoso! Por favor, inicia sesión.';
        res.redirect('/');
    } catch (error) {
        console.error("Error general en postRegister:", error);
        req.session.mensaje = 'Error al registrar usuario. Inténtalo de nuevo.';

        if (req.file) { // Si hay un archivo y se produce un error, elimínalo
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error al eliminar archivo subido (catch):', unlinkErr);
            });
        }

        return next(error);
    }
};

// Muestra la vista para recuperrar contraseña
exports.getRecoverForm = (req, res) => {
    res.render('recover');
};

// Envia un correo con un token unico
exports.sendRecoverEmail = async (req, res, next) => {
    // 1. Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.session.mensaje = errors.array().map(e => e.msg).join(', ');
        return res.redirect('/recuperar');
    }

    const { correo } = req.body;
    const token = crypto.randomBytes(32).toString('hex'); // Genera un token unico aleatoreo de 32 bytes
    const tokenExpira = new Date(Date.now() + 3600000); // Duracion del token de 1 hora

    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('correo', sql.VarChar, correo)
            .query('SELECT * FROM Usuarios WHERE correoUsuario = @correo');

        const usuario = result.recordset[0];

        if (!usuario) {
            req.session.mensaje = 'Si el correo está registrado, se enviará un enlace de recuperación.'; // Mensaje genérico por seguridad
            return res.redirect('/'); // Redirige al login o a una página de éxito
        }

        await pool.request()
            .input('tokenRecuperacion', sql.VarChar, token)
            .input('tokenExpiracion', sql.DateTime, tokenExpira)
            .input('id', sql.Int, usuario.idUsuario)
            .query(`
                UPDATE Usuarios
                SET tokenRecuperacion = @tokenRecuperacion, tokenExpiracion = @tokenExpiracion
                WHERE idUsuario = @id
            `);

        // Configura el envio de correo
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Enlace para recuperar la contraseña(incluye el token)
        const enlace = `http://localhost:3000/reset-password/${token}`;

        // Formato del correo y envio
        await transporter.sendMail({
            from: '@gmail.com',
            to: correo,
            subject: 'Recuperación de contraseña',
            html: `<p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p>
                   <a href="${enlace}">${enlace}</a>
                   <p>Este enlace expirará en 1 hora.</p>`
        });

        req.session.mensaje = 'Se ha enviado un correo de recuperación (si el correo existe).';
        res.redirect('/');
    } catch (e) {
        console.error("Error en sendRecoverEmail:", e);
        req.session.mensaje = 'Error al procesar la solicitud de recuperación.';
        next(e); // Pasa el error al middleware de errores centralizado
    }
};

// Formulario para colocar la nueva contraseña
exports.getResetForm = async (req, res) => {
    const { token } = req.params;

    const pool = await sql.connect(config);
    const result = await pool.request() // Busca el usuario con token y valida la expiracion
        .input('tokenRecuperacion', sql.VarChar, token)
        .query(`
            SELECT * FROM Usuarios
            WHERE tokenRecuperacion = @token AND tokenExpiracion > GETDATE()
        `);

    // Muestra error si no es valido o ya expiro el token
    if (result.recordset.length === 0) {
        return res.send('Enlace inválido o expirado');
    }

    res.render('reset-password', { token });
};

// Guarda la nueva contraseña
exports.postResetPassword = async (req, res, next) => {
    // 1. Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Si hay errores de validación de contraseña, re-renderiza el formulario con el token
        const { token } = req.params;
        return res.render('reset-password', {
            token,
            errors: errors.array(),
            mensaje: null // Limpia cualquier mensaje de sesión
        });
    }

    const { token } = req.params;
    const { contrasena } = req.body;

    try {
        const hash = bcrypt.hashSync(contrasena, 10);

        const pool = await sql.connect(config);
        const result = await pool.request()
            .input('tokenRecuperacion', sql.VarChar, token)
            .query(`
                SELECT * FROM Usuarios
                WHERE tokenRecuperacion = @tokenRecuperacion AND tokenExpiracion > GETDATE()
            `);

        if (result.recordset.length === 0) {
            req.session.mensaje = 'El enlace para restablecer la contraseña es inválido o ha expirado.';
            return res.redirect('/'); // Redirige al login o a un mensaje de error
        }

        await pool.request()
            .input('hash', sql.VarChar, hash)
            .input('tokenRecuperacion', sql.VarChar, token) // Asegúrate de usar el mismo nombre de input como en la consulta
            .query(`
                UPDATE Usuarios
                SET contrasenia = @hash, tokenRecuperacion = NULL, tokenExpiracion = NULL
                WHERE tokenRecuperacion = @tokenRecuperacion
            `);

        req.session.mensaje = '¡Contraseña actualizada exitosamente! Ahora puedes iniciar sesión.';
        res.redirect('/');
    } catch (error) {
        console.error("Error en postResetPassword:", error);
        req.session.mensaje = 'Error al actualizar la contraseña.';
        next(error); // Pasa el error al middleware de errores centralizado
    }
};

// Borra la session
exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};