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
      fecha_venta: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
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
          name: "usuario_id",
          using: "BTREE",
          fields: [{ name: "usuario_id" }],
        },
        {
          name: "idx_ventas_fecha",
          using: "BTREE",
          fields: [{ name: "fecha_venta" }],
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
    ventas.hasMany(models.detalle_ventas, {
      as: "detalle_venta",
      foreignKey: "venta_id",
    });
  };
  return ventas;
};
