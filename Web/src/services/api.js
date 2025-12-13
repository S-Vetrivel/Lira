import axios from "axios";
import toast from "react-hot-toast";

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
    // ==============================================================
    // 🛑 SILENT ROUTES: Don't show popups for these endpoints
    // ==============================================================
    const silentRoutes = ["/auth/me"];

    // Check if the current request URL matches any silent route
    if (
      error.config &&
      silentRoutes.some((route) => error.config.url.includes(route))
    ) {
      return Promise.reject(error);
    }
    // ==============================================================

    // A. Network / Connection Errors
    if (!error.response) {
      toast.error("Network Error - Is the Network available?");
      return Promise.reject(error);
    }

    // B. Extract message
    const { status, data } = error.response;
    const backendMessage = data?.message || "An unexpected error occurred.";

    // C. Handle specific status codes
    if (status === 401) {
      toast.error(backendMessage);

      setTimeout(() => {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }, 1000);
    } else if (status === 403) {
      toast.error(backendMessage);
    } else if (status === 404) {
      toast.error(backendMessage);
    } else if (status >= 500) {
      toast.error(backendMessage);
    } else {
      toast.error(backendMessage);
    }

    return Promise.reject(error);
  }
);

// 4. Login Function
export async function loginUser(email, password) {
  try {
    const response = await api.post("/auth/login", { email, password });
    toast.success(response.data.message || "Login Successful!");
    return {
      success: true,
      user: response.data.user,
      message: response.data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Login failed.",
    };
  }
}

// 5. SignUp Function
export async function SignUp(name, email, password, confirmPassword) {
  if (password !== confirmPassword) {
    toast.error("Passwords do not match!");
    return { success: false, message: "Passwords do not match" };
  }

  try {
    const response = await api.post("/auth/signup", {
      fullname: name,
      username: email.split("@")[0],
      email,
      password,
      confirmPassword,
    });
    toast.success(response.data.message || "Account created successfully!");
    return {
      success: true,
      user: response.data.user,
      message: response.data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || "Signup failed.",
    };
  }
}

// 6. Check Auth Function (Silent)
export async function checkAuth() {
  try {
    const response = await api.get("/auth/me");
    return {
      isAuthenticated: true,
      user: response.data.user,
    };
  } catch (error) {
    // Silently fails due to interceptor logic above
    return {
      isAuthenticated: false,
      user: null,
    };
  }
}

// 7. Logout Function
export async function logout() {
  try {
    await api.get("/auth/logout");
    toast.success("Logged out successfully");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// 8. Reset Password Function
export async function ResetPassword(email) {
  try {
    await api.post("/auth/reset-password", {
      email,
    });
    toast.success("Email sent successfully!");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export default api;
