import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const ventas = sequelize.define(
    "ventas",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      numero_venta: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true, // 🔥 AGREGADO: Evitar duplicados
        validate: {
          notEmpty: {
            msg: "El número de venta no puede estar vacío",
          },
          len: {
            args: [1, 100],
            msg: "El número de venta debe tener entre 1 y 100 caracteres",
          },
        },
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "usuarios",
          key: "id",
        },
        validate: {
          isInt: {
            msg: "El ID del usuario debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID del usuario debe ser mayor a 0",
          },
        },
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: {
          min: {
            args: [0.01],
            msg: "El total debe ser mayor a 0",
          },
          isDecimal: {
            msg: "El total debe ser un número decimal válido",
          },
        },
      },
      metodo_pago: {
        type: DataTypes.ENUM("efectivo", "tarjeta", "transferencia"),
        allowNull: true,
        defaultValue: "efectivo",
        validate: {
          isIn: {
            args: [["efectivo", "tarjeta", "transferencia"]],
            msg: "Método de pago inválido",
          },
        },
      },
      estado: {
        // 🔥 NUEVO CAMPO
        type: DataTypes.ENUM("activa", "anulada"),
        allowNull: false,
        defaultValue: "activa",
        comment: "Estado de la venta: activa o anulada",
        validate: {
          isIn: {
            args: [["activa", "anulada"]],
            msg: "Estado de venta inválido",
          },
        },
      },
      fecha_venta: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      fecha_anulacion: {
        // 🔥 NUEVO CAMPO: Para auditoría
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Fecha en que se anuló la venta",
        validate: {
          isAfterFechaVenta(value) {
            if (value && this.fecha_venta && value < this.fecha_venta) {
              throw new Error(
                "La fecha de anulación no puede ser anterior a la fecha de venta"
              );
            }
          },
        },
      },
      usuario_anulacion_id: {
        // 🔥 NUEVO CAMPO: Para auditoría
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "usuarios",
          key: "id",
        },
        comment: "Usuario que anuló la venta",
        validate: {
          isInt: {
            msg: "El ID del usuario de anulación debe ser un número entero",
          },
          min: {
            args: [1],
            msg: "El ID del usuario de anulación debe ser mayor a 0",
          },
        },
      },
      motivo_anulacion: {
        // 🔥 NUEVO CAMPO: Para auditoría
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Motivo de la anulación",
        validate: {
          len: {
            args: [10, 1000],
            msg: "El motivo de anulación debe tener entre 10 y 1000 caracteres",
          },
        },
      },
      // ✅ NUEVO CAMPO: Para auditoría de actualizaciones
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Última actualización del registro",
      },
    },
    {
      sequelize,
      tableName: "ventas",
      timestamps: true,
      createdAt: "fecha_venta", // Mapear a campo existente
      updatedAt: "updated_at", // Mapear a nuevo campo
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "numero_venta_unique", // 🔥 NUEVO ÍNDICE
          unique: true,
          using: "BTREE",
          fields: [{ name: "numero_venta" }],
        },
        {
          name: "usuario_id",
          using: "BTREE",
          fields: [{ name: "usuario_id" }],
        },
        {
          name: "idx_ventas_fecha",
          using: "BTREE",
          fields: [{ name: "fecha_venta" }],
        },
        {
          name: "idx_ventas_estado", // 🔥 NUEVO ÍNDICE
          using: "BTREE",
          fields: [{ name: "estado" }],
        },
        // ✅ NUEVO ÍNDICE: Para búsquedas por método de pago
        {
          name: "idx_ventas_metodo_pago",
          using: "BTREE",
          fields: [{ name: "metodo_pago" }],
        },
        // ✅ NUEVO ÍNDICE COMPUESTO: Para reportes por usuario y fecha
        {
          name: "idx_ventas_usuario_fecha",
          using: "BTREE",
          fields: [{ name: "usuario_id" }, { name: "fecha_venta" }],
        },
      ],
    }
  );
  // ASOCIACIONES
  ventas.associate = (models) => {
    ventas.belongsTo(models.usuarios, {
      as: "usuario",
      foreignKey: "usuario_id",
    });
    // 🔥 NUEVA ASOCIACIÓN: Usuario que anuló
    ventas.belongsTo(models.usuarios, {
      as: "usuario_anulacion",
      foreignKey: "usuario_anulacion_id",
    });
    ventas.hasMany(models.detalle_ventas, {
      as: "detalle_venta",
      foreignKey: "venta_id",
    });
  };
  return ventas;
};
