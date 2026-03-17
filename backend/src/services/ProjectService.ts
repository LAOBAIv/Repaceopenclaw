import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../db/client";

export interface WorkflowNode {
  id: string;
  name: string;
  nodeType: "serial" | "parallel";
  agentIds: string[];
  taskDesc: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: "active" | "archived";
  // Workflow fields (from AgentConsole)
  goal: string;
  priority: "high" | "mid" | "low";
  startTime: string;
  endTime: string;
  decisionMaker: string;
  workflowNodes: WorkflowNode[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentNode {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  content: string;
  order: number;
  assignedAgentIds: string[];
  createdAt: string;
  updatedAt: string;
  children?: DocumentNode[];
}

const rowToProject = (obj: any): Project => ({
  id: obj.id,
  title: obj.title,
  description: obj.description,
  tags: JSON.parse(obj.tags || "[]"),
  status: obj.status,
  goal: obj.goal || "",
  priority: (obj.priority || "mid") as Project["priority"],
  startTime: obj.start_time || "",
  endTime: obj.end_time || "",
  decisionMaker: obj.decision_maker || "",
  workflowNodes: JSON.parse(obj.workflow_nodes || "[]"),
  createdBy: obj.created_by || null,
  createdAt: obj.created_at,
  updatedAt: obj.updated_at,
});

const rowToDoc = (obj: any): DocumentNode => ({
  id: obj.id,
  projectId: obj.project_id,
  parentId: obj.parent_id || null,
  title: obj.title,
  content: obj.content,
  order: obj.node_order,
  assignedAgentIds: JSON.parse(obj.assigned_agent_ids || "[]"),
  createdAt: obj.created_at,
  updatedAt: obj.updated_at,
});

function execToRows(db: any, sql: string, params?: any[]): any[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

export const ProjectService = {
  list(): Project[] {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM projects ORDER BY updated_at DESC");
    return rows.map(rowToProject);
  },

  getById(id: string): Project | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM projects WHERE id=?", [id]);
    if (!rows.length) return null;
    return rowToProject(rows[0]);
  },

  create(data: {
    title: string;
    description: string;
    tags: string[];
    status?: "active" | "archived";
    goal?: string;
    priority?: "high" | "mid" | "low";
    startTime?: string;
    endTime?: string;
    decisionMaker?: string;
    workflowNodes?: WorkflowNode[];
    createdBy?: string;
  }): Project {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const status = data.status ?? "active";
    db.run(
      `INSERT INTO projects (id, title, description, tags, status, goal, priority, start_time, end_time, decision_maker, workflow_nodes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, data.title, data.description, JSON.stringify(data.tags), status,
        data.goal || "", data.priority || "mid",
        data.startTime || "", data.endTime || "",
        data.decisionMaker || "",
        JSON.stringify(data.workflowNodes || []),
        data.createdBy || null,
        now, now,
      ]
    );
    saveDb();
    return {
      id, title: data.title, description: data.description, tags: data.tags,
      status,
      goal: data.goal || "", priority: data.priority || "mid",
      startTime: data.startTime || "", endTime: data.endTime || "",
      decisionMaker: data.decisionMaker || "",
      workflowNodes: data.workflowNodes || [],
      createdBy: data.createdBy || null,
      createdAt: now, updatedAt: now,
    };
  },

  update(id: string, data: Partial<{
    title: string;
    description: string;
    tags: string[];
    status: "active" | "archived";
    goal: string;
    priority: "high" | "mid" | "low";
    startTime: string;
    endTime: string;
    decisionMaker: string;
    workflowNodes: WorkflowNode[];
    createdBy: string;
  }>): Project | null {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE projects SET title=?, description=?, tags=?, status=?, goal=?, priority=?, start_time=?, end_time=?, decision_maker=?, workflow_nodes=?, created_by=?, updated_at=? WHERE id=?`,
      [
        updated.title, updated.description, JSON.stringify(updated.tags), updated.status,
        updated.goal, updated.priority,
        updated.startTime, updated.endTime,
        updated.decisionMaker,
        JSON.stringify(updated.workflowNodes),
        updated.createdBy || null,
        now, id,
      ]
    );
    saveDb();
    return { ...updated, updatedAt: now };
  },

  delete(id: string): boolean {
    const db = getDb();
    db.run("DELETE FROM projects WHERE id=?", [id]);
    saveDb();
    return true;
  },

  // Document tree operations
  getDocumentTree(projectId: string): DocumentNode[] {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM documents WHERE project_id=? ORDER BY node_order", [projectId]);
    const nodes = rows.map(rowToDoc);
    return buildTree(nodes);
  },

  createDocument(data: { projectId: string; parentId?: string; title: string }): DocumentNode {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    // Get max order
    const orderRows = execToRows(db, "SELECT MAX(node_order) as max_order FROM documents WHERE project_id=? AND parent_id IS ?", [data.projectId, data.parentId || null]);
    const order = (orderRows[0]?.max_order ?? -1) + 1;
    db.run(
      `INSERT INTO documents (id, project_id, parent_id, title, content, node_order, assigned_agent_ids, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, data.projectId, data.parentId || null, data.title, "", order, "[]", now, now]
    );
    saveDb();
    return { id, projectId: data.projectId, parentId: data.parentId || null, title: data.title, content: "", order, assignedAgentIds: [], createdAt: now, updatedAt: now };
  },

  updateDocument(id: string, data: Partial<{ title: string; content: string; assignedAgentIds: string[]; parentId: string | null; order: number }>): DocumentNode | null {
    const db = getDb();
    const rows = execToRows(db, "SELECT * FROM documents WHERE id=?", [id]);
    if (!rows.length) return null;
    const existing = rowToDoc(rows[0]);
    const updated = { ...existing, ...data };
    const now = new Date().toISOString();
    db.run(
      `UPDATE documents SET title=?, content=?, assigned_agent_ids=?, parent_id=?, node_order=?, updated_at=? WHERE id=?`,
      [updated.title, updated.content, JSON.stringify(updated.assignedAgentIds), updated.parentId, updated.order, now, id]
    );
    saveDb();
    return { ...updated, updatedAt: now };
  },

  deleteDocument(id: string): boolean {
    const db = getDb();
    // 递归删除子节点，避免产生孤儿节点
    // !! 不依赖 DB 级联（documents.parent_id 无 CASCADE），必须手动递归
    const deleteRecursive = (nodeId: string) => {
      const children = execToRows(db, "SELECT id FROM documents WHERE parent_id=?", [nodeId]);
      for (const child of children) {
        deleteRecursive(child.id);
      }
      db.run("DELETE FROM documents WHERE id=?", [nodeId]);
    };
    deleteRecursive(id);
    saveDb();
    return true;
  },
};

function buildTree(nodes: DocumentNode[]): DocumentNode[] {
  const map = new Map<string, DocumentNode>();
  nodes.forEach((n) => { map.set(n.id, { ...n, children: [] }); });
  const roots: DocumentNode[] = [];
  map.forEach((node) => {
    if (!node.parentId) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) parent.children!.push(node);
    }
  });
  return roots;
}
