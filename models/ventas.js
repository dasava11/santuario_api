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
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "usuarios",
          key: "id",
        },
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      metodo_pago: {
        type: DataTypes.ENUM("efectivo", "tarjeta", "transferencia"),
        allowNull: true,
        defaultValue: "efectivo",
      },
      estado: {
        // 🔥 NUEVO CAMPO
        type: DataTypes.ENUM("activa", "anulada"),
        allowNull: false,
        defaultValue: "activa",
        comment: "Estado de la venta: activa o anulada",
      },
      fecha_venta: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      fecha_anulacion: {
        // 🔥 NUEVO CAMPO: Para auditoría
        type: DataTypes.DATE,
        allowNull: true,
        comment: "Fecha en que se anuló la venta",
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
      },
      motivo_anulacion: {
        // 🔥 NUEVO CAMPO: Para auditoría
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Motivo de la anulación",
      },
    },
    {
      sequelize,
      tableName: "ventas",
      timestamps: false,
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
