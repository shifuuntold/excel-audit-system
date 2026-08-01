import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { deleteAudit } from "../services/auditService";
import { getAreaMap, resolveAreaName } from "../services/areaService";
import { buildProductSummary } from "../utils/productSummary";
import { competitorSummaryText } from "../utils/competitors";
import { distributorSummaryText } from "../utils/distributors";
import { useAuth } from "../hooks/useAuth";
import { canViewAllAudits } from "../utils/roles";

import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import { SkeletonAuditDetails, SkeletonBlock } from "../components/common/Skeleton";
import Button from "../components/common/Button";
import { B } from "../config/theme";
import { FileText, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

function Field({ label, value }) {
    return (
        <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>
                {label}
            </p>
            <p style={{ fontSize: 14, color: B.text, margin: "3px 0 0", fontWeight: 500 }}>
                {value || "-"}
            </p>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div
            style={{
                background: B.white,
                borderRadius: 16,
                border: `1px solid ${B.blueLight}`,
                boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                padding: 22,
                marginBottom: 16,
            }}
        >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: B.blue }}>
                {title}
            </h2>
            {children}
        </div>
    );
}

export default function AuditDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile } = useAuth();

    const [audit, setAudit] = useState(null);
    const [areaMap, setAreaMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Comes from AuditHistory when you tap into an audit from a filtered
    // list — lets you page through that same list with Previous/Next
    // instead of bouncing back to history every time. Not present on a
    // direct link (shared URL, browser refresh), in which case the
    // Previous/Next controls simply don't show.
    const auditIds = location.state?.auditIds;
    const currentIndex = auditIds ? auditIds.indexOf(id) : -1;
    const prevId = currentIndex > 0 ? auditIds[currentIndex - 1] : null;
    const nextId = currentIndex >= 0 && currentIndex < auditIds.length - 1 ? auditIds[currentIndex + 1] : null;

    function goToAudit(targetId) {
        navigate(`/audit/${targetId}`, { state: { auditIds } });
    }

    useEffect(() => {
        async function loadAudit() {
            const { data, error } = await supabase
                .from("audit_submissions")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                console.error(error);
            } else {
                setAudit(data);
            }
            setLoading(false);
        }

        loadAudit();
        getAreaMap().then(setAreaMap).catch(console.error);
    }, [id]);

    async function handleDelete() {
        if (!confirm("Delete this audit? This can't be undone.")) return;
        setDeleting(true);
        try {
            await deleteAudit(id);
            navigate("/audits/history");
        } catch (error) {
            console.error(error);
            alert("Couldn't delete this audit. Please try again.");
            setDeleting(false);
        }
    }

    async function handleExportPdf() {
        setExportingPdf(true);
        try {
            const { exportAuditToPDF } = await import("../services/pdfExport");
            exportAuditToPDF(audit, areaMap);
        } finally {
            setExportingPdf(false);
        }
    }

    if (loading) {
        return (
            <>
                <Header title="Audit Details" subtitle=" " backTo="-1" />
                <PageContainer withNav={false}>
                    <SkeletonBlock width={160} height={32} radius={8} style={{ marginBottom: 16 }} />
                    <SkeletonAuditDetails />
                </PageContainer>
            </>
        );
    }

    if (!audit) {
        return (
            <>
                <Header title="Audit Not Found" backTo="-1" />
                <PageContainer withNav={false}>
                    <p style={{ color: B.muted, textAlign: "center" }}>
                        This audit could not be found.
                    </p>
                </PageContainer>
            </>
        );
    }

    const summary = buildProductSummary(audit.products);
    const totalCount = summary.reduce((sum, g) => sum + g.count, 0);

    // Own audit, or a supervisor/admin who can manage any audit
    const canManage = audit.user_id === user?.id || canViewAllAudits(profile?.role);

    return (
        <>
            <Header
                title={audit.outlet?.shop_name || "Audit Details"}
                subtitle={new Date(audit.created_at).toLocaleString()}
                backTo="-1"
            />

            <PageContainer withNav={false}>
                {auditIds && auditIds.length > 1 && currentIndex >= 0 && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronLeft}
                            disabled={!prevId}
                            onClick={() => goToAudit(prevId)}
                        >
                            Previous
                        </Button>

                        <span style={{ fontSize: 12, color: B.muted, fontWeight: 600 }}>
                            Audit {currentIndex + 1} of {auditIds.length}
                        </span>

                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!nextId}
                            onClick={() => goToAudit(nextId)}
                        >
                            Next
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                )}

                <Section title="Outlet Information">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                        <Field label="Shop Name" value={audit.outlet?.shop_name} />
                        <Field label="Area" value={resolveAreaName(audit.outlet, areaMap)} />
                        <Field label="Visit Date" value={audit.outlet?.visit_date} />
                        <Field label="Person Met" value={audit.outlet?.person_met} />
                        <Field label="Position" value={audit.outlet?.position} />
                        <Field label="Mobile" value={audit.outlet?.mobile} />
                        {audit.outlet?.latitude && (
                            <Field label="GPS" value={`${audit.outlet.latitude}, ${audit.outlet.longitude}`} />
                        )}
                    </div>
                </Section>

                <Section title="Market Information">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                        <Field label="Visited by Sales Rep" value={audit.market?.visited} />
                        <Field label="Distributor" value={distributorSummaryText(audit.market)} />
                        <Field label="Promotion Observed" value={audit.market?.promotion} />
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <Field label="Competitors Observed" value={competitorSummaryText(audit.market)} />
                    </div>
                </Section>

                <Section title={`Products Recorded (${totalCount})`}>
                    {summary.length === 0 ? (
                        <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>No products recorded.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {summary.map((group) => (
                                <div key={group.key} style={{ background: B.blueFaint, borderRadius: 12, padding: "12px 14px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <group.icon size={14} style={{ color: B.blue }} />
                                        <span style={{ fontWeight: 700, fontSize: 13, color: B.text }}>{group.label}</span>
                                        <span style={{ fontSize: 11, color: B.muted, fontWeight: 600 }}>({group.count})</span>
                                    </div>
                                    <p style={{ fontSize: 12.5, color: B.muted, margin: 0, lineHeight: 1.6 }}>
                                        {group.items.join(" · ")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                <Section title="Feedback & Notes">
                    <p style={{ fontSize: 13, marginBottom: 12 }}>
                        <strong>Feedback:</strong> {audit.market?.feedback || "No feedback recorded."}
                    </p>
                    <p style={{ fontSize: 13, margin: 0 }}>
                        <strong>Notes:</strong> {audit.market?.notes || "No notes recorded."}
                    </p>
                </Section>

                {canManage && (
                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            paddingTop: 8,
                        }}
                    >
                        <Button
                            variant="primary"
                            icon={Pencil}
                            onClick={() => navigate(`/audit/${id}/edit`)}
                        >
                            Edit Audit
                        </Button>
                        <Button
                            variant="secondary"
                            icon={FileText}
                            loading={exportingPdf}
                            onClick={handleExportPdf}
                        >
                            Download PDF
                        </Button>
                        <Button
                            variant="danger"
                            icon={Trash2}
                            loading={deleting}
                            onClick={handleDelete}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            </PageContainer>
        </>
    );
}
