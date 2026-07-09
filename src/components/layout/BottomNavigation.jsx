import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ClipboardPlus, History, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { B } from "../../config/theme";

export default function BottomNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, profile } = useAuth();

    const items = [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "New Audit", path: "/audit/new", icon: ClipboardPlus },
        { label: "History", path: "/audits/history", icon: History },
    ];

    if (profile?.role === "supervisor") {
        items.push({ label: "Team", path: "/supervisor", icon: ShieldCheck });
    }

    async function handleLogout() {
        await logout();
        navigate("/");
    }

    return (
        <nav
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: B.white,
                borderTop: `1px solid ${B.border}`,
                boxShadow: "0 -2px 12px rgba(0,48,135,0.08)",
                display: "flex",
                padding: "6px 8px",
                paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
                zIndex: 40,
            }}
        >
            {items.map(({ label, path, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                    <button
                        key={path}
                        className={`eb-navlink${active ? " active" : ""}`}
                        onClick={() => navigate(path)}
                    >
                        <Icon size={20} />
                        {label}
                    </button>
                );
            })}

            <button className="eb-navlink" onClick={handleLogout}>
                <LogOut size={20} />
                Logout
            </button>
        </nav>
    );
}
