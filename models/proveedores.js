import { DataTypes, Sequelize } from "sequelize";

export default (sequelize) => {
  const proveedores = sequelize.define(
    "proveedores",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      contacto: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      telefono: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      direccion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ciudad: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      pais: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "Colombia",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 1,
      },
      fecha_creacion: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      fecha_actualizacion: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "proveedores",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
      ],
    }
  );

  // ⭐ ASOCIACIONES
  proveedores.associate = (models) => {
    proveedores.hasMany(models.recepciones, {
      as: "recepciones",
      foreignKey: "proveedor_id",
    });
  };
  return proveedores;
};
