// models/usuarios.js - REFACTORIZADO con Validaciones y Timestamps
import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const usuarios = sequelize.define(
    "usuarios",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: "username",
        validate: {
          notEmpty: {
            msg: "El nombre de usuario no puede estar vacío",
          },
          len: {
            args: [3, 50],
            msg: "El nombre de usuario debe tener entre 3 y 50 caracteres",
          },
          isAlphanumeric: {
            msg: "El nombre de usuario solo puede contener letras y números",
          },
        },
        comment: "Nombre de usuario único para autenticación",
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "La contraseña no puede estar vacía",
          },
          len: {
            args: [6, 255],
            msg: "La contraseña hasheada debe tener longitud apropiada",
          },
        },
        comment: "Contraseña hasheada con bcrypt (nunca texto plano)",
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: "email",
        validate: {
          notEmpty: {
            msg: "El email no puede estar vacío",
          },
          isEmail: {
            msg: "El email debe tener un formato válido",
          },
          len: {
            args: [5, 100],
            msg: "El email debe tener entre 5 y 100 caracteres",
          },
        },
        comment: "Email único del usuario",
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "El nombre no puede estar vacío",
          },
          len: {
            args: [2, 100],
            msg: "El nombre debe tener entre 2 y 100 caracteres",
          },
        },
        comment: "Nombre(s) del usuario",
      },
      apellido: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "El apellido no puede estar vacío",
          },
          len: {
            args: [2, 100],
            msg: "El apellido debe tener entre 2 y 100 caracteres",
          },
        },
        comment: "Apellido(s) del usuario",
      },
      rol: {
        type: DataTypes.ENUM("cajero", "administrador", "dueño", "ayudante"),
        allowNull: false,
        validate: {
          isIn: {
            args: [["cajero", "administrador", "dueño", "ayudante"]],
            msg: "El rol debe ser cajero, administrador, dueño o ayudante",
          },
        },
        comment: "Rol del usuario para control de permisos",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        validate: {
          isBoolean(value) {
            if (typeof value !== "boolean") {
              throw new Error("El campo activo debe ser verdadero o falso");
            }
          },
        },
        comment: "Estado del usuario: true = activo, false = inactivo",
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Fecha de creación del usuario",
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
        comment: "Última actualización del registro",
      },
    },
    {
      sequelize,
      tableName: "usuarios",
      // ✅ HABILITADO: Timestamps con mapping a campos existentes
      timestamps: true,
      createdAt: "fecha_creacion",
      updatedAt: "fecha_actualizacion",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "username",
          unique: true,
          using: "BTREE",
          fields: [{ name: "username" }],
        },
        {
          name: "email",
          unique: true,
          using: "BTREE",
          fields: [{ name: "email" }],
        },
        // Índice para filtros por rol y estado
        {
          name: "idx_usuarios_rol_activo",
          using: "BTREE",
          fields: [{ name: "rol" }, { name: "activo" }],
        },
        // Índice para búsquedas por nombre completo
        {
          name: "idx_usuarios_nombre_completo",
          using: "BTREE",
          fields: [{ name: "nombre" }, { name: "apellido" }, { name: "activo" }],
        },
        // Índice para filtros por estado
        {
          name: "idx_usuarios_activo",
          using: "BTREE",
          fields: [{ name: "activo" }],
        },
      ],
    }
  );

  // ASOCIACIONES
  usuarios.associate = (models) => {
    usuarios.hasMany(models.movimientos_inventario, {
      as: "movimientos_inventarios",
      foreignKey: "usuario_id",
    });
    usuarios.hasMany(models.recepciones, {
      as: "recepciones",
      foreignKey: "usuario_id",
    });
    usuarios.hasMany(models.ventas, {
      as: "venta",
      foreignKey: "usuario_id"
    });
  };

  return usuarios;
};