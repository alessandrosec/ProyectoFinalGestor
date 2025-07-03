// app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const { generateCsrfToken } = require('./backend/middlewares/csrf');
const helmet = require('helmet');
const projectRoutes = require('./backend/routes/project');
const apiRoutes = require('./backend/routes/api'); // 🔥 NUEVA LÍNEA
require('dotenv').config();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // 🔥 IMPORTANTE: Para parsear JSON en requests API
app.use(express.static(path.join(__dirname, 'frontend', 'public')));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 horas
    sameSite: 'Lax'
  }
}));
app.use(generateCsrfToken);

// Configura el motor de vista para los archivos .ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'frontend', 'views'));

// Rutas
const authRoutes = require('./backend/routes/auth');
app.use('/', authRoutes);
app.use('/', projectRoutes); // Rutas tradicionales (formularios)
app.use('/api', apiRoutes); // 🔥 NUEVA LÍNEA: Rutas API (JSON)

// Middleware para manejo de errores 
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Si es una petición API, responder con JSON
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'SERVER_ERROR'
    });
  }
  
  // Si es una petición tradicional, responder con HTML
  res.status(500).send('¡Algo salió mal en el servidor!');
});

// Arranca el servidor 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🔥 API REST disponible en http://localhost:${PORT}/api`);
  console.log(`📊 Dashboard en http://localhost:${PORT}/index`);
});