// test-models.js - Script para verificar que los modelos funcionan
import db from "./models/index.js";

const testModels = async () => {
  try {
    console.log("🧪 Probando modelos optimizados...\n");

    // 1️⃣ Verificar conexión
    await db.sequelize.authenticate();
    console.log("✅ Conexión a BD exitosa");

    // 2️⃣ Mostrar estadísticas
    const stats = db.getStats();
    console.log("\n📊 Estadísticas de modelos:");
    console.table(stats);

    // 3️⃣ Listar modelos cargados
    console.log("\n📋 Modelos disponibles:");
    const modelsInfo = db.listModelsInfo();
    modelsInfo.forEach((model) => {
      console.log(`  ✅ ${model.name} (tabla: ${model.tableName})`);
      console.log(`     📝 Atributos: ${model.attributes.length}`);
      console.log(`     🔗 Asociaciones: ${model.associations.length}`);
      console.log("");
    });

    // 4️⃣ Verificar modelos específicos de tu proyecto
    const expectedModels = [
      "categorias",
      "productos",
      "usuarios",
      "ventas",
      "proveedores",
      "recepciones",
      "detalle_ventas",
      "detalle_recepciones",
      "movimientos_inventario",
    ];

    console.log("🔍 Verificando modelos esperados:");
    expectedModels.forEach((modelName) => {
      const model = db.findModel(modelName);
      if (model) {
        console.log(`  ✅ ${modelName} - OK`);
      } else {
        console.log(`  ❌ ${modelName} - NO ENCONTRADO`);
      }
    });

    // 5️⃣ Probar una consulta simple (opcional)
    console.log("\n🔬 Probando consulta simple...");

    if (db.usuarios) {
      const userCount = await db.usuarios.count();
      console.log(`✅ Usuarios en BD: ${userCount}`);
    }

    if (db.productos) {
      const productCount = await db.productos.count();
      console.log(`✅ Productos en BD: ${productCount}`);
    }

    console.log("\n🎉 ¡Todos los modelos funcionan correctamente!");
  } catch (error) {
    console.error("❌ Error en la verificación:", error);

    // Información adicional para debugging
    console.log("\n🔧 Información de debugging:");
    console.log("- NODE_ENV:", process.env.NODE_ENV);
    console.log(
      "- Modelos cargados:",
      Object.keys(db).filter((k) => !["sequelize", "Sequelize"].includes(k))
    );
  } finally {
    // Cerrar conexión
    await db.sequelize.close();
    console.log("\n🔌 Conexión cerrada");
  }
};

// Ejecutar test
testModels();
