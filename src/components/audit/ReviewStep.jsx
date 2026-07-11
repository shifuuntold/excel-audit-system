import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import { useAudit } from "../../contexts/AuditContext";
import { buildProductSummary } from "../../utils/productSummary";
import { competitorSummaryText } from "../../utils/competitors";
import { distributorSummaryText } from "../../utils/distributors";
import { B } from "../../config/theme";

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

export default function ReviewStep() {
    const { audit } = useAudit();

    const market = audit.market || {};
    const products = audit.products || {};
    const summary = buildProductSummary(products);
    const totalCount = summary.reduce((sum, g) => sum + g.count, 0);

    return (

        <Card>

            <CardTitle icon="✅">Review Audit</CardTitle>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: B.blue }}>
                        Outlet Information
                    </h3>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                        <Field label="Outlet" value={audit.shop_name} />
                        <Field label="Area" value={audit.area_name || audit.area_id} />
                        <Field label="Visit Date" value={audit.visit_date} />
                        <Field label="Person Met" value={audit.person_met} />
                        <Field label="Position" value={audit.position} />
                        <Field label="Mobile" value={audit.mobile} />
                        {audit.latitude && audit.longitude && (
                            <Field
                                label="GPS Location"
                                value={`${audit.latitude.toFixed(5)}, ${audit.longitude.toFixed(5)}`}
                            />
                        )}
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: B.blue }}>
                        Market Information
                    </h3>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                        <Field label="Distributor" value={distributorSummaryText(market)} />
                        <Field label="Promotion Observed" value={market.promotion} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <Field label="Competitors Observed" value={competitorSummaryText(market)} />
                    </div>
                </div>

                <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: B.blue }}>
                            Products Recorded
                        </h3>
                        <span
                            style={{
                                background: totalCount > 0 ? B.green : B.border,
                                color: "#fff",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "3px 10px",
                            }}
                        >
                            {totalCount} total
                        </span>
                    </div>

                    {summary.length === 0 ? (
                        <div style={{ background: B.blueFaint, borderRadius: 12, padding: 16 }}>
                            <p style={{ color: B.muted, fontSize: 13, margin: 0 }}>
                                No products recorded yet.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {summary.map((group) => (
                                <div
                                    key={group.key}
                                    style={{
                                        background: B.blueFaint,
                                        borderRadius: 12,
                                        padding: "12px 14px",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 15 }}>{group.icon}</span>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: B.text }}>
                                            {group.label}
                                        </span>
                                        <span style={{ fontSize: 11, color: B.muted, fontWeight: 600 }}>
                                            ({group.count})
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 12.5, color: B.muted, margin: 0, lineHeight: 1.6 }}>
                                        {group.items.join(" · ")}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: B.blue }}>
                        Retailer Feedback
                    </h3>
                    <div style={{ background: B.blueFaint, borderRadius: 12, padding: 16 }}>
                        <p style={{ fontSize: 13, color: market.feedback ? B.text : B.muted, margin: 0 }}>
                            {market.feedback || "No feedback recorded."}
                        </p>
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: B.blue }}>
                        Additional Notes
                    </h3>
                    <div style={{ background: B.blueFaint, borderRadius: 12, padding: 16 }}>
                        <p style={{ fontSize: 13, color: market.notes ? B.text : B.muted, margin: 0 }}>
                            {market.notes || "No notes recorded."}
                        </p>
                    </div>
                </div>

            </div>

        </Card>

    );
}
