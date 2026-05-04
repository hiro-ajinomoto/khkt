import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import LoginPage from "./LoginPage.jsx";
import RegisterPage from "./RegisterPage.jsx";
import App from "./App.jsx";
import AggregateReport from "./AggregateReport.jsx";
import MembersPage from "./MembersPage.jsx";
import MemberDebtPage from "./MemberDebtPage.jsx";
import PersonHistory from "./PersonHistory.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/dang-ky" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tong-hop"
            element={
              <ProtectedRoute>
                <AggregateReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/thanh-vien/:personId"
            element={
              <ProtectedRoute>
                <MemberDebtPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/thanh-vien"
            element={
              <ProtectedRoute>
                <MembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lich-su/:stt"
            element={
              <ProtectedRoute>
                <PersonHistory />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
