import { Sequelize, Op } from "sequelize";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import config from "./config.js";

dotenv.config();

// Detectar el entorno actual
const env = process.env.NODE_ENV || "development";
const dbConfig = config[env];

// === Instancia Sequelize ===
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    define: {
      timestamps: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: env === "development" ? console.log : false,
  }
);

// === Pool mysql2 para consultas raw ===
const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  port: dbConfig.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "local",
});

// === Funciones auxiliares ===
async function executeQuery(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error("❌ Error ejecutando consulta:", error);
    throw error;
  }
}

async function executeTransaction(queries) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = [];
    for (const { sql, params } of queries) {
      const [result] = await connection.execute(sql, params);
      results.push(result);
    }

    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// === Test conexión Sequelize ===
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log(`✅ Conectado a BD [${env}] con Sequelize`);
  } catch (error) {
    console.error("❌ Error conexión Sequelize:", error.message);
  }
}

testConnection();

export { sequelize, pool, executeQuery, executeTransaction, Op };
