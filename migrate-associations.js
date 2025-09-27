// migrate-associations.js - Script para agregar asociaciones automáticamente
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapa de asociaciones extraído de init-models.js
const associations = {
  productos: [
    `productos.belongsTo(models.categorias, { as: "categorias", foreignKey: "categoria_id" });`,
    `productos.hasMany(models.detalle_recepciones, { as: "detalle_recepciones", foreignKey: "producto_id" });`,
    `productos.hasMany(models.detalle_ventas, { as: "detalle_venta", foreignKey: "producto_id" });`,
    `productos.hasMany(models.movimientos_inventario, { as: "movimientos_inventarios", foreignKey: "producto_id" });`,
  ],
  categorias: [
    `categorias.hasMany(models.productos, { as: "productos", foreignKey: "categoria_id" });`,
  ],
  detalle_recepciones: [
    `detalle_recepciones.belongsTo(models.productos, { as: "producto", foreignKey: "producto_id" });`,
    `detalle_recepciones.belongsTo(models.recepciones, { as: "recepcion", foreignKey: "recepcion_id" });`,
  ],
  detalle_ventas: [
    `detalle_ventas.belongsTo(models.productos, { as: "producto", foreignKey: "producto_id" });`,
    `detalle_ventas.belongsTo(models.ventas, { as: "ventum", foreignKey: "venta_id" });`,
  ],
  movimientos_inventario: [
    `movimientos_inventario.belongsTo(models.productos, { as: "producto", foreignKey: "producto_id" });`,
    `movimientos_inventario.belongsTo(models.usuarios, { as: "usuario", foreignKey: "usuario_id" });`,
  ],
  recepciones: [
    `recepciones.belongsTo(models.proveedores, { as: "proveedor", foreignKey: "proveedor_id" });`,
    `recepciones.hasMany(models.detalle_recepciones, { as: "detalle_recepciones", foreignKey: "recepcion_id" });`,
    `recepciones.belongsTo(models.usuarios, { as: "usuario", foreignKey: "usuario_id" });`,
  ],
  proveedores: [
    `proveedores.hasMany(models.recepciones, { as: "recepciones", foreignKey: "proveedor_id" });`,
  ],
  usuarios: [
    `usuarios.hasMany(models.movimientos_inventario, { as: "movimientos_inventarios", foreignKey: "usuario_id" });`,
    `usuarios.hasMany(models.recepciones, { as: "recepciones", foreignKey: "usuario_id" });`,
    `usuarios.hasMany(models.ventas, { as: "venta", foreignKey: "usuario_id" });`,
  ],
  ventas: [
    `ventas.belongsTo(models.usuarios, { as: "usuario", foreignKey: "usuario_id" });`,
    `ventas.hasMany(models.detalle_ventas, { as: "detalle_venta", foreignKey: "venta_id" });`,
  ],
};

const migrateAssociations = async () => {
  console.log("🔄 Migrando asociaciones a modelos individuales...\n");

  const modelsDir = path.join(__dirname, "models");

  for (const [modelName, modelAssociations] of Object.entries(associations)) {
    try {
      const filePath = path.join(modelsDir, `${modelName}.js`);

      // Leer archivo actual
      let content = await fs.readFile(filePath, "utf8");

      // Verificar si ya tiene método associate
      if (content.includes(".associate =")) {
        console.log(`⚠️  ${modelName}.js ya tiene asociaciones - saltando`);
        continue;
      }

      // Encontrar el return statement
      const returnIndex = content.lastIndexOf("return ");
      if (returnIndex === -1) {
        console.log(`❌ No se encontró return statement en ${modelName}.js`);
        continue;
      }

      // Extraer nombre de la variable del modelo
      const returnLine = content.substring(returnIndex).split("\n")[0];
      const modelVar = returnLine.match(/return\s+(\w+)/)?.[1];

      if (!modelVar) {
        console.log(
          `❌ No se pudo extraer nombre de variable en ${modelName}.js`
        );
        continue;
      }

      // Crear método associate
      const associateMethod = `
  // ⭐ ASOCIACIONES
  ${modelVar}.associate = (models) => {
    ${modelAssociations
      .map((assoc) =>
        assoc.replace(new RegExp(`^\\s*${modelName}\\.`, "gm"), `${modelVar}.`)
      )
      .join("\n    ")}
  };
`;

      // Insertar antes del return
      const beforeReturn = content.substring(0, returnIndex);
      const afterReturn = content.substring(returnIndex);

      const newContent = beforeReturn + associateMethod + "\n  " + afterReturn;

      // Escribir archivo
      await fs.writeFile(filePath, newContent);
      console.log(
        `✅ ${modelName}.js - ${modelAssociations.length} asociaciones agregadas`
      );
    } catch (error) {
      console.error(`❌ Error procesando ${modelName}.js:`, error.message);
    }
  }

  console.log("\n🎉 Migración de asociaciones completada!");
  console.log("🚀 Ahora ejecuta: node test-models.js");
};

// Ejecutar migración
migrateAssociations();
