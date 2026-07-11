import { useEffect, useState } from "react";
import { COMPETITOR_CATEGORIES } from "../../config/productCatalog";
import { getCompetitorsByCategory, findOrCreateCompetitor } from "../../services/competitorService";
import Label from "../common/Label";
import SubLabel from "../common/SubLabel";
import { B } from "../../config/theme";
import { Plus, Check, X } from "lucide-react";

// value: { water: ["Dasani"], rtd: [...], ... }
export default function CompetitorPicker({ value = {}, onChange }) {
    const [optionsByCategory, setOptionsByCategory] = useState(
        Object.fromEntries(COMPETITOR_CATEGORIES.map((c) => [c.key, c.options]))
    );
    const [addingCategory, setAddingCategory] = useState(null);
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getCompetitorsByCategory()
            .then((fromDb) => {
                setOptionsByCategory((prev) => {
                    const merged = { ...prev };
                    for (const cat of COMPETITOR_CATEGORIES) {
                        const dbNames = fromDb[cat.key] || [];
                        merged[cat.key] = dbNames.length > 0
                            ? [...new Set([...dbNames, ...cat.options])].sort()
                            : prev[cat.key];
                    }
                    return merged;
                });
            })
            .catch(console.error);
    }, []);

    function toggle(categoryKey, name) {
        const current = value[categoryKey] || [];
        const next = current.includes(name)
            ? current.filter((n) => n !== name)
            : [...current, name];
        onChange({ ...value, [categoryKey]: next });
    }

    async function handleAdd(categoryKey) {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const created = await findOrCreateCompetitor(categoryKey, newName.trim());
            setOptionsByCategory((prev) => ({
                ...prev,
                [categoryKey]: prev[categoryKey].includes(created.name)
                    ? prev[categoryKey]
                    : [...prev[categoryKey], created.name].sort(),
            }));
            toggle(categoryKey, created.name);
            setNewName("");
            setAddingCategory(null);
        } catch (error) {
            console.error(error);
            alert("Couldn't save that competitor. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ marginBottom: 16 }}>
            <Label>Competitors Observed</Label>
            <SubLabel>Select any competing brands seen on shelf, by category. Leave a category blank if none were seen.</SubLabel>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                {COMPETITOR_CATEGORIES.map((cat) => {
                    const selected = value[cat.key] || [];
                    const options = optionsByCategory[cat.key] || cat.options;

                    return (
                        <div
                            key={cat.key}
                            style={{
                                background: B.blueFaint,
                                borderRadius: 12,
                                padding: 12,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: B.text }}>
                                    {cat.label}
                                </span>
                                {selected.length > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: B.blue }}>
                                        {selected.length} selected
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {options.map((name) => {
                                    const active = selected.includes(name);
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => toggle(cat.key, name)}
                                            style={{
                                                padding: "5px 12px",
                                                borderRadius: 20,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                border: `1.5px solid ${active ? B.blue : B.border}`,
                                                background: active ? B.blue : B.white,
                                                color: active ? B.white : B.text,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {name}
                                        </button>
                                    );
                                })}

                                {addingCategory === cat.key ? (
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                        <input
                                            autoFocus
                                            className="eb-input"
                                            style={{ padding: "5px 10px", fontSize: 12, width: 120, borderRadius: 20 }}
                                            placeholder="New brand..."
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd(cat.key))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAdd(cat.key)}
                                            disabled={saving}
                                            style={{ background: B.green, border: "none", borderRadius: "50%", width: 26, height: 26, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                            <Check size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setAddingCategory(null); setNewName(""); }}
                                            style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: "50%", width: 26, height: 26, color: B.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setAddingCategory(cat.key)}
                                        style={{
                                            padding: "5px 10px",
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            border: `1.5px dashed ${B.border}`,
                                            background: "transparent",
                                            color: B.muted,
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 3,
                                        }}
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
