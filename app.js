// app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const { generateCsrfToken } = require('./backend/middlewares/csrf');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

app.use(express.urlencoded({ extended: true })); //Permite leer los datos de los formularios
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'public'))); //Habilita la carpeta para imagenes y archivos estaticos
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // Previene que JavaScript del lado del cliente acceda a la cookie (protección contra XSS)
    maxAge: 1000 * 60 * 60 * 24, // Duración de la cookie en milisegundos (aquí, 24 horas)
    sameSite: 'Lax' // Previene ataques CSRF
  }
}));
app.use(generateCsrfToken);

// Configura el motor de veista para los archivos .ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'frontend', 'views'));

// Rutas
const authRoutes = require('./backend/routes/auth'); //Importa la ruta de autenticacion 
app.use('/', authRoutes);

// Middleware para manejo de errores 
app.use((err, req, res, next) => {
  console.error(err.stack); // Muestra el stack trace del error en la consola 
  res.status(500).send('¡Algo salió mal en el servidor!');
});

// Arraca el servidor 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
