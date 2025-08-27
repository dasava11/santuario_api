const express = require('express');
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { verifyToken, verifyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Obtener todos los usuarios
router.get('/', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const activo = req.query.activo ?? 'true';
    const rol = req.query.rol;


    let sql = `
      SELECT id, username, email, nombre, apellido, rol, activo, fecha_creacion
      FROM usuarios
      WHERE 1=1
    `;
    const params = [];

    if (activo !== 'all') {
      sql += ' AND activo = ?';
      params.push(activo === 'true' ? 1 : 0);
    }

    if (rol) {
      sql += ' AND rol = ?';
      params.push(rol);
    }

    // Paginación

    sql += ` ORDER BY nombre, apellido LIMIT ${limit} OFFSET ${offset}`;

    if (isNaN(limit) || isNaN(offset)) {
      return res.status(400).json({ error: 'Parámetros de paginación inválidos' });
    }

   

    console.log('SQL:', sql);
    console.log('Params:', params);
    console.log('Tipos:', params.map(p => typeof p));

    const usuarios = await executeQuery(sql, params);

    // Obtener total para paginación
    let countSql = 'SELECT COUNT(*) as total FROM usuarios WHERE 1=1';
    const countParams = [];

    if (activo !== 'all') {
      countSql += ' AND activo = ?';
      countParams.push(activo === 'true' ? 1 : 0);
    }

    if (rol) {
      countSql += ' AND rol = ?';
      countParams.push(rol);
    }

    const [countResult] = await executeQuery(countSql, countParams);
    const total = countResult.total;

    res.json({
      usuarios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      error: 'Error obteniendo usuarios'
    });
  }
});

// Obtener usuario por ID
router.get('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;

    const usuarios = await executeQuery(
      'SELECT id, username, email, nombre, apellido, rol, activo, fecha_creacion FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    res.json(usuarios[0]);

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      error: 'Error obteniendo usuario'
    });
  }
});

// Crear usuario
router.post('/', verifyToken, verifyRole(['administrador', 'dueño']), validate(schemas.usuario), async (req, res) => {
  try {
    const { username, password, email, nombre, apellido, rol } = req.body;

    // Verificar si ya existe un usuario con ese username o email
    const existing = await executeQuery(
      'SELECT id FROM usuarios WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: 'Ya existe un usuario con este username o email'
      });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await executeQuery(
      'INSERT INTO usuarios (username, password, email, nombre, apellido, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, email, nombre, apellido, rol]
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      id: result.insertId
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      error: 'Error creando usuario'
    });
  }
});

// Actualizar usuario
router.put('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, nombre, apellido, rol, password } = req.body;

    // Verificar si el usuario existe
    const existing = await executeQuery('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    // Verificar username y email únicos
    const duplicated = await executeQuery(
      'SELECT id FROM usuarios WHERE (username = ? OR email = ?) AND id != ?',
      [username, email, id]
    );

    if (duplicated.length > 0) {
      return res.status(400).json({
        error: 'Ya existe otro usuario con este username o email'
      });
    }

    let sql = 'UPDATE usuarios SET username = ?, email = ?, nombre = ?, apellido = ?, rol = ?';
    let params = [username, email, nombre, apellido, rol];

    // Si se proporciona nueva contraseña
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      sql += ', password = ?';
      params.push(hashedPassword);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await executeQuery(sql, params);

    res.json({
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      error: 'Error actualizando usuario'
    });
  }
});

// Desactivar usuario
router.delete('/:id', verifyToken, verifyRole(['administrador', 'dueño']), async (req, res) => {
  try {
    const { id } = req.params;

    // No permitir que se desactive a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'No puedes desactivar tu propia cuenta'
      });
    }

    // Verificar si el usuario existe
    const existing = await executeQuery('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    await executeQuery('UPDATE usuarios SET activo = false WHERE id = ?', [id]);

    res.json({
      message: 'Usuario desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error desactivando usuario:', error);
    res.status(500).json({
      error: 'Error desactivando usuario'
    });
  }
});

module.exports = router;