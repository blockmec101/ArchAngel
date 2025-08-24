import { createClient } from "redis"

const client = createClient({
  url: process.env.REDIS_URL,
})

client.on("error", (err) => console.error("Redis Client Error", err))

export async function connectRedis() {
  await client.connect()
}

export async function getCache(key: string): Promise<string | null> {
  return await client.get(key)
}

export async function setCache(key: string, value: string, expireSeconds: number): Promise<void> {
  await client.set(key, value, { EX: expireSeconds })
}

export async function invalidateCache(key: string): Promise<void> {
  await client.del(key)
}

export { client }

