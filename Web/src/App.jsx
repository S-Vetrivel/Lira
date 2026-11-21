import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { MainLayout } from "./components/layout/MainLayout";

// PAGES
import Board from "./pages/Board";
import TableView from "./pages/TableView";
import CalendarView from "./pages/CalendarView";
import Requests from "./pages/Requests";
import MyWork from "./pages/MyWork";
import Analytics from "./pages/Analytics";
import Team from "./pages/Team";
import Projects from "./pages/Projects";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
          },
          success: {
            duration: 3500,
            iconTheme: {
              primary: "#3b82f6",
              secondary: "#ffffff",
            },
          },
        }}
      />

      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Authenticated Workspace Routes */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Board />} />
          <Route path="/board" element={<Board />} />
          <Route path="/table" element={<TableView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/my-work" element={<MyWork />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/team" element={<Team />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
