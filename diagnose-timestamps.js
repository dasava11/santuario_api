// diagnose-timestamps.js - Diagnóstico detallado de columnas
import db from "./models/index.js";

const diagnose = async () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     DIAGNÓSTICO DETALLADO DE TIMESTAMPS                   ║
╚═══════════════════════════════════════════════════════════╝
`);

  try {
    // Lista de tablas a verificar
    const tables = [
      "ventas",
      "detalle_ventas",
      "categorias",
      "productos",
      "proveedores",
      "usuarios",
      "recepciones",
      "detalle_recepciones",
      "movimientos_inventario",
    ];

    for (const tableName of tables) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Tabla: ${tableName.toUpperCase()}`);
      console.log("=".repeat(60));

      // Obtener TODAS las columnas
      const [columns] = await db.sequelize.query(`
        SHOW COLUMNS FROM ${tableName}
      `);

      // Buscar columnas relacionadas con timestamps
      const timestampColumns = columns.filter(
        (col) =>
          col.Field.includes("created") ||
          col.Field.includes("updated") ||
          col.Field.includes("fecha")
      );

      if (timestampColumns.length === 0) {
        console.log("⚠️  No se encontraron columnas de timestamp");
      } else {
        console.log("\n📊 Columnas de timestamp encontradas:");
        timestampColumns.forEach((col) => {
          console.log(
            `   • ${col.Field.padEnd(25)} | Tipo: ${col.Type.padEnd(
              15
            )} | Null: ${col.Null} | Default: ${col.Default || "N/A"}`
          );
        });
      }

      // Verificar qué espera el modelo
      const model = db[tableName];
      if (model && model.rawAttributes) {
        console.log("\n🔍 Lo que espera el modelo Sequelize:");
        const timestampAttrs = Object.keys(model.rawAttributes).filter(
          (attr) =>
            attr.includes("created") ||
            attr.includes("updated") ||
            attr.includes("fecha")
        );
        timestampAttrs.forEach((attr) => {
          const field = model.rawAttributes[attr];
          console.log(
            `   • ${attr.padEnd(
              25
            )} | Required: ${!field.allowNull} | HasDefault: ${!!field.defaultValue}`
          );
        });
      }

      // Verificar config de timestamps
      if (model && model.options) {
        console.log("\n⚙️  Configuración de timestamps:");
        console.log(`   • timestamps: ${model.options.timestamps}`);
        console.log(`   • createdAt: ${model.options.createdAt || "N/A"}`);
        console.log(`   • updatedAt: ${model.options.updatedAt || "N/A"}`);
      }

      // Contar registros
      const [countResult] = await db.sequelize.query(`
        SELECT COUNT(*) as total FROM ${tableName}
      `);
      console.log(`\n📈 Total de registros: ${countResult[0].total}`);
    }

    console.log("\n\n" + "=".repeat(60));
    console.log("✅ Diagnóstico completado");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error durante el diagnóstico:", error.message);
    process.exit(1);
  }
};

diagnose();
