import { PrismaClient } from "./generated/prisma";

declare global {
  var prismaClient: InstanceType<typeof PrismaClient> | undefined;
}

export const db = globalThis.prismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = db;
}
