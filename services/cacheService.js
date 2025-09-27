import redisClient from "../config/redis.js";

export const cacheGet = async (key) => {
  const cached = await redisClient.get(key);
  return cached ? JSON.parse(cached) : null;
};

export const cacheSet = async (key, data, ttl = 300) => {
  await redisClient.setEx(key, ttl, JSON.stringify(data));
};
