const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { validate, schemas } = require('../middleware/validation');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Buscar usuario
    const users = await executeQuery(
      'SELECT id, username, password, email, nombre, apellido, rol, activo FROM usuarios WHERE username = ? AND activo = true',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }
    
    const user = users[0];
    
    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }
    
    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        rol: user.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // No enviar la contraseña en la respuesta
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login exitoso',
      token,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
});

// Verificar token
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Logout (solo limpia el token del lado del cliente)
router.post('/logout', verifyToken, (req, res) => {
  res.json({
    message: 'Logout exitoso'
  });
});

module.exports = router;