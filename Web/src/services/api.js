import axios from "axios";
import toast from "react-hot-toast";

// 1. API URL configuration
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/v3";
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
      if (window.location.pathname !== "/login") {
        toast.error(message);
        window.location.href = "/login";
      }
    } else if (status >= 400 && status < 500) {
      toast.error(message);
    } else if (status >= 500) {
      toast.error("Server error. Please try again shortly.");
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
// AI ASSISTANT APIs (Gemini 1.5 Flash)
// ==========================================
export async function getAITaskBreakdown(title, description) {
  try {
    const res = await api.post("/ai/breakdown", { title, description });
    return { success: true, aiSuggestion: res.data.aiSuggestion };
  } catch (error) {
    return { success: false };
  }
}
