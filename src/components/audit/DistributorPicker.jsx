import { useEffect, useState } from "react";
import { getDistributors, findOrCreateDistributor } from "../../services/distributorService";
import { DISTRIBUTORS as FALLBACK_DISTRIBUTORS } from "../../config/productCatalog";
import Label from "../common/Label";
import SubLabel from "../common/SubLabel";
import { B } from "../../config/theme";
import { Plus, Check, X } from "lucide-react";

// value: string[] — supports selecting more than one distributor per outlet
export default function DistributorPicker({ value = [], onChange }) {
    const [options, setOptions] = useState(FALLBACK_DISTRIBUTORS);
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getDistributors()
            .then((list) => {
                if (list && list.length > 0) {
                    setOptions([...new Set(list.map((d) => d.name))].sort());
                }
            })
            .catch(console.error);
    }, []);

    function toggle(name) {
        const next = value.includes(name)
            ? value.filter((n) => n !== name)
            : [...value, name];
        onChange(next);
    }

    async function handleAdd() {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const created = await findOrCreateDistributor(newName.trim());
            setOptions((prev) => (prev.includes(created.name) ? prev : [...prev, created.name].sort()));
            toggle(created.name);
            setNewName("");
            setAdding(false);
        } catch (error) {
            console.error(error);
            alert("Couldn't save that distributor. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ marginBottom: 16 }}>
            <Label>Distributors Supplying This Outlet</Label>
            <SubLabel>Select all that apply — most outlets have just one, but pick more if several supply it.</SubLabel>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {options.map((name) => {
                    const active = value.includes(name);
                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() => toggle(name)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: 20,
                                fontSize: 12.5,
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

                {adding ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                            autoFocus
                            className="eb-input"
                            style={{ padding: "6px 12px", fontSize: 12.5, width: 130, borderRadius: 20 }}
                            placeholder="New distributor..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={saving}
                            style={{ background: B.green, border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <Check size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAdding(false); setNewName(""); }}
                            style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: "50%", width: 28, height: 28, color: B.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: 12.5,
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
}
