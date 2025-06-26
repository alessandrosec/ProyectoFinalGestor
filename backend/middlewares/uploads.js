// backend/middlewares/uploads.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de almacenamiento para Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Asegúrate de que esta ruta sea la correcta hacia tu carpeta public/uploads
        const uploadDir = path.join(__dirname, '../../frontend/public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Genera un nombre de archivo único para evitar colisiones
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    }
});

// Filtro para aceptar solo ciertos tipos de archivos (imágenes)
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
        return cb(null, true);
    } else {
        // Mensaje de error más descriptivo
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, JPEG, PNG, GIF).'), false);
    }
};

// Exporta la configuración de Multer para una sola imagen llamada 'fotoPerfil'
// Este 'upload' es lo que importaremos y usaremos directamente como middleware.
const uploadMiddleware = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite de tamaño de archivo (ej. 5MB)
    fileFilter: fileFilter
}).single('fotoPerfil'); // <-- Configurado para un solo archivo y el nombre del campo

module.exports = uploadMiddleware; // Exporta directamente la instancia de multer