import { useEffect, useMemo, useState } from "react";
import Input from "../common/Input";
import { getOutlets } from "../../services/outletService";
import { findPossibleDuplicates, isGenericOutletName, suggestOutlets } from "../../utils/outlets";
import { B } from "../../config/theme";

/**
 * Outlet name field that links the audit to a registered outlet.
 * - typing searches existing outlets (preferring the chosen area);
 * - tapping a suggestion links the audit to that outlet's stable id;
 * - typing a name with no selection means a NEW outlet, which is registered
 *   when the audit is submitted;
 * - editing the text after selecting clears the link, so the wrong outlet
 *   is never kept by accident.
 */
export default function OutletPicker({ audit, setAudit }) {
    const [outlets, setOutlets] = useState([]);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getOutlets()
            .then((rows) => { if (!cancelled) setOutlets(rows || []); })
            .catch(() => { if (!cancelled) setLoadFailed(true); });
        return () => { cancelled = true; };
    }, []);

    const text = audit.shop_name || "";
    const linked = audit.outlet_id ? outlets.find((o) => o.id === audit.outlet_id) : null;

    const suggestions = useMemo(
        () => (audit.outlet_id ? [] : suggestOutlets(outlets, { text, areaId: audit.area_id, areaName: audit.area_name })),
        [outlets, text, audit.outlet_id, audit.area_id, audit.area_name],
    );
    const duplicates = useMemo(
        () => (audit.outlet_id ? [] : findPossibleDuplicates(outlets, { name: text, areaId: audit.area_id, areaName: audit.area_name, latitude: audit.latitude, longitude: audit.longitude })),
        [outlets, text, audit.outlet_id, audit.area_id, audit.area_name, audit.latitude, audit.longitude],
    );

    function choose(o) {
        setAudit((prev) => ({
            ...prev,
            outlet_id: o.id,
            shop_name: o.name,
            area_id: prev.area_id || o.area_id || "",
            area_name: prev.area_name || o.area_name || "",
        }));
    }

    const note = (color, msg) => <p style={{ margin: "4px 0 0", fontSize: 12, color, lineHeight: 1.45 }}>{msg}</p>;

    return (
        <div>
            <Input
                label="Shop Name"
                required
                value={text}
                onChange={(e) => setAudit((prev) => ({ ...prev, shop_name: e.target.value, outlet_id: null }))}
                placeholder="Start typing to find the outlet"
            />

            {suggestions.length > 0 && (
                <div role="listbox" style={{ border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden", marginTop: 4 }}>
                    {suggestions.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => choose(o)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "#fff", border: 0, borderBottom: `1px solid ${B.border}`, cursor: "pointer", fontSize: 13 }}
                        >
                            <strong>{o.name}</strong>
                            <span style={{ color: B.muted }}>{o.area_name ? ` · ${o.area_name}` : ""}</span>
                        </button>
                    ))}
                </div>
            )}

            {linked && note(B.muted, `Linked to the registered outlet "${linked.name}"${linked.latitude != null ? "" : " (no registered location yet)"}.`)}
            {!audit.outlet_id && text.trim() && !isGenericOutletName(text) && suggestions.length === 0 &&
                note(B.muted, "No registered outlet matches. This will be registered as a new outlet when you submit.")}
            {!audit.outlet_id && isGenericOutletName(text) && text.trim() &&
                note("#B45309", "Please use the shop's actual name. A generic name can't be linked to one outlet, so this audit would be left out of outlet-level analysis.")}
            {duplicates.length > 0 &&
                note("#B45309", `An outlet called "${duplicates[0].name}" is already registered${duplicates[0].area_name ? ` in ${duplicates[0].area_name}` : ""}. Pick it from the list unless this is a different shop.`)}
            {loadFailed && note(B.muted, "Couldn't load registered outlets. You can still enter the name; it will be matched when you're back online.")}
        </div>
    );
}
