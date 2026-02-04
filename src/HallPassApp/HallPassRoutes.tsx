import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Shell } from "./Shell";

// If later you want nested pages inside HallPass, add them here.
export default function HallPassRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Shell />} />
        {/* optional: redirect anything unknown back to the root of HallPass */}
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </AuthProvider>
  );
}
