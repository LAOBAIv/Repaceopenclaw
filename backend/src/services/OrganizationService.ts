import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface DepartmentNode {
  id: string;
  departmentCode: string;
  name: string;
  parentId: string | null;
  ownerUserId: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  children: DepartmentNode[];
}

export interface OrganizationUser {
  id: string;
  userCode?: string;
  username: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  status: string;
  avatar: string;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  primaryDepartmentId: string | null;
  primaryDepartmentName: string | null;
  primaryDepartmentCode: string | null;
}

function execRows(db: any, sql: string, params: any[] = []): any[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => {
      obj[c] = row[i];
    });
    return obj;
  });
}

function toDepartmentNode(row: any): DepartmentNode {
  return {
    id: String(row.id),
    departmentCode: String(row.department_code || ""),
    name: String(row.name || ""),
    parentId: row.parent_id ? String(row.parent_id) : null,
    ownerUserId: String(row.owner_user_id || ""),
    description: String(row.description || ""),
    status: String(row.status || "active"),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    userCount: Number(row.user_count || 0),
    children: [],
  };
}

function departmentCode(): string {
  return `dept_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export class OrganizationService {
  static listDepartments(): DepartmentNode[] {
    const db = getDb();
    const rows = execRows(
      db,
      `SELECT d.*, COALESCE(u.user_count, 0) AS user_count
       FROM departments d
       LEFT JOIN (
         SELECT department_id, COUNT(*) AS user_count
         FROM user_org_scope
         WHERE status = 'active' AND is_primary = 1 AND department_id IS NOT NULL
         GROUP BY department_id
       ) u ON u.department_id = d.id
       ORDER BY d.created_at ASC`
    );
    return rows.map(toDepartmentNode);
  }

  static getDepartmentById(id: string): DepartmentNode | null {
    const db = getDb();
    const rows = execRows(
      db,
      `SELECT d.*, COALESCE(u.user_count, 0) AS user_count
       FROM departments d
       LEFT JOIN (
         SELECT department_id, COUNT(*) AS user_count
         FROM user_org_scope
         WHERE status = 'active' AND is_primary = 1 AND department_id IS NOT NULL
         GROUP BY department_id
       ) u ON u.department_id = d.id
       WHERE d.id = ?`,
      [id]
    );
    return rows.length ? toDepartmentNode(rows[0]) : null;
  }

  static buildDepartmentTree(): DepartmentNode[] {
    const list = this.listDepartments();
    const map = new Map<string, DepartmentNode>();
    const roots: DepartmentNode[] = [];

    list.forEach((item) => map.set(item.id, { ...item, children: [] }));

    for (const item of map.values()) {
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  static createDepartment(input: {
    name: string;
    parentId?: string | null;
    ownerUserId?: string;
    description?: string;
    status?: string;
  }): DepartmentNode {
    const db = getDb();
    const now = new Date().toISOString();
    const id = uuidv4();
    const code = departmentCode();

    if (input.parentId) {
      const parent = this.getDepartmentById(input.parentId);
      if (!parent) throw new Error("上级组织不存在");
    }

    db.run(
      `INSERT INTO departments (
        id, department_code, name, parent_id, owner_user_id, description, status, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        code,
        input.name,
        input.parentId || null,
        input.ownerUserId || "",
        input.description || "",
        input.status || "active",
        now,
        now,
      ]
    );
    saveDb();
    return this.getDepartmentById(id)!;
  }

  static updateDepartment(
    id: string,
    input: { name?: string; parentId?: string | null; ownerUserId?: string; description?: string; status?: string }
  ): DepartmentNode | null {
    const db = getDb();
    const existing = this.getDepartmentById(id);
    if (!existing) return null;

    if (input.parentId === id) {
      throw new Error("组织不能挂到自己下面");
    }

    if (input.parentId) {
      const parent = this.getDepartmentById(input.parentId);
      if (!parent) throw new Error("上级组织不存在");

      const descendants = new Set<string>();
      const walk = (nodeId: string) => {
        const children = this.listDepartments().filter((item) => item.parentId === nodeId);
        for (const child of children) {
          if (!descendants.has(child.id)) {
            descendants.add(child.id);
            walk(child.id);
          }
        }
      };
      walk(id);
      if (descendants.has(input.parentId)) {
        throw new Error("不能把组织挂到自己的下级节点");
      }
    }

    const now = new Date().toISOString();
    db.run(
      `UPDATE departments
       SET name = ?,
           parent_id = ?,
           owner_user_id = ?,
           description = ?,
           status = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        input.name ?? existing.name,
        input.parentId === undefined ? existing.parentId : input.parentId,
        input.ownerUserId ?? existing.ownerUserId,
        input.description ?? existing.description,
        input.status ?? existing.status,
        now,
        id,
      ]
    );
    saveDb();
    return this.getDepartmentById(id);
  }

  static deleteDepartment(id: string): void {
    const db = getDb();
    const existing = this.getDepartmentById(id);
    if (!existing) throw new Error("组织不存在");

    const childRows = execRows(db, "SELECT id FROM departments WHERE parent_id = ? LIMIT 1", [id]);
    if (childRows.length) {
      throw new Error("请先删除或迁移下级组织");
    }

    const userRows = execRows(
      db,
      "SELECT id FROM user_org_scope WHERE department_id = ? AND status = 'active' LIMIT 1",
      [id]
    );
    if (userRows.length) {
      throw new Error("该组织下还有用户，不能删除");
    }

    db.run("DELETE FROM departments WHERE id = ?", [id]);
    saveDb();
  }

  static listUsersWithOrganization(): OrganizationUser[] {
    const db = getDb();
    const rows = execRows(
      db,
      `SELECT
         u.id,
         u.user_code,
         u.username,
         u.email,
         u.role,
         u.status,
         u.avatar,
         u.last_login_at,
         u.created_at,
         u.updated_at,
         d.id AS primary_department_id,
         d.name AS primary_department_name,
         d.department_code AS primary_department_code
       FROM users u
       LEFT JOIN user_org_scope uos
         ON uos.user_id = u.id AND uos.is_primary = 1 AND uos.status = 'active'
       LEFT JOIN departments d ON d.id = uos.department_id
       ORDER BY u.created_at DESC`
    );

    return rows.map((row) => ({
      id: String(row.id),
      userCode: String(row.user_code || ""),
      username: String(row.username || ""),
      email: String(row.email || ""),
      role: (row.role || "user") as "super_admin" | "admin" | "user",
      status: String(row.status || "active"),
      avatar: String(row.avatar || ""),
      lastLoginAt: String(row.last_login_at || ""),
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
      primaryDepartmentId: row.primary_department_id ? String(row.primary_department_id) : null,
      primaryDepartmentName: row.primary_department_name ? String(row.primary_department_name) : null,
      primaryDepartmentCode: row.primary_department_code ? String(row.primary_department_code) : null,
    }));
  }

  static assignPrimaryDepartment(userId: string, departmentId: string | null): OrganizationUser | null {
    const db = getDb();
    const userRows = execRows(db, "SELECT id FROM users WHERE id = ?", [userId]);
    if (!userRows.length) throw new Error("用户不存在");

    if (departmentId) {
      const deptRows = execRows(db, "SELECT id FROM departments WHERE id = ?", [departmentId]);
      if (!deptRows.length) throw new Error("组织不存在");
    }

    const now = new Date().toISOString();

    db.run("DELETE FROM user_org_scope WHERE user_id = ? AND is_primary = 1", [userId]);

    if (departmentId) {
      db.run(
        `INSERT INTO user_org_scope (
          id, user_id, department_id, role_id, permission_template_id, title,
          is_primary, status, joined_at, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuidv4(),
          userId,
          departmentId,
          null,
          null,
          "组织成员",
          1,
          "active",
          now,
          now,
          now,
        ]
      );
    }

    saveDb();
    return this.listUsersWithOrganization().find((item) => item.id === userId) || null;
  }
}
