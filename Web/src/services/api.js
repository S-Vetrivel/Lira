import axios from "axios";
import toast from "react-hot-toast";

// 1. API URL configuration (same-origin `/v3` in unified Nginx production, localhost:4000 in Vite dev)
const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.port !== "5173" ? "/v3" : "http://localhost:4000/v3");
export const GOOGLE_AUTH_URL = `${API_URL}/auth/google`;

// 2. Axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 3. Request Interceptor for Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("lira_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 4. Response Interceptor for Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const silentRoutes = ["/auth/me", "/notifications", "/users/join-request"];
    if (error.config && silentRoutes.some((route) => error.config.url?.includes(route))) {
      return Promise.reject(error);
    }

    const { status, data } = error.response || {};
    const message = data?.message || "An unexpected error occurred.";

    if (status === 401) {
      const publicPaths = ["/", "/welcome", "/landing", "/login", "/signup"];
      const currentPath = window.location.pathname;
      const isAuthSubmission =
        error.config?.url?.includes("/auth/login") ||
        error.config?.url?.includes("/auth/signup");

      if (!isAuthSubmission) {
        localStorage.removeItem("lira_token");
        localStorage.removeItem("lira_user");
        if (!publicPaths.includes(currentPath)) {
          toast.error(message, { id: message });
          window.location.href = "/login";
        }
      } else {
        toast.error(message, { id: message });
      }
    } else if (status >= 400 && status < 500) {
      toast.error(message, { id: message });
    } else if (status >= 500) {
      toast.error("Server error. Please try again shortly.", { id: "server-error" });
    }

    return Promise.reject(error);
  }
);

export default api;

// ==========================================
// AUTHENTICATION APIs
// ==========================================
export async function loginUser(email, password) {
  try {
    const res = await api.post("/auth/login", { email, password });
    if (res.data?.token) {
      localStorage.setItem("lira_token", res.data.token);
    }
    toast.success(res.data.message || "Welcome back!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Login failed" };
  }
}

export async function signUpUser(formData) {
  try {
    const res = await api.post("/auth/signup", formData);
    if (res.data?.token) {
      localStorage.setItem("lira_token", res.data.token);
    }
    toast.success(res.data.message || "Account created successfully!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Signup failed" };
  }
}

export async function demoLoginUser() {
  toast.error("Demo logins have been permanently removed.");
  return { success: false, message: "Demo logins removed" };
}

export async function checkAuth() {
  try {
    const res = await api.get("/auth/me");
    return { isAuthenticated: true, user: res.data.user };
  } catch (error) {
    return { isAuthenticated: false, user: null };
  }
}

export async function logoutUser() {
  try {
    await api.get("/auth/logout");
  } catch (err) {
    // continue cleanup
  } finally {
    localStorage.removeItem("lira_token");
    localStorage.removeItem("lira_user");
    toast.success("Logged out");
    return { success: true };
  }
}

export async function googleOneTapLogin(token) {
  try {
    const res = await api.post("/auth/google/onetap", { token });
    toast.success(res.data.message || "Google Login Successful!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Google login failed" };
  }
}

// ==========================================
// TEAM JOIN REQUEST & FOLLOW TRACKING APIs
// ==========================================
export async function getJoinRequestStatus() {
  try {
    const res = await api.get("/users/join-request/status");
    return { success: true, user: res.data.user, status: res.data.status, publicId: res.data.publicId };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to fetch status" };
  }
}

export async function submitJoinRequest(payload) {
  try {
    const res = await api.post("/users/join-request/submit", payload);
    toast.success(res.data.message || "Join request submitted!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to submit request" };
  }
}

export async function getPendingJoinRequests() {
  try {
    const res = await api.get("/users/join-requests");
    return { success: true, requests: res.data.requests || [] };
  } catch (error) {
    return { success: false, requests: [] };
  }
}

export async function approveJoinRequest(id, payload = {}) {
  try {
    const res = await api.put(`/users/join-requests/${id}/approve`, payload);
    toast.success(res.data.message || "Candidate approved!");
    return { success: true, user: res.data.user };
  } catch (error) {
    toast.error(error.response?.data?.message || "Approval failed");
    return { success: false };
  }
}

export async function rejectJoinRequest(id, reason) {
  try {
    const res = await api.put(`/users/join-requests/${id}/reject`, { reason });
    toast.success(res.data.message || "Candidate application declined");
    return { success: true };
  } catch (error) {
    toast.error(error.response?.data?.message || "Action failed");
    return { success: false };
  }
}

export async function registerPushSubscription(subscription) {
  try {
    const res = await api.post("/notifications/subscribe", { subscription });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// PROJECTS APIs
// ==========================================
export async function getProjects() {
  try {
    const res = await api.get("/projects");
    return { success: true, projects: res.data.projects || [] };
  } catch (error) {
    return { success: false, projects: [] };
  }
}

export async function getProjectById(id) {
  try {
    const res = await api.get(`/projects/${id}`);
    return { success: true, project: res.data.project };
  } catch (error) {
    return { success: false };
  }
}

export async function createProject(data) {
  try {
    const res = await api.post("/projects", data);
    toast.success(`Project ${res.data.project.name} (${res.data.project.prefix}) created!`);
    return { success: true, project: res.data.project };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function updateProject(id, data) {
  try {
    const res = await api.put(`/projects/${id}`, data);
    toast.success("Project updated");
    return { success: true, project: res.data.project };
  } catch (error) {
    return { success: false };
  }
}

export async function deleteProject(id) {
  try {
    await api.delete(`/projects/${id}`);
    toast.success("Project removed");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function addProjectMember(projectId, userId) {
  try {
    const res = await api.post(`/projects/${projectId}/members`, { userId });
    toast.success("Member added to project");
    return { success: true, project: res.data.project };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function removeProjectMember(projectId, userId) {
  try {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    toast.success("Member removed from project");
    return { success: true, project: res.data.project };
  } catch (error) {
    return { success: false };
  }
}

export async function invokeProjectDepartment(projectId, departmentId) {
  try {
    const res = await api.post(`/projects/${projectId}/departments`, { departmentId });
    toast.success("Team invoked into project");
    return { success: true, project: res.data.project };
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to invoke team");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function removeProjectDepartment(projectId, deptId) {
  try {
    const res = await api.delete(`/projects/${projectId}/departments/${deptId}`);
    toast.success("Team removed from project");
    return { success: true, project: res.data.project };
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to remove team");
    return { success: false };
  }
}

export async function uploadProjectFile(projectId, file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/projects/${projectId}/files`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    toast.success("File shared with project team");
    return { success: true, project: res.data.project, files: res.data.files };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function deleteProjectFile(projectId, fileId) {
  try {
    const res = await api.delete(`/projects/${projectId}/files/${fileId}`);
    toast.success("Project file removed");
    return { success: true, project: res.data.project, files: res.data.files };
  } catch (error) {
    return { success: false };
  }
}

export async function addProjectUrl(projectId, linkData) {
  try {
    const res = await api.post(`/projects/${projectId}/urls`, linkData);
    toast.success("URL added to project");
    return { success: true, project: res.data.project, links: res.data.links };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to add URL" };
  }
}

export async function deleteProjectUrl(projectId, urlId) {
  try {
    const res = await api.delete(`/projects/${projectId}/urls/${urlId}`);
    toast.success("URL removed from project");
    return { success: true, project: res.data.project, links: res.data.links };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// DEPARTMENTS APIs
// ==========================================
export async function getDepartments() {
  try {
    const res = await api.get("/departments");
    return { success: true, departments: res.data.departments || [] };
  } catch (error) {
    return { success: false, departments: [] };
  }
}

export async function createDepartment(data) {
  try {
    const res = await api.post("/departments", data);
    toast.success("Department created");
    return { success: true, department: res.data.department };
  } catch (error) {
    return { success: false };
  }
}

export async function updateDepartment(id, data) {
  try {
    const res = await api.put(`/departments/${id}`, data);
    toast.success("Department updated");
    return { success: true, department: res.data.department };
  } catch (error) {
    return { success: false };
  }
}

export async function addDepartmentMember(departmentId, userId, jobTitle) {
  try {
    const res = await api.post(`/departments/${departmentId}/members`, { userId, jobTitle });
    toast.success("Staff assigned to department");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function removeDepartmentMember(departmentId, userId) {
  try {
    const res = await api.delete(`/departments/${departmentId}/members/${userId}`);
    toast.success("Staff removed from department");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// TASKS APIs (Tickets, Kanban & Drawer)
// ==========================================
export async function getTasks(filters = {}) {
  try {
    const res = await api.get("/tasks", { params: filters });
    return { success: true, tasks: res.data.tasks || [] };
  } catch (error) {
    return { success: false, tasks: [] };
  }
}

export async function getMyTasks() {
  try {
    const res = await api.get("/tasks/my-work");
    return { success: true, stats: res.data.stats, grouped: res.data.grouped };
  } catch (error) {
    return { success: false, stats: {}, grouped: {} };
  }
}

export async function getTaskDetails(keyOrId) {
  try {
    const res = await api.get(`/tasks/${keyOrId}`);
    return {
      success: true,
      task: res.data.task,
      comments: res.data.comments || [],
      history: res.data.history || [],
    };
  } catch (error) {
    return { success: false };
  }
}

export async function createTask(taskData) {
  try {
    const res = await api.post("/tasks", taskData);
    toast.success(`Task ${res.data.task.key} created!`);
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function updateTask(id, updates) {
  try {
    const res = await api.put(`/tasks/${id}`, updates);
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false };
  }
}

export async function updateTaskStatus(id, status, order) {
  try {
    const res = await api.patch(`/tasks/${id}/status`, { status, order });
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false };
  }
}

export async function addWorkLog(id, hours, note, date) {
  try {
    const res = await api.post(`/tasks/${id}/worklog`, { hours, note, date });
    toast.success(`Logged ${hours}h work!`);
    return { success: true, task: res.data.task, loggedHours: res.data.loggedHours };
  } catch (error) {
    return { success: false };
  }
}

export async function addSubtask(taskId, title, assignee) {
  try {
    const res = await api.post(`/tasks/${taskId}/subtasks`, { title, assignee });
    return { success: true, subtasks: res.data.subtasks };
  } catch (error) {
    return { success: false };
  }
}

export async function toggleSubtask(taskId, subtaskId) {
  try {
    const res = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}/toggle`);
    return { success: true, subtasks: res.data.subtasks };
  } catch (error) {
    return { success: false };
  }
}

export async function deleteSubtask(taskId, subtaskId) {
  try {
    const res = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return { success: true, subtasks: res.data.subtasks };
  } catch (error) {
    return { success: false };
  }
}

export async function uploadTaskAttachment(taskId, file) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/tasks/${taskId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    toast.success("Attachment uploaded");
    return { success: true, attachments: res.data.attachments };
  } catch (error) {
    return { success: false };
  }
}

export async function deleteTask(id) {
  try {
    const res = await api.delete(`/tasks/${id}`);
    toast.success(res.data.message || "Task deleted");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// COMMENTS APIs
// ==========================================
export async function getComments(taskId) {
  try {
    const res = await api.get(`/comments/${taskId}`);
    return { success: true, comments: res.data.comments || [] };
  } catch (error) {
    return { success: false, comments: [] };
  }
}

export async function addComment(taskId, text) {
  try {
    const res = await api.post(`/comments/${taskId}`, { text });
    toast.success("Comment posted");
    return { success: true, comment: res.data.comment };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// NOTIFICATIONS APIs
// ==========================================
export async function getNotifications() {
  try {
    const res = await api.get("/notifications");
    return {
      success: true,
      unreadCount: res.data.unreadCount || 0,
      notifications: res.data.notifications || [],
    };
  } catch (error) {
    return { success: false, unreadCount: 0, notifications: [] };
  }
}

export async function markNotificationRead(id) {
  try {
    await api.patch(`/notifications/${id}/read`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function markAllNotificationsRead() {
  try {
    await api.post("/notifications/read-all");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// USER & TEAM DIRECTORY APIs
// ==========================================
export async function getTeamMembers(includeInactive = false) {
  try {
    const res = await api.get("/users/team", {
      params: includeInactive ? { includeInactive: "true" } : {},
    });
    return { success: true, members: res.data.members || [] };
  } catch (error) {
    return { success: false, members: [] };
  }
}

export async function createUser(data) {
  try {
    const res = await api.post("/users", data);
    toast.success(`Account for ${res.data.user.fullname} created!`);
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false };
  }
}

export async function updateUser(id, data) {
  try {
    const res = await api.put(`/users/${id}`, data);
    toast.success("User updated");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false };
  }
}

export async function deleteUser(id) {
  try {
    await api.delete(`/users/${id}`);
    toast.success("User deactivated");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// ==========================================
// PROFILE & AVATAR UPLOAD APIs
// ==========================================
export async function updateProfileInfo(data) {
  try {
    const res = await api.put("/profile/info", data);
    toast.success(res.data.message || "Profile updated!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to update profile" };
  }
}

export async function uploadProfileImage(file) {
  try {
    const formData = new FormData();
    formData.append("image", file);
    const res = await api.post("/profile/profile-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    toast.success(res.data.message || "Profile photo updated!");
    return { success: true, avatar: res.data.avatar, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to upload photo" };
  }
}

// ==========================================
// ANALYTICS & REPORTS APIs
// ==========================================
export async function getManagerOverview(projectId) {
  try {
    const params = projectId ? { projectId } : {};
    const res = await api.get("/analytics/overview", { params });
    return {
      success: true,
      ...res.data,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function getActionLogs(params = {}) {
  try {
    const res = await api.get("/analytics/action-logs", { params });
    return {
      success: true,
      logs: res.data.logs || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
      metrics: res.data.metrics || {},
    };
  } catch (error) {
    return { success: false, logs: [], total: 0, page: 1, totalPages: 1 };
  }
}

// ==========================================
// OFFICE WORKFLOW: REVIEW & REDO LOOP
// ==========================================
export async function submitTaskForReview(id) {
  try {
    const res = await api.post(`/tasks/${id}/submit-for-review`);
    toast.success("Submitted for manager review");
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function approveTask(id) {
  try {
    const res = await api.post(`/tasks/${id}/approve`);
    toast.success("Task approved and marked completed!");
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function requestTaskRevision(id, reviewFeedback) {
  try {
    const res = await api.post(`/tasks/${id}/redo`, { reviewFeedback });
    toast.success("Revision requested with feedback");
    return { success: true, task: res.data.task };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function updateSubtaskProof(taskId, subtaskId, proofUrl, proofType = "link") {
  try {
    const res = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}/proof`, {
      proofUrl,
      proofType,
    });
    toast.success("Proof of work submitted");
    return { success: true, subtasks: res.data.subtasks };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function bulkUpdateTasks(taskIds, updates) {
  try {
    const res = await api.post("/tasks/bulk-update", { taskIds, updates });
    toast.success(`Updated ${res.data.modifiedCount} tasks`);
    return { success: true, ...res.data };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

// ==========================================
// CROSS-DEPARTMENT REQUESTS & APPROVALS
// ==========================================
export async function getRequests(filters = {}) {
  try {
    const res = await api.get("/requests", { params: filters });
    return { success: true, requests: res.data.requests || [] };
  } catch (error) {
    return { success: false, requests: [] };
  }
}

export async function getRequestById(id) {
  try {
    const res = await api.get(`/requests/${id}`);
    return { success: true, request: res.data.request };
  } catch (error) {
    return { success: false };
  }
}

export async function createRequest(data) {
  try {
    const res = await api.post("/requests", data);
    toast.success(`Request ${res.data.request.requestCode} submitted!`);
    return { success: true, request: res.data.request };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function approveRequestStage(id, comment) {
  try {
    const res = await api.post(`/requests/${id}/approve`, { comment });
    toast.success("Stage approved!");
    return { success: true, request: res.data.request, task: res.data.task };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function rejectRequest(id, reason) {
  try {
    const res = await api.post(`/requests/${id}/reject`, { reason });
    toast.success("Request rejected");
    return { success: true, request: res.data.request };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

// ==========================================
// RESUMABLE CHUNK UPLOADS & FILE SHARING
// ==========================================
export async function getChunkStatus(uploadId) {
  try {
    const res = await api.get(`/files/chunk/status/${uploadId}`);
    return res.data;
  } catch (error) {
    return { success: false, uploadedChunks: [] };
  }
}

export async function uploadSingleChunk(formData, onUploadProgress) {
  return await api.post("/files/chunk/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });
}

// ==========================================
// E2EE CHAT & ROOM APIs
// ==========================================
export async function getChatMessages(roomId, limit = 50, before = null) {
  try {
    const res = await api.get(`/chat/rooms/${roomId}/messages`, {
      params: { limit, before },
    });
    return { success: true, messages: res.data.messages || [] };
  } catch (error) {
    return { success: false, messages: [] };
  }
}

export async function sendChatMessage(data) {
  try {
    const res = await api.post("/chat/messages", data);
    return { success: true, message: res.data.message };
  } catch (error) {
    return { success: false, message: error.response?.data?.message };
  }
}

export async function togglePinChatMessage(messageId) {
  try {
    const res = await api.patch(`/chat/messages/${messageId}/pin`);
    return {
      success: true,
      message: res.data.message,
      isPinned: res.data.isPinned ?? res.data.message?.isPinned,
    };
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to toggle pin");
    return { success: false };
  }
}

export async function markChatRoomRead(roomId) {
  try {
    await api.post(`/chat/rooms/${roomId}/read`);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getChatConversations() {
  try {
    const res = await api.get("/chat/conversations");
    return {
      success: true,
      colleagues: res.data.colleagues || [],
      channelUnread: res.data.channelUnread || {},
    };
  } catch (error) {
    return { success: false, colleagues: [], channelUnread: {} };
  }
}

// ==========================================
// ROLES & MODULES RBAC APIs
// ==========================================
export async function getModulesCatalog() {
  try {
    const res = await api.get("/roles/catalog");
    return res.data;
  } catch (error) {
    return { success: false, modules: [] };
  }
}

export async function getRoles() {
  try {
    const res = await api.get("/roles");
    return res.data;
  } catch (error) {
    return { success: false, roles: [] };
  }
}

export async function createRole(roleData) {
  try {
    const res = await api.post("/roles", roleData);
    toast.success(`Role '${res.data.role?.displayName}' created!`);
    return res.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to create role" };
  }
}

export async function updateRole(id, roleData) {
  try {
    const res = await api.put(`/roles/${id}`, roleData);
    toast.success(`Role '${res.data.role?.displayName}' updated!`);
    return res.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to update role" };
  }
}

export async function deleteRole(id) {
  try {
    const res = await api.delete(`/roles/${id}`);
    toast.success("Role deleted");
    return res.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to delete role" };
  }
}

export async function assignUserRole(userId, payload) {
  try {
    const res = await api.put(`/roles/assign/${userId}`, payload);
    toast.success(res.data.message || "User role & modules updated");
    return res.data;
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Failed to assign role" };
  }
}

// ==========================================
// AI ENGINE, MODELS CATALOG & ENCRYPTED KEY VAULT APIs
// ==========================================
export async function getAITaskBreakdown(title, description, options = {}) {
  try {
    const res = await api.post("/ai/breakdown", { title, description, ...options });
    return {
      success: true,
      aiSuggestion: res.data.aiSuggestion,
      provider: res.data.provider,
      model: res.data.model,
    };
  } catch (error) {
    return { success: false };
  }
}

export async function getAIModelsSummary() {
  try {
    const res = await api.get("/ai/models");
    return res.data;
  } catch (error) {
    return { success: false, providers: [] };
  }
}

export async function getAIAdminConfig() {
  try {
    const res = await api.get("/ai/config");
    return res.data;
  } catch (error) {
    return { success: false, providers: [] };
  }
}

export async function updateAIAdminConfig(provider, payload) {
  try {
    const res = await api.put(`/ai/config/${provider}`, payload);
    toast.success(res.data.message || "AI provider settings saved");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to update AI provider");
    return { success: false };
  }
}

export async function revokeAIAdminKey(provider) {
  try {
    const res = await api.delete(`/ai/config/${provider}/key`);
    toast.success(res.data.message || "Encrypted key removed");
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function testAIProviderConnection(provider, payload = {}) {
  try {
    const res = await api.post(`/ai/config/${provider}/test`, payload);
    if (res.data.success) {
      toast.success(res.data.message || "AI Connection verified");
    } else {
      toast.error(res.data.message || "Connection test failed");
    }
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Connection test failed");
    return { success: false };
  }
}

export async function testRawAIKeyAPI(payload) {
  try {
    const res = await api.post("/ai/test-raw", payload);
    return res.data;
  } catch (error) {
    return {
      success: false,
      ok: false,
      message: error.response?.data?.message || "Key verification failed",
    };
  }
}

export async function addEncryptedAIKey(payload) {
  try {
    const res = await api.post("/ai/keys", payload);
    toast.success(res.data.message || "Encrypted key stored in vault");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to store encrypted key");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function activateAIKeyEntry(configId, keyId) {
  try {
    const res = await api.put(`/ai/keys/${configId}/${keyId}/activate`);
    toast.success(res.data.message || "Switched active API key");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to switch key");
    return { success: false };
  }
}

export async function testStoredAIKeyEntry(configId, keyId, payload = {}) {
  try {
    const res = await api.post(`/ai/keys/${configId}/${keyId}/test`, payload);
    if (res.data.success) toast.success(res.data.message || "Key verified live");
    else toast.error(res.data.message || "Key verification failed");
    return res.data;
  } catch (error) {
    return { success: false, ok: false, message: error.response?.data?.message || "Test failed" };
  }
}

export async function deleteStoredAIKeyEntry(configId, keyId) {
  try {
    const res = await api.delete(`/ai/keys/${configId}/${keyId}`);
    toast.success(res.data.message || "Key removed");
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function getUserAIKeys() {
  try {
    const res = await api.get("/ai/user-keys");
    return res.data;
  } catch (error) {
    return { success: false, configs: [] };
  }
}

export async function getMyAIAccessAPI() {
  try {
    const res = await api.get("/ai/my-access");
    return res.data;
  } catch (error) {
    return { success: false, isSuperAdmin: false, grants: [] };
  }
}

export async function getAIGlobalGrants() {
  try {
    const res = await api.get("/ai/grants");
    return res.data;
  } catch (error) {
    return { success: false, grants: [], targets: { users: [], departments: [], projects: [] }, moduleOptions: [] };
  }
}

export async function createAIGlobalGrant(payload) {
  try {
    const res = await api.post("/ai/grants", payload);
    toast.success(res.data.message || "Global AI Key access granted");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to grant Global AI Key access");
    return { success: false };
  }
}

export async function revokeAIGlobalGrant(grantId) {
  try {
    const res = await api.put(`/ai/grants/${grantId}/revoke`);
    toast.success(res.data.message || "Global AI access revoked");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to revoke grant");
    return { success: false };
  }
}

export async function restoreAIGlobalGrant(grantId) {
  try {
    const res = await api.put(`/ai/grants/${grantId}/restore`);
    toast.success(res.data.message || "Global AI access restored");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to restore grant");
    return { success: false };
  }
}

export async function deleteAIGlobalGrant(grantId) {
  try {
    const res = await api.delete(`/ai/grants/${grantId}`);
    toast.success(res.data.message || "Grant deleted");
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function getAIUsageLogsAPI(params = {}) {
  try {
    const res = await api.get("/ai/usage-logs", { params });
    return res.data;
  } catch (error) {
    return { success: false, logs: [], stats: {} };
  }
}

// ==========================================
// LIRA PERSISTENT AI ASSISTANT / COPILOT APIs
// ==========================================
export async function getAIAssistantSessionAPI() {
  try {
    const res = await api.get("/ai/assistant/session");
    return res.data;
  } catch (error) {
    return { success: false, session: null };
  }
}

export async function sendAIAssistantChatAPI(payload) {
  try {
    const res = await api.post("/ai/assistant/chat", payload);
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to dispatch AI request");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function setAIAssistantModeAPI(mode) {
  try {
    const res = await api.put("/ai/assistant/mode", { mode });
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function stopAIAssistantAPI(jobId = "") {
  try {
    const res = await api.post("/ai/assistant/stop", { jobId });
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function confirmAIAssistantActionAPI(messageId) {
  try {
    const res = await api.post(`/ai/assistant/confirm/${messageId}`);
    if (res.data.success) toast.success(res.data.executedResult?.summary || "Action executed");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to execute action");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function undoAIAssistantActionAPI(messageId) {
  try {
    const res = await api.post(`/ai/assistant/undo/${messageId}`);
    if (res.data.success) toast.success(res.data.undoResult?.summary || "Action reverted");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to undo action");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function clearAIAssistantSessionAPI() {
  try {
    const res = await api.delete("/ai/assistant/session");
    return res.data;
  } catch (error) {
    return { success: false };
  }
}

export async function uploadAIAssistantFilesAPI(files = []) {
  try {
    const formData = new FormData();
    Array.from(files).slice(0, 5).forEach((f) => formData.append("files", f));
    const res = await api.post("/ai/assistant/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to upload attachments");
    return { success: false, attachments: [] };
  }
}

export async function deleteAIAssistantUploadAPI(filenameOrPath) {
  try {
    const res = await api.delete("/ai/assistant/upload", {
      data: { filename: filenameOrPath },
    });
    return res.data;
  } catch {
    return { success: false };
  }
}

export async function executeAIAssistantCardStepAPI({ step, messageId = "", replyText = "" }) {
  try {
    const res = await api.post("/ai/assistant/execute-step", { step, messageId, replyText });
    if (res.data?.success) toast.success(res.data.executedResult?.summary || "Action executed");
    return res.data;
  } catch (error) {
    toast.error(error.response?.data?.message || "Action could not be executed");
    return { success: false, message: error.response?.data?.message };
  }
}

export async function exportAIAssistantArtifactAPI({ format = "pdf", artifact = {} }) {
  try {
    const res = await api.post(
      "/ai/assistant/export",
      { format, artifact },
      { responseType: "blob" }
    );
    const ext = format === "ppt" || format === "pptx" ? "pptx" : format === "csv" ? "csv" : "pdf";
    const safeName = (artifact.title || "Lira-Workspace-Export").replace(/[^a-zA-Z0-9_-]+/g, "_");
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
    return { success: true };
  } catch (error) {
    toast.error("Failed to generate document download");
    return { success: false };
  }
}

// ==========================================
// SUPERADMIN AUDIT LOG & SYSTEM MONITOR APIs
// ==========================================
export async function getAuditOverview(params = {}) {
  try {
    const res = await api.get("/audit/overview", { params });
    return res.data;
  } catch (error) {
    return { success: false, auditLogs: [], onlineUsers: [], offlineUsers: [], teamsOverview: [] };
  }
}

export async function getPresenceTimelineAPI(range = "24h") {
  try {
    const res = await api.get("/audit/presence-timeline", { params: { range } });
    return res.data;
  } catch (error) {
    return { success: false, series: [], timeline: [] };
  }
}
