import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyAssignments, updateAssignmentStatus } from "../../services/assignmentService";
import { B } from "../../config/theme";
import { ClipboardList, MapPin, Check } from "lucide-react";

const STATUS_COLOR = {
    Pending: { color: B.muted, bg: B.blueFaint },
    "In Progress": { color: B.blue, bg: B.blueFaint },
    Overdue: { color: B.red, bg: B.redLight },
};

/** Shown only to Auditors — their outstanding assignments from a
 * Supervisor, with a one-tap way to mark one done. Nothing shows for a
 * Supervisor/Admin viewing their own dashboard; they assign work, they
 * don't get assigned it. */
export default function MyAssignments({ userId }) {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    async function load() {
        setLoading(true);
        try {
            const data = await getMyAssignments(userId);
            setAssignments(data.filter((a) => a.status !== "Completed"));
        } catch (err) {
            console.error("Failed to load assignments:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!userId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    async function markComplete(id) {
        setUpdatingId(id);
        try {
            await updateAssignmentStatus(id, { status: "Completed" });
            setAssignments((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            console.error(err);
            alert("Couldn't update that assignment. Please try again.");
        } finally {
            setUpdatingId(null);
        }
    }

    if (loading || assignments.length === 0) return null;

    return (
        <div style={{ background: B.white, border: `1px solid ${B.blueLight}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <ClipboardList size={15} style={{ color: B.blue }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                    My Assignments ({assignments.length})
                </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {assignments.map((a) => {
                    const statusStyle = STATUS_COLOR[a.status] || STATUS_COLOR.Pending;
                    return (
                        <div
                            key={a.id}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: B.blueFaint, borderRadius: 10, padding: "10px 12px" }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: B.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {a.outlet_name}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: 11, color: B.muted, display: "flex", alignItems: "center", gap: 4 }}>
                                    <MapPin size={10} /> {a.area || "Unknown area"}
                                    {a.due_date && <span style={{ marginLeft: 4 }}>· Due {a.due_date}</span>}
                                </p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: statusStyle.color, background: statusStyle.bg, padding: "3px 8px", borderRadius: 20 }}>
                                    {a.status}
                                </span>
                                <button
                                    onClick={() => markComplete(a.id)}
                                    disabled={updatingId === a.id}
                                    title="Mark complete"
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: B.green, color: "#fff", border: 0, cursor: "pointer", opacity: updatingId === a.id ? 0.6 : 1 }}
                                >
                                    <Check size={13} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={() => navigate("/audit/new")}
                style={{ marginTop: 12, width: "100%", background: "none", border: `1.5px solid ${B.blue}`, color: B.blue, borderRadius: 10, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
                Start an Audit
            </button>
        </div>
    );
}
