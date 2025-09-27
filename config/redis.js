// config/redis.js
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379", // Ajusta según tu entorno
});

redisClient.on("error", (err) => {
  console.error("❌ Error en Redis:", err);
});

redisClient.on("connect", () => {
  console.log("✅ Conectado a Redis");
});

await redisClient.connect();

export default redisClient;
