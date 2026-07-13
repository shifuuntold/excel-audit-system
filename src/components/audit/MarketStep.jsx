import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import Toggle from "../common/Toggle";
import CompetitorPicker from "./CompetitorPicker";
import DistributorPicker from "./DistributorPicker";
import Label from "../common/Label";
import { useAudit } from "../../contexts/AuditContext";

export default function MarketStep() {
    const { audit, setAudit } = useAudit();
    const market = audit.market || {};

    function update(field, value) {
        setAudit((prev) => ({
            ...prev,
            market: {
                ...prev.market,
                [field]: value,
            },
        }));
    }

    return (

        <Card>

            <CardTitle icon="🏪">Market Information</CardTitle>

            <div style={{ display: "grid", gap: 4 }}>

                <div style={{ marginBottom: 16 }}>
                    <Label>Visited by a Sales Representative?</Label>
                    <Toggle
                        options={["Yes", "No"]}
                        value={market.visited || ""}
                        onChange={(v) => update("visited", v)}
                    />
                </div>

                <DistributorPicker
                    value={market.distributors || []}
                    onChange={(v) => update("distributors", v)}
                />

                <div style={{ marginBottom: 16 }}>
                    <Label>Promotional Activity Observed?</Label>
                    <Toggle
                        options={["Yes", "No"]}
                        value={market.promotion || ""}
                        onChange={(v) => update("promotion", v)}
                    />
                </div>

                <CompetitorPicker
                    value={market.competitors || {}}
                    onChange={(v) => update("competitors", v)}
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
