const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name IN ('investor', 'expected_completion', 'scale', 'contract_package')
    ORDER BY column_name
  `);
  const backfill = await prisma.$queryRawUnsafe(`
    SELECT slug,
      investor IS NOT NULL AS investor_set,
      expected_completion IS NOT NULL AS expected_completion_set,
      scale IS NOT NULL AS scale_set,
      contract_package IS NOT NULL AS contract_package_set,
      location IS NOT NULL AS location_set,
      length(investor) AS investor_length
    FROM projects
    WHERE slug = 'tt-avio'
  `);
  const roleCounts = await prisma.$queryRawUnsafe(`
    SELECT r.role::text AS role, count(DISTINCT r.user_id)::int AS active_users
    FROM admin_user_roles r
    JOIN admin_users u ON u.id = r.user_id
    WHERE u.status = 'ACTIVE'
    GROUP BY r.role
    ORDER BY r.role
  `);
  console.log(JSON.stringify({ columns, backfill, roleCounts }));
}

main().finally(() => prisma.$disconnect());
