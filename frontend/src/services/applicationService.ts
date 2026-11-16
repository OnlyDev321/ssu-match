import { apiRequest } from "@/lib/api";
import { invalidateCachedQueries } from "@/lib/queryCache";
import { useAuthStore } from "@/stores/authStore";
import type { GroupApplication } from "@/lib/types";

/** Gửi lời giới thiệu và vai trò đã chọn từ chỉ tiêu thực của nhóm. */
export async function applyToGroup(groupId: string | number, statement: string, desiredRole?: string, applicantAnonymous = true): Promise<GroupApplication> {
  const application = await apiRequest<GroupApplication>(`/groups/${groupId}/applications`, {
    method: "POST",
    body: JSON.stringify({ statement, desiredRole, applicantAnonymous }),
  });
  invalidateCurrentUserApplicationData();
  return application;
}

export async function getGroupApplications(groupId: number): Promise<GroupApplication[]> {
  return apiRequest<GroupApplication[]>(`/groups/${groupId}/applications`);
}

export async function getMyApplications(): Promise<GroupApplication[]> {
  return apiRequest<GroupApplication[]>("/users/me/applications");
}

export async function acceptApplication(applicationId: number): Promise<GroupApplication> {
  const application = await apiRequest<GroupApplication>(`/applications/${applicationId}/accept`, { method: "PUT" });
  invalidateCurrentUserApplicationData(application.groupId);
  return application;
}

export async function rejectApplication(applicationId: number): Promise<GroupApplication> {
  const application = await apiRequest<GroupApplication>(`/applications/${applicationId}/reject`, { method: "PUT" });
  invalidateCurrentUserApplicationData(application.groupId);
  return application;
}

function invalidateCurrentUserApplicationData(groupId?: number) {
  const userId = useAuthStore.getState().userId;
  if (userId === null) return;
  invalidateCachedQueries(`private:${userId}:applications`);
  invalidateCachedQueries(`private:${userId}:groups`);
  invalidateCachedQueries("public:groups:");
  invalidateCachedQueries("public:statistics");
  if (groupId !== undefined) invalidateCachedQueries(`group-detail:${groupId}:`);
}
