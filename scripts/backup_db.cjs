const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../src/generated/client");

const prisma = new PrismaClient();

async function main() {
  const backupDir = path.join(process.cwd(), "data", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `ksweet-${stamp}.db`).replace(/\\/g, "/");

  await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath}';`);
  console.log(JSON.stringify({ ok: true, backupPath }));
}

main()
  .catch((err) => {
    console.error("Backup error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
