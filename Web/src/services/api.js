import axios from "axios";
import toast from "react-hot-toast";

// 1. API URL configuration
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const GOOGLE_AUTH_URL = `${API_URL}/auth/google`;

// 2. Axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 3. Response Interceptor for Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const silentRoutes = ["/auth/me", "/notifications"];
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
    toast.success(res.data.message || "Welcome back!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Login failed" };
  }
}

export async function signUpUser(formData) {
  try {
    const res = await api.post("/auth/signup", formData);
    toast.success(res.data.message || "Account created successfully!");
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Signup failed" };
  }
}

export async function demoLoginUser(role) {
  try {
    const res = await api.post("/auth/demo-login", { role });
    toast.success(res.data.message || `Switched to demo ${role}`);
    return { success: true, user: res.data.user };
  } catch (error) {
    return { success: false, message: error.response?.data?.message || "Demo login failed" };
  }
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
    toast.success("Logged out");
    return { success: true };
  } catch (error) {
    return { success: false };
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
export async function getTeamMembers() {
  try {
    const res = await api.get("/users/team");
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
