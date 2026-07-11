import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewAudit from "./pages/NewAudit";
import AuditHistory from "./pages/AuditHistory";
import AuditDetails from "./pages/AuditDetails";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import Reports from "./pages/Reports";
import AdminPanel from "./pages/AdminPanel";

import ProtectedRoute from "./components/common/ProtectedRoute";
import OfflineBanner from "./components/common/OfflineBanner";

export default function App() {

    return (
        <>
            <OfflineBanner />

            <Routes>

                <Route path="/" element={<Login />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/audit/new"
                    element={
                        <ProtectedRoute>
                            <NewAudit />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/audit/:id/edit"
                    element={
                        <ProtectedRoute>
                            <NewAudit />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/audits/history"
                    element={
                        <ProtectedRoute>
                            <AuditHistory />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/audit/:id"
                    element={
                        <ProtectedRoute>
                            <AuditDetails />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/supervisor"
                    element={
                        <ProtectedRoute>
                            <SupervisorDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <Reports />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute>
                            <AdminPanel />
                        </ProtectedRoute>
                    }
                />

            </Routes>
        </>
    );

}
