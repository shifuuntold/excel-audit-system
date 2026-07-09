import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewAudit from "./pages/NewAudit";
import TodaysAudits from "./pages/TodaysAudits";

import ProtectedRoute from "./components/common/ProtectedRoute";

export default function App() {

    return (

        <Routes>

            <Route
                path="/"
                element={<Login />}
            />

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
                path="/audits/today"
                element={<TodaysAudits />}
            />
        </Routes>

    );

}