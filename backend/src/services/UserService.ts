import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

const JWT_SECRET = process.env.JWT_SECRET || "repaceclaw_jwt_secret_2026";
const JWT_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;

export type UserRole = "super_admin" | "admin" | "user";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: string;
  avatar: string;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

function rowToUser(row: any[]): User {
  return {
    id: row[0] as string,
    username: row[1] as string,
    email: row[2] as string,
    role: row[3] as UserRole,
    status: row[4] as string,
    avatar: row[5] as string,
    last_login_at: row[6] as string,
    created_at: row[7] as string,
    updated_at: row[8] as string,
  };
}

export class UserService {
  // 注册
  static async register(input: RegisterInput): Promise<AuthResult> {
    const db = getDb();
    const now = new Date().toISOString();

    // 检查用户名/邮箱是否已存在
    const existEmail = db.exec("SELECT id FROM users WHERE email=?", [input.email]);
    if (existEmail.length && existEmail[0].values.length) {
      throw new Error("该邮箱已被注册");
    }
    const existUsername = db.exec("SELECT id FROM users WHERE username=?", [input.username]);
    if (existUsername.length && existUsername[0].values.length) {
      throw new Error("该用户名已被使用");
    }

    // 第一个注册的用户自动成为超级管理员
    const countRes = db.exec("SELECT COUNT(*) FROM users");
    const count = countRes.length ? (countRes[0].values[0][0] as number) : 0;
    const role: UserRole = count === 0 ? "super_admin" : (input.role || "user");

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    db.run(
      `INSERT INTO users (id, username, email, password_hash, role, status, avatar, last_login_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, input.username, input.email, passwordHash, role, "active", "", "", now, now]
    );
    saveDb();

    const user: User = {
      id, username: input.username, email: input.email,
      role, status: "active", avatar: "", last_login_at: "", created_at: now, updated_at: now,
    };

    const token = UserService.generateToken(user);
    return { user, token };
  }

  // 登录
  static async login(input: LoginInput): Promise<AuthResult> {
    const db = getDb();
    const now = new Date().toISOString();

    const res = db.exec(
      "SELECT id, username, email, password_hash, role, status, avatar, last_login_at, created_at, updated_at FROM users WHERE email=?",
      [input.email]
    );
    if (!res.length || !res[0].values.length) {
      throw new Error("邮箱或密码错误");
    }

    const row = res[0].values[0];
    const passwordHash = row[3] as string;
    const status = row[5] as string;

    if (status !== "active") {
      throw new Error("账号已被禁用，请联系管理员");
    }

    const valid = await bcrypt.compare(input.password, passwordHash);
    if (!valid) {
      throw new Error("邮箱或密码错误");
    }

    // 更新最后登录时间
    db.run("UPDATE users SET last_login_at=?, updated_at=? WHERE id=?", [now, now, row[0]]);
    saveDb();

    const user = rowToUser([row[0], row[1], row[2], row[4], row[5], row[6], now, row[8], row[9]]);
    const token = UserService.generateToken(user);
    return { user, token };
  }

  // 获取用户列表（管理员用）
  static listUsers(): User[] {
    const db = getDb();
    const res = db.exec(
      "SELECT id, username, email, role, status, avatar, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC"
    );
    if (!res.length) return [];
    return res[0].values.map(rowToUser);
  }

  // 获取单个用户
  static getUserById(id: string): User | null {
    const db = getDb();
    const res = db.exec(
      "SELECT id, username, email, role, status, avatar, last_login_at, created_at, updated_at FROM users WHERE id=?",
      [id]
    );
    if (!res.length || !res[0].values.length) return null;
    return rowToUser(res[0].values[0]);
  }

  // 更新用户角色/状态（管理员用）
  static updateUser(id: string, data: { role?: UserRole; status?: string; avatar?: string }): User | null {
    const db = getDb();
    const now = new Date().toISOString();
    if (data.role !== undefined) {
      db.run("UPDATE users SET role=?, updated_at=? WHERE id=?", [data.role, now, id]);
    }
    if (data.status !== undefined) {
      db.run("UPDATE users SET status=?, updated_at=? WHERE id=?", [data.status, now, id]);
    }
    if (data.avatar !== undefined) {
      db.run("UPDATE users SET avatar=?, updated_at=? WHERE id=?", [data.avatar, now, id]);
    }
    saveDb();
    return UserService.getUserById(id);
  }

  // 修改密码
  static async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const db = getDb();
    const res = db.exec("SELECT password_hash FROM users WHERE id=?", [id]);
    if (!res.length || !res[0].values.length) throw new Error("用户不存在");

    const hash = res[0].values[0][0] as string;
    const valid = await bcrypt.compare(oldPassword, hash);
    if (!valid) throw new Error("原密码错误");

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const now = new Date().toISOString();
    db.run("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", [newHash, now, id]);
    saveDb();
  }

  // 生成 JWT
  static generateToken(user: User): string {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  // 验证 JWT
  static verifyToken(token: string): { id: string; email: string; role: UserRole } {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: UserRole };
  }
}
