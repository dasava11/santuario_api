import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const recepciones = sequelize.define(
    "recepciones",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      numero_factura: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "proveedores",
          key: "id",
        },
      },
      usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "usuarios",
          key: "id",
        },
      },
      fecha_recepcion: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      estado: {
        type: DataTypes.ENUM("pendiente", "procesada", "cancelada"),
        allowNull: true,
        defaultValue: "pendiente",
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "recepciones",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "proveedor_id",
          using: "BTREE",
          fields: [{ name: "proveedor_id" }],
        },
        {
          name: "usuario_id",
          using: "BTREE",
          fields: [{ name: "usuario_id" }],
        },
        {
          name: "idx_recepciones_fecha",
          using: "BTREE",
          fields: [{ name: "fecha_recepcion" }],
        },
      ],
    }
  );

  // ⭐ ASOCIACIONES
  recepciones.associate = (models) => {
    recepciones.belongsTo(models.proveedores, {
      as: "proveedor",
      foreignKey: "proveedor_id",
    });
    recepciones.hasMany(models.detalle_recepciones, {
      as: "detalle_recepciones",
      foreignKey: "recepcion_id",
    });
    recepciones.belongsTo(models.usuarios, {
      as: "usuario",
      foreignKey: "usuario_id",
    });
  };
  return recepciones;
};
