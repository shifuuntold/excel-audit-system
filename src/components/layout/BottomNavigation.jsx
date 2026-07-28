import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ClipboardPlus, History, FileText, ShieldCheck, Settings, LogOut, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { canViewAllAudits, isAdmin } from "../../utils/roles";
import { B } from "../../config/theme";

function NavButton({ item, active, onClick }) {
    const Icon = item.icon;
    return <button className={`eb-navlink${active ? " active" : ""}`} onClick={onClick}><Icon size={20} />{item.label}</button>;
}

export default function BottomNavigation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, profile } = useAuth();
    const [moreOpen, setMoreOpen] = useState(false);
    const managementUser = canViewAllAudits(profile?.role);

    const primaryItems = managementUser
        ? [
            { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
            { label: "Audits", path: "/audits/history", icon: History },
            { label: "Team", path: "/supervisor", icon: ShieldCheck },
        ]
        : [
            { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
            { label: "New Audit", path: "/audit/new", icon: ClipboardPlus },
            { label: "My Audits", path: "/audits/history", icon: History },
        ];
    const moreItems = [
        { label: "Reports", path: "/reports", icon: FileText },
        ...(isAdmin(profile?.role) ? [{ label: "Admin", path: "/admin", icon: Settings }] : []),
    ];
    const isMoreRoute = moreItems.some((item) => item.path === location.pathname);

    async function handleLogout() {
        await logout();
        navigate("/");
    }

    function go(path) {
        setMoreOpen(false);
        navigate(path);
    }

    return (
        <>
            {moreOpen && <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.25)", zIndex: 39 }} />}
            {moreOpen && (
                <div style={{ position: "fixed", bottom: 72, right: 12, left: 12, zIndex: 41, background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 16, boxShadow: "0 12px 28px rgba(0,48,135,0.2)", padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px 10px" }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: B.blue }}>More</span>
                        <button onClick={() => setMoreOpen(false)} aria-label="Close menu" style={{ border: 0, background: "transparent", cursor: "pointer", color: B.muted }}><X size={18} /></button>
                    </div>
                    {moreItems.map((item) => {
                        const Icon = item.icon;
                        return <button key={item.path} onClick={() => go(item.path)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", border: 0, borderRadius: 10, background: location.pathname === item.path ? B.blueFaint : "transparent", color: B.text, fontFamily: "inherit", fontSize: 14, fontWeight: 650, cursor: "pointer", textAlign: "left" }}><Icon size={18} color={B.blue} />{item.label}</button>;
                    })}
                    <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", border: 0, borderRadius: 10, background: "transparent", color: "#B42318", fontFamily: "inherit", fontSize: 14, fontWeight: 650, cursor: "pointer", textAlign: "left" }}><LogOut size={18} />Logout</button>
                </div>
            )}
            <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, borderTop: `1px solid ${B.border}`, boxShadow: "0 -2px 12px rgba(0,48,135,0.08)", display: "flex", padding: "6px 8px", paddingBottom: "calc(6px + env(safe-area-inset-bottom))", zIndex: 40 }}>
                {primaryItems.map((item) => <NavButton key={item.path} item={item} active={location.pathname === item.path} onClick={() => go(item.path)} />)}
                <NavButton item={{ label: "More", icon: MoreHorizontal }} active={isMoreRoute || moreOpen} onClick={() => setMoreOpen((open) => !open)} />
            </nav>
        </>
    );
}
