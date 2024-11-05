import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { bearer } from "better-auth/plugins";

const prisma = new PrismaClient();
export const auth = betterAuth({
  trustedOrigins: ["http://localhost:3000", "https://plgrzr.suryavirkapur.com"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  logger: { verboseLogging: true },
  plugins: [bearer()],
});
