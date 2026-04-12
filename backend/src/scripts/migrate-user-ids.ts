/**
 * migrate-user-ids.ts
 * 将遗留数据（user_id 为空）迁移到第一个 super_admin/admin 用户下
 *
 * 用法: npx tsx backend/src/scripts/migrate-user-ids.ts
 */

import { initDb, getDb, saveDb } from "../db/client";

(async () => {
  await initDb();
  const db = getDb();

  // 找到第一个管理员用户
  const adminRes = db.exec(
    "SELECT id FROM users WHERE role IN ('super_admin', 'admin') ORDER BY created_at ASC LIMIT 1"
  );
  if (!adminRes.length || !adminRes[0].values.length) {
    console.log("❌ 未找到管理员用户，无法迁移");
    return;
  }
  const adminId = adminRes[0].values[0][0] as string;
  console.log(`📌 目标管理员: ${adminId}`);

  type Migration = { table: string; column: string };
  const migrations: Migration[] = [
    { table: "agents", column: "user_id" },
    { table: "conversations", column: "user_id" },
    { table: "messages", column: "user_id" },
    { table: "projects", column: "user_id" },
    { table: "tasks", column: "user_id" },
  ];

  let totalMigrated = 0;

  for (const { table, column } of migrations) {
    // 检查列是否存在
    try {
      const countRes = db.exec(
        `SELECT COUNT(*) FROM ${table} WHERE (${column} = '' OR ${column} IS NULL)`
      );
      if (!countRes.length) continue;
      const count = countRes[0].values[0][0] as number;
      if (count === 0) {
        console.log(`  ⏭️  ${table}: 无需迁移`);
        continue;
      }

      // 更新
      db.run(
        `UPDATE ${table} SET ${column} = ? WHERE (${column} = '' OR ${column} IS NULL)`,
        [adminId]
      );
      totalMigrated += count;
      console.log(`  ✅ ${table}: 迁移 ${count} 条`);
    } catch (err) {
      console.log(`  ⚠️  ${table}: 跳过 (${err})`);
    }
  }

  saveDb();
  console.log(`\n🎉 迁移完成！共迁移 ${totalMigrated} 条记录到管理员 ${adminId}`);
})();
