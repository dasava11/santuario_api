import bcrypt from "bcryptjs";
import { sequelize } from "../config/database.js";
import db from "../models/index.js";

const { usuarios } = db;

// Obtener todos los usuarios con filtros y paginación
const obtenerUsuarios = async (req, res) => {
  try {
    const { rol, activo, page, limit } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (activo !== "all") {
      where.activo = activo === "true";
    }

    if (rol) {
      where.rol = rol;
    }

    // Calcular offset para paginación
    const offset = (page - 1) * limit;

    // Consulta con paginación
    const { count, rows: usuariosData } = await usuarios.findAndCountAll({
      where,
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
      ], // Excluir password
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ["nombre", "ASC"],
        ["apellido", "ASC"],
      ],
      distinct: true,
    });

    res.json({
      success: true,
      data: {
        usuarios: usuariosData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo usuarios",
      message: error.message,
    });
  }
};

// Obtener usuario por ID
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await usuarios.findOne({
      where: { id },
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
    console.error("Error obteniendo usuario:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo usuario",
      message: error.message,
    });
  }
};

// Crear nuevo usuario
const crearUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { username, password, email, nombre, apellido, rol, activo } =
      req.body;

    // VALIDACIONES DE BASE DE DATOS

    // Verificar si ya existe un usuario con el mismo username
    const existingByUsername = await usuarios.findOne({
      where: { username: username.trim() },
      transaction,
    });

    if (existingByUsername) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe un usuario con el nombre de usuario "${username.trim()}"`,
      });
    }

    // Verificar si ya existe un usuario con el mismo email
    const existingByEmail = await usuarios.findOne({
      where: { email: email.trim().toLowerCase() },
      transaction,
    });

    if (existingByEmail) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe un usuario con el email "${email.trim()}"`,
      });
    }

    // Encriptar contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear el usuario
    const nuevoUsuario = await usuarios.create(
      {
        username: username.trim(),
        password: hashedPassword,
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rol,
        activo: activo ?? true,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Usuario ${username.trim()} creado con éxito`,
      data: { id: nuevoUsuario.id },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando usuario:", error);
    res.status(500).json({
      success: false,
      error: "Error creando usuario",
      message: error.message,
    });
  }
};

// Actualizar usuario
const actualizarUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const fieldsToUpdate = { ...req.body };

    // Verificar si el usuario existe
    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `No se encontró un usuario con el id: ${id}`,
      });
    }

    // VALIDACIONES DE BASE DE DATOS

    // Verificar username único (si cambió)
    if (
      fieldsToUpdate.username &&
      fieldsToUpdate.username !== usuario.username
    ) {
      const existingByUsername = await usuarios.findOne({
        where: {
          username: fieldsToUpdate.username.trim(),
          id: { [sequelize.Op.ne]: id },
        },
        transaction,
      });

      if (existingByUsername) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Ya existe un usuario con el nombre "${fieldsToUpdate.username.trim()}"`,
        });
      }
    }

    // Verificar email único (si cambió)
    if (
      fieldsToUpdate.email &&
      fieldsToUpdate.email.toLowerCase() !== usuario.email.toLowerCase()
    ) {
      const existingByEmail = await usuarios.findOne({
        where: {
          email: fieldsToUpdate.email.trim().toLowerCase(),
          id: { [sequelize.Op.ne]: id },
        },
        transaction,
      });

      if (existingByEmail) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Ya existe un usuario con el email "${fieldsToUpdate.email.trim()}"`,
        });
      }
    }

    // Limpiar y preparar campos para actualización
    if (fieldsToUpdate.username)
      fieldsToUpdate.username = fieldsToUpdate.username.trim();
    if (fieldsToUpdate.email)
      fieldsToUpdate.email = fieldsToUpdate.email.trim().toLowerCase();
    if (fieldsToUpdate.nombre)
      fieldsToUpdate.nombre = fieldsToUpdate.nombre.trim();
    if (fieldsToUpdate.apellido)
      fieldsToUpdate.apellido = fieldsToUpdate.apellido.trim();

    // Encriptar nueva contraseña si se proporciona
    if (fieldsToUpdate.password) {
      const saltRounds = 12;
      fieldsToUpdate.password = await bcrypt.hash(
        fieldsToUpdate.password,
        saltRounds
      );
    }

    // Actualizar el usuario
    await usuario.update(fieldsToUpdate, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Usuario ${
        fieldsToUpdate.username || usuario.username
      } actualizado con éxito`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando usuario:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando usuario",
      message: error.message,
    });
  }
};

// Desactivar usuario (soft delete)
const desactivarUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // VALIDACIÓN DE NEGOCIO: No permitir que se desactive a sí mismo
    if (parseInt(id) === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "No puedes desactivar tu propia cuenta",
      });
    }

    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    // Verificar si ya está desactivado
    if (!usuario.activo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "El usuario ya está desactivado",
      });
    }

    await usuario.update({ activo: false }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Usuario ${usuario.username} desactivado exitosamente`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error desactivando usuario:", error);
    res.status(500).json({
      success: false,
      error: "Error desactivando usuario",
      message: error.message,
    });
  }
};

// Activar usuario
const activarUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    // Verificar si ya está activado
    if (usuario.activo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "El usuario ya está activado",
      });
    }

    await usuario.update({ activo: true }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `Usuario ${usuario.username} activado exitosamente`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error activando usuario:", error);
    res.status(500).json({
      success: false,
      error: "Error activando usuario",
      message: error.message,
    });
  }
};

// Resetear contraseña de usuario (solo para administradores)
const resetearPassword = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { password_nuevo } = req.body;

    // VALIDACIÓN DE NEGOCIO: No permitir resetear su propia contraseña por esta vía
    if (parseInt(id) === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error:
          "Para cambiar tu propia contraseña usa el endpoint /auth/cambiar-password",
      });
    }

    const usuario = await usuarios.findByPk(id, { transaction });
    if (!usuario) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado",
      });
    }

    // Encriptar nueva contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password_nuevo, saltRounds);

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
      message: `Contraseña del usuario ${usuario.username} reseteada exitosamente`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error reseteando contraseña:", error);
    res.status(500).json({
      success: false,
      error: "Error reseteando contraseña",
      message: error.message,
    });
  }
};

export {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  activarUsuario,
  resetearPassword,
};
