import { saveAudit, getAuditById, updateAudit } from "../services/auditService";
import { queueAudit } from "../services/offlineQueue";
import { useAuth } from "../contexts/AuthContext";
import { useAudit } from "../contexts/AuditContext";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import OutletForm from "../components/audit/OutletForm";
import ProductsStep from "../components/audit/ProductsStep";
import MarketStep from "../components/audit/MarketStep";
import ReviewStep from "../components/audit/ReviewStep";
import Header from "../components/layout/Header";
import PageContainer from "../components/layout/PageContainer";
import Button from "../components/common/Button";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { B } from "../config/theme";

const STEP_LABELS = ["Outlet", "Products", "Market", "Review"];

const BLANK_AUDIT = {
    shop_name: "",
    area_id: "",
    area_name: "",
    visit_date: new Date().toISOString().split("T")[0],
    person_met: "",
    position: "",
    mobile: "",
    latitude: null,
    longitude: null,
    products: {},
    market: {},
};

export default function NewAudit() {
    const { user } = useAuth();
    const { audit, setAudit } = useAudit();
    const { id: editId } = useParams();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(!!editId);

    // Load the existing audit into the form when editing, otherwise start blank
    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (editId) {
                try {
                    const existing = await getAuditById(editId);
                    if (cancelled) return;
                    setAudit({
                        ...BLANK_AUDIT,
                        ...existing.outlet,
                        products: existing.products || {},
                        market: existing.market || {},
                    });
                } catch (error) {
                    console.error(error);
                    alert("Couldn't load that audit for editing.");
                    navigate("/audits/history");
                } finally {
                    if (!cancelled) setLoadingExisting(false);
                }
            } else {
                setAudit(BLANK_AUDIT);
                setLoadingExisting(false);
            }
        }

        init();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editId]);

    const nextStep = () => {
        if (step < 4) setStep(step + 1);
    };

    const previousStep = () => {
        if (step > 1) setStep(step - 1);
    };

    async function handleSubmit() {
        setSubmitting(true);

        const outlet = {
            shop_name: audit.shop_name,
            area_id: audit.area_id,
            area_name: audit.area_name,
            visit_date: audit.visit_date,
            person_met: audit.person_met,
            position: audit.position,
            mobile: audit.mobile,
            latitude: audit.latitude,
            longitude: audit.longitude,
        };

        try {
            if (editId) {
                // Edits need a live connection — updating a record offline
                // risks clobbering changes someone else made in the meantime.
                if (!navigator.onLine) {
                    alert("📴 You're offline — editing an existing audit needs a connection. Try again once you're back online.");
                    return;
                }
                await updateAudit(editId, { outlet, products: audit.products, market: audit.market });
                alert("✅ Audit updated successfully!");
                navigate(`/audit/${editId}`);
                return;
            }

            const payload = { userId: user.id, outlet, products: audit.products, market: audit.market };

            if (!navigator.onLine) {
                queueAudit(payload);
                alert("📴 You're offline — audit saved on this device and will sync automatically once you're back online.");
            } else {
                try {
                    await saveAudit(payload);
                    alert("✅ Audit submitted successfully!");
                } catch {
                    // Save failed (likely a flaky connection) — don't lose the data
                    queueAudit(payload);
                    alert("⚠️ Couldn't reach the server — audit saved on this device and will sync automatically.");
                }
            }

            setStep(1);
            setAudit(BLANK_AUDIT);
        } catch (error) {
            console.error(error);
            alert("Failed to submit audit.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loadingExisting) {
        return <LoadingSpinner fullScreen label="Loading audit..." />;
    }

    return (
        <>
            <Header
                title={editId ? "Edit Outlet Audit" : "New Outlet Audit"}
                subtitle="Excel Chemicals Field Audit"
                backTo={editId ? `/audit/${editId}` : "/dashboard"}
            />

            <PageContainer withNav={false}>
                <div
                    style={{
                        background: B.white,
                        borderRadius: 18,
                        boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
                        border: `1px solid ${B.blueLight}`,
                        padding: 24,
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
                        {STEP_LABELS.map((label, i) => {
                            const number = i + 1;
                            const active = step >= number;
                            return (
                                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 700,
                                            fontSize: 13,
                                            background: active ? B.blue : B.blueFaint,
                                            color: active ? B.white : B.muted,
                                            transition: "all .15s ease",
                                        }}
                                    >
                                        {number}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: active ? B.blue : B.muted,
                                            display: window.innerWidth < 480 ? "none" : "inline",
                                        }}
                                    >
                                        {label}
                                    </span>
                                    {number < 4 && (
                                        <div style={{ width: 20, height: 2, background: B.border, marginLeft: 4 }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {step === 1 && <OutletForm />}
                    {step === 2 && <ProductsStep />}
                    {step === 3 && <MarketStep />}
                    {step === 4 && <ReviewStep />}

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
                        <Button variant="secondary" onClick={previousStep} disabled={step === 1}>
                            Previous
                        </Button>

                        {step < 4 ? (
                            <Button variant="primary" onClick={nextStep}>
                                Next
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                loading={submitting}
                                className="eb-btn-primary"
                                style={{ background: B.green }}
                            >
                                {editId ? "Save Changes" : "Submit Audit"}
                            </Button>
                        )}
                    </div>
                </div>
            </PageContainer>
        </>
    );
}
