// check-timestamps.js - Verificar estado de timestamps en todas las tablas
import db from "./models/index.js";

const checkAllTables = async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     VERIFICACIÓN DE TIMESTAMPS                            ║
║     Sistema de Gestión El Santuario                       ║
╚═══════════════════════════════════════════════════════════╝
`);

    try {
        // Obtener todas las tablas de la base de datos
        const [tables] = await db.sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

        console.log(`📊 Encontradas ${tables.length} tablas en la base de datos\n`);

        const results = [];

        for (const { TABLE_NAME } of tables) {
            const [columns] = await db.sequelize.query(`
        SHOW COLUMNS FROM ${TABLE_NAME}
      `);

            const hasCreatedAt = columns.some(c =>
                c.Field === 'created_at' || c.Field === 'fecha_venta' || c.Field === 'fecha_recepcion'
            );
            const hasUpdatedAt = columns.some(c => c.Field === 'updated_at');

            const createdAtColumn = columns.find(c =>
                c.Field === 'created_at' || c.Field === 'fecha_venta' || c.Field === 'fecha_recepcion'
            );

            results.push({
                tabla: TABLE_NAME,
                created_at: hasCreatedAt ? '✅' : '❌',
                created_field: createdAtColumn?.Field || 'N/A',
                updated_at: hasUpdatedAt ? '✅' : '❌',
                estado: (hasCreatedAt && hasUpdatedAt) ? '✅ COMPLETO' : '⚠️  PENDIENTE'
            });
        }

        console.log("═".repeat(80));
        console.table(results);
        console.log("═".repeat(80));

        const pending = results.filter(r => r.estado.includes('PENDIENTE'));
        const complete = results.filter(r => r.estado.includes('COMPLETO'));

        console.log(`\n📊 RESUMEN:`);
        console.log(`   ✅ Tablas completas: ${complete.length}`);
        console.log(`   ⚠️  Tablas pendientes: ${pending.length}`);

        if (pending.length > 0) {
            console.log(`\n⚠️  TABLAS QUE NECESITAN MIGRACIÓN:`);
            pending.forEach(t => {
                console.log(`   • ${t.tabla}`);
            });
            console.log(`\n💡 Ejecuta: node migrate-all-timestamps.js`);
        } else {
            console.log(`\n🎉 ¡Todas las tablas tienen timestamps configurados!`);
        }

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error durante la verificación:", error.message);
        process.exit(1);
    }
};

checkAllTables();