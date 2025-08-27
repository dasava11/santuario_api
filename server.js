const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const categoriasRoutes = require('./routes/categorias');
const proveedoresRoutes = require('./routes/proveedores');
const ventasRoutes = require('./routes/ventas');
const recepcionesRoutes = require('./routes/recepciones');
const inventarioRoutes = require('./routes/inventario');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de seguridad
app.use(helmet());

// Configuración de CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://santuario-front-8o49.vercel.app','https://santuario-desarrollo.vercel.app'] 
    : ['http://localhost:4200'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de login cada 15 minutos
  message: { error: 'Demasiados intentos de login. Intenta más tarde.' }
});
app.use('/api/auth/login', loginLimiter); // solo aplica a /login

// ✅ Rate limit general (más flexible)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // más alto para ventas, productos, etc.
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' }
});
app.use(generalLimiter); // aplica al resto de rutas

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/recepciones', recepcionesRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON inválido en la solicitud'
    });
  }
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
});

module.exports = app;