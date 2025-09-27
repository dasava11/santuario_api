import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sequelize } from "../config/database.js";
import db from "../models/index.js";

const { usuarios } = db;

// Login de usuario
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar usuario activo
    const usuario = await usuarios.findOne({
      where: {
        username,
        activo: true,
      },
    });

    if (!usuario) {
      return res.status(401).json({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, usuario.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    // Generar JWT
    const token = jwt.sign(
      {
        userId: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Preparar datos del usuario sin contraseña
    const userResponse = {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      activo: usuario.activo,
    };

    res.json({
      success: true,
      message: "Login exitoso",
      data: {
        token,
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
};

// Verificar token válido
const verifyToken = async (req, res) => {
  try {
    // El middleware verifyToken ya validó el token y agregó req.user
    res.json({
      success: true,
      message: "Token válido",
      data: {
        valid: true,
        user: req.user,
      },
    });
  } catch (error) {
    console.error("Error verificando token:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
};

// Logout (invalidación del lado del cliente)
const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logout exitoso",
    });
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
};

// Cambiar contraseña
const cambiarPassword = async (req, res) => {
  let transaction;

  try {
    const { password_actual, password_nuevo } = req.body;
    const userId = req.user.id;

    // Buscar usuario primero sin transacción para validar existencia
    const usuario = await usuarios.findByPk(userId);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      return res.status(400).json({
        success: false,
        error: "El usuario está desactivado",
      });
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(
      password_actual,
      usuario.password
    );

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: "La contraseña actual es incorrecta",
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(
      password_nuevo,
      usuario.password
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: "La nueva contraseña debe ser diferente a la actual",
      });
    }

    // Iniciar transacción para la actualización
    transaction = await sequelize.transaction();

    // Encriptar nueva contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password_nuevo, saltRounds);

    // Actualizar contraseña
    await usuario.update(
      {
        password: hashedPassword,
        fecha_actualizacion: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error("Error cambiando contraseña:", error);

    // Manejar errores específicos de bcrypt
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Error en la validación de datos",
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Error interno del servidor",
    });
  }
};

// Obtener perfil del usuario autenticado
const obtenerPerfil = async (req, res) => {
  try {
    const userId = req.user.id;

    const usuario = await usuarios.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "email",
        "nombre",
        "apellido",
        "rol",
        "activo",
        "fecha_creacion",
        "fecha_actualizacion",
      ],
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    res.json({
      success: true,
      data: usuario,
    });
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message,
    });
  }
};

export { login, verifyToken, logout, cambiarPassword, obtenerPerfil };
