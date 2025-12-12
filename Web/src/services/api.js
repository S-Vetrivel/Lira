import axios from "axios";

// 1. Configuration Constants
const API_URL = "http://localhost:3000/api";
export const GOOGLE_AUTH_URL = `${API_URL}/auth/google`;

// 2. Create Axios Instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 3. Response Interceptor (Global Error Handling)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      console.error("Network Error - Is the backend running?");
      return Promise.reject(error);
    }

    const { status } = error.response;

    if (status === 401) {
      console.warn("Session expired or invalid. Redirecting to login...");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    if (status === 403) {
      console.warn("You do not have permission to perform this action.");
    }

    if (status === 404) {
      console.error("API Resource not found:", error.config.url);
    }

    return Promise.reject(error);
  }
);

// ✅ 4. Add Login Function Here (what you asked for)
export async function loginUser(email, password) {
  try {
    const response = await api.post("/auth/login", { email, password });

    return {
      success: true,
      user: response.data.user,
      message: response.data.message,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error.response?.data?.message || "Login failed. Please try again.",
    };
  }
}

export default api;
