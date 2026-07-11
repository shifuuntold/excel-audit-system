import { useEffect, useState } from "react";
import { useAudit } from "../../contexts/AuditContext";
import { POSITIONS } from "../../config/productCatalog";

import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import Input from "../common/Input";
import Select from "../common/Select";
import Button from "../common/Button";
import LocationSearch from "./LocationSearch";
import { B } from "../../config/theme";
import { LocateFixed, CheckCircle2 } from "lucide-react";

export default function OutletForm() {

    const { audit, setAudit } = useAudit();

    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState("");

    function updateField(field, value) {
        setAudit({
            ...audit,
            [field]: value,
        });
    }

    function captureLocation() {
        if (!navigator.geolocation) {
            setLocationError("GPS isn't available on this device/browser.");
            return;
        }

        setLocating(true);
        setLocationError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setAudit((prev) => ({
                    ...prev,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                }));
                setLocating(false);
            },
            (error) => {
                setLocationError(
                    error.code === error.PERMISSION_DENIED
                        ? "Location permission denied. Enable it in your browser/device settings."
                        : "Couldn't get your location. Try again."
                );
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 12000 }
        );
    }

    // Auto-capture on arrival so most reps never need to tap the button —
    // only fires once, and only if we don't already have coordinates
    // (e.g. when editing an audit that was already GPS-tagged).
    useEffect(() => {
        if (!audit.latitude && !audit.longitude) {
            captureLocation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (

        <Card>

            <CardTitle icon="🏬">Outlet Information</CardTitle>

            <div style={{ display: "grid", gap: 4 }}>

                <Input
                    label="Shop Name"
                    required
                    value={audit.shop_name || ""}
                    onChange={(e) => updateField("shop_name", e.target.value)}
                    placeholder="e.g. Kim's General Store"
                />

                <LocationSearch
                    required
                    value={audit.area_name || ""}
                    onSelect={({ area_id, area_name }) =>
                        setAudit((prev) => ({ ...prev, area_id, area_name }))
                    }
                />

                <Input
                    label="Visit Date"
                    type="date"
                    required
                    value={audit.visit_date || ""}
                    onChange={(e) => updateField("visit_date", e.target.value)}
                />

                <Input
                    label="Person Met"
                    value={audit.person_met || ""}
                    onChange={(e) => updateField("person_met", e.target.value)}
                />

                <Select
                    label="Position"
                    placeholder="Select Position"
                    value={audit.position || ""}
                    onChange={(e) => updateField("position", e.target.value)}
                >
                    {POSITIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </Select>

                <Input
                    label="Mobile Number"
                    type="tel"
                    value={audit.mobile || ""}
                    onChange={(e) => updateField("mobile", e.target.value)}
                    placeholder="07XX XXX XXX"
                />

                <div style={{ marginTop: 4, marginBottom: 12 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <Button
                            variant="secondary"
                            icon={LocateFixed}
                            loading={locating}
                            onClick={captureLocation}
                        >
                            {locating ? "Getting location..." : "Capture GPS Location"}
                        </Button>

                        {audit.latitude && audit.longitude && (
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: B.green,
                                }}
                            >
                                <CheckCircle2 size={14} />
                                {audit.latitude.toFixed(5)}, {audit.longitude.toFixed(5)}
                            </span>
                        )}
                    </div>

                    {locationError && (
                        <p style={{ color: B.red, fontSize: 12, marginTop: 8 }}>
                            {locationError}
                        </p>
                    )}
                </div>

            </div>

        </Card>

    );
}
