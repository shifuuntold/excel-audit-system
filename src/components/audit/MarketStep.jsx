import { useEffect, useState } from "react";
import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import Input from "../common/Input";
import Toggle from "../common/Toggle";
import ComboSelect from "../common/ComboSelect";
import Label from "../common/Label";
import { useAudit } from "../../contexts/AuditContext";
import { getDistributors, findOrCreateDistributor } from "../../services/distributorService";
import { DISTRIBUTORS as FALLBACK_DISTRIBUTORS } from "../../config/productCatalog";

export default function MarketStep() {
    const { audit, setAudit } = useAudit();
    const market = audit.market || {};

    const [distributors, setDistributors] = useState(FALLBACK_DISTRIBUTORS);

    useEffect(() => {
        getDistributors()
            .then((list) => {
                if (list && list.length > 0) {
                    setDistributors(list.map((d) => d.name));
                }
            })
            .catch(console.error);
    }, []);

    function update(field, value) {
        setAudit((prev) => ({
            ...prev,
            market: {
                ...prev.market,
                [field]: value,
            },
        }));
    }

    async function handleAddDistributor(name) {
        const created = await findOrCreateDistributor(name);
        setDistributors((prev) => (prev.includes(created.name) ? prev : [...prev, created.name].sort()));
        update("distributor", created.name);
    }

    return (

        <Card>

            <CardTitle icon="🏪">Market Information</CardTitle>

            <div style={{ display: "grid", gap: 4 }}>

                <ComboSelect
                    label="Main Distributor"
                    placeholder="Select Distributor"
                    value={market.distributor}
                    options={distributors}
                    onChange={(v) => update("distributor", v)}
                    onAddNew={handleAddDistributor}
                />

                <div style={{ marginBottom: 16 }}>
                    <Label>Promotional Activity Observed?</Label>
                    <Toggle
                        options={["Yes", "No"]}
                        value={market.promotion || ""}
                        onChange={(v) => update("promotion", v)}
                    />
                </div>

                <Input
                    label="Main Competitor"
                    placeholder="e.g. Dasani, Del Monte, Cadbury..."
                    value={market.competitor || ""}
                    onChange={(e) => update("competitor", e.target.value)}
                />

                <div style={{ marginBottom: 16 }}>
                    <Label>Retailer Feedback</Label>
                    <textarea
                        rows={4}
                        className="eb-input"
                        placeholder="What did the retailer say about Excel products?"
                        value={market.feedback || ""}
                        onChange={(e) => update("feedback", e.target.value)}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <Label>Additional Notes</Label>
                    <textarea
                        rows={4}
                        className="eb-input"
                        placeholder="Any additional market observations..."
                        value={market.notes || ""}
                        onChange={(e) => update("notes", e.target.value)}
                    />
                </div>

            </div>

        </Card>

    );
}
