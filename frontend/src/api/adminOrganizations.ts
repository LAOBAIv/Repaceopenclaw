import apiClient from "./client";

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

export const adminOrganizationsApi = {
  async tree(): Promise<DepartmentNode[]> {
    const res = await apiClient.get("/admin/organizations/tree");
    return res.data.data || [];
  },

  async departments(): Promise<DepartmentNode[]> {
    const res = await apiClient.get("/admin/organizations/departments");
    return res.data.data || [];
  },

  async createDepartment(data: {
    name: string;
    parentId?: string | null;
    ownerUserId?: string;
    description?: string;
    status?: "active" | "disabled";
  }): Promise<DepartmentNode> {
    const res = await apiClient.post("/admin/organizations/departments", data);
    return res.data.data;
  },

  async updateDepartment(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      ownerUserId?: string;
      description?: string;
      status?: "active" | "disabled";
    }
  ): Promise<DepartmentNode> {
    const res = await apiClient.put(`/admin/organizations/departments/${id}`, data);
    return res.data.data;
  },

  async deleteDepartment(id: string): Promise<void> {
    await apiClient.delete(`/admin/organizations/departments/${id}`);
  },

  async users(): Promise<OrganizationUser[]> {
    const res = await apiClient.get("/admin/organizations/users");
    return res.data.data || [];
  },

  async assignUserDepartment(userId: string, departmentId: string | null): Promise<OrganizationUser> {
    const res = await apiClient.put(`/admin/organizations/users/${userId}/department`, { departmentId });
    return res.data.data;
  },
};
