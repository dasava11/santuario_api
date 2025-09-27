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
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: "email",
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      apellido: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      rol: {
        type: DataTypes.ENUM("cajero", "administrador", "dueño", "ayudante"),
        allowNull: false,
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
      tableName: "usuarios",
      timestamps: false,
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
    usuarios.hasMany(models.ventas, { as: "venta", foreignKey: "usuario_id" });
  };
  return usuarios;
};
