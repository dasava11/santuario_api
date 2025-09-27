import { sequelize } from "../config/database.js";
import initModels from "../models/init-models.js";

// Inicializar modelos
const models = initModels(sequelize);
const { proveedores } = models;

// Obtener todos los proveedores con filtros y paginación
const obtenerProveedores = async (req, res) => {
  try {
    const { search, activo, page, limit } = req.query;

    // Construir filtros dinámicos
    const where = {};

    if (activo !== "all") {
      where.activo = activo === "true";
    }

    // Filtro de búsqueda por nombre, contacto o email
    if (search) {
      where[sequelize.Op.or] = [
        { nombre: { [sequelize.Op.like]: `%${search}%` } },
        { contacto: { [sequelize.Op.like]: `%${search}%` } },
        { email: { [sequelize.Op.like]: `%${search}%` } },
      ];
    }

    // Calcular offset para paginación
    const offset = (page - 1) * limit;

    // Consulta con paginación
    const { count, rows: proveedoresData } = await proveedores.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["nombre", "ASC"]],
      distinct: true,
    });

    res.json({
      success: true,
      data: {
        proveedores: proveedoresData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error obteniendo proveedores:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo proveedores",
      message: error.message,
    });
  }
};

// Obtener proveedor por ID
const obtenerProveedorPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const proveedor = await proveedores.findOne({
      where: { id },
    });

    if (!proveedor) {
      return res.status(404).json({
        success: false,
        error: "Proveedor no encontrado",
      });
    }

    res.json({
      success: true,
      data: proveedor,
    });
  } catch (error) {
    console.error("Error obteniendo proveedor:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo proveedor",
      message: error.message,
    });
  }
};

// Crear nuevo proveedor
const crearProveedor = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      nombre,
      contacto,
      telefono,
      email,
      direccion,
      ciudad,
      pais,
      activo,
    } = req.body;

    // VALIDACIONES DE BASE DE DATOS

    // Verificar si ya existe un proveedor con el mismo nombre
    const existingByName = await proveedores.findOne({
      where: {
        nombre: { [sequelize.Op.like]: nombre.trim() },
      },
      transaction,
    });

    if (existingByName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe un proveedor llamado "${nombre.trim()}"`,
      });
    }

    // Verificar si el email ya existe (si se proporciona)
    if (email?.trim()) {
      const existingByEmail = await proveedores.findOne({
        where: { email: { [sequelize.Op.like]: email.trim() } },
        transaction,
      });

      if (existingByEmail) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `El email "${email.trim()}" ya está registrado`,
        });
      }
    }

    // Crear el proveedor
    const nuevoProveedor = await proveedores.create(
      {
        nombre: nombre.trim(),
        contacto: contacto?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null,
        direccion: direccion?.trim() || null,
        ciudad: ciudad?.trim() || null,
        pais: pais?.trim() || null,
        activo: activo ?? true,
      },
      { transaction }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${nombre.trim()} fue creado con éxito`,
      data: { id: nuevoProveedor.id },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creando proveedor:", error);
    res.status(500).json({
      success: false,
      error: "Error creando proveedor",
      message: error.message,
    });
  }
};

// Actualizar proveedor
const actualizarProveedor = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const fieldsToUpdate = { ...req.body }; // Joi ya validó los campos

    // Verificar si el proveedor existe
    const proveedor = await proveedores.findByPk(id, { transaction });
    if (!proveedor) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `No se encontró un proveedor con el id: ${id}`,
      });
    }

    // VALIDACIONES DE BASE DE DATOS

    // Verificar nombre único (si cambió)
    if (fieldsToUpdate.nombre && fieldsToUpdate.nombre !== proveedor.nombre) {
      const existingByName = await proveedores.findOne({
        where: {
          nombre: { [sequelize.Op.like]: fieldsToUpdate.nombre.trim() },
          id: { [sequelize.Op.ne]: id },
        },
        transaction,
      });

      if (existingByName) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Ya existe un proveedor llamado "${fieldsToUpdate.nombre.trim()}"`,
        });
      }
    }

    // Verificar email único (si cambió)
    if (fieldsToUpdate.email !== undefined) {
      const trimmedEmail = fieldsToUpdate.email?.trim() || null;
      if (trimmedEmail && trimmedEmail !== proveedor.email) {
        const duplicated = await proveedores.findOne({
          where: {
            email: { [sequelize.Op.like]: trimmedEmail },
            id: { [sequelize.Op.ne]: id },
          },
          transaction,
        });

        if (duplicated) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: `El email "${trimmedEmail}" ya está registrado`,
          });
        }
      }
    }

    // Limpiar campos para actualización
    if (fieldsToUpdate.nombre)
      fieldsToUpdate.nombre = fieldsToUpdate.nombre.trim();
    if (fieldsToUpdate.contacto !== undefined)
      fieldsToUpdate.contacto = fieldsToUpdate.contacto?.trim() || null;
    if (fieldsToUpdate.telefono !== undefined)
      fieldsToUpdate.telefono = fieldsToUpdate.telefono?.trim() || null;
    if (fieldsToUpdate.email !== undefined)
      fieldsToUpdate.email = fieldsToUpdate.email?.trim() || null;
    if (fieldsToUpdate.direccion !== undefined)
      fieldsToUpdate.direccion = fieldsToUpdate.direccion?.trim() || null;
    if (fieldsToUpdate.ciudad !== undefined)
      fieldsToUpdate.ciudad = fieldsToUpdate.ciudad?.trim() || null;
    if (fieldsToUpdate.pais !== undefined)
      fieldsToUpdate.pais = fieldsToUpdate.pais?.trim() || null;

    // Actualizar el proveedor
    await proveedor.update(fieldsToUpdate, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: `${
        fieldsToUpdate.nombre || proveedor.nombre
      } fue actualizado con éxito`,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando proveedor:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando proveedor",
      message: error.message,
    });
  }
};

// Eliminar proveedor (desactivar)
const eliminarProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    const proveedor = await proveedores.findByPk(id);
    if (!proveedor) {
      return res.status(404).json({
        success: false,
        error: "Proveedor no encontrado",
      });
    }

    await proveedor.update({ activo: false });

    res.json({
      success: true,
      message: "Proveedor desactivado exitosamente",
    });
  } catch (error) {
    console.error("Error eliminando proveedor:", error);
    res.status(500).json({
      success: false,
      error: "Error eliminando proveedor",
      message: error.message,
    });
  }
};

export {
  obtenerProveedores,
  obtenerProveedorPorId,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
};
