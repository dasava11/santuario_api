const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supermercado_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '0:00'
};

const pool = mysql.createPool(dbConfig);

// Función para probar la conexión
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    console.error('Verifica que MySQL esté ejecutándose y que las credenciales sean correctas');
    return false;
  }
}

// Función para ejecutar consultas
async function executeQuery(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error ejecutando consulta:', error);
    throw error;
  }
}

// Función para transacciones
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

// Probar conexión al inicializar
testConnection();

module.exports = {
  pool,
  executeQuery,
  executeTransaction,
  testConnection
};