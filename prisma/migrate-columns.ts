import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "brochure_url" VARCHAR(1000);`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "metrics" JSONB;`
    );
    console.log("COLUMNS ADDED SUCCESSFULLY");
  } catch (e) {
    console.error("Migration error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
