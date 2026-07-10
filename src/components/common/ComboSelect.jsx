import { useState } from "react";
import Label from "./Label";
import SubLabel from "./SubLabel";
import { B } from "../../config/theme";
import { Plus, Check, X } from "lucide-react";

// A <select> that also lets the user type a brand-new option, which gets
// saved via onAddNew and immediately selected. Used for distributors,
// and anywhere else a fixed list needs to grow over time.
export default function ComboSelect({
    label,
    placeholder = "Select...",
    value,
    options,
    onChange,
    onAddNew,
    required,
}) {
    const [adding, setAdding] = useState(false);
    const [newValue, setNewValue] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleAdd() {
        if (!newValue.trim()) return;
        setSaving(true);
        try {
            await onAddNew(newValue.trim());
            setNewValue("");
            setAdding(false);
        } catch (error) {
            console.error(error);
            alert("Couldn't save that. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    if (adding) {
        return (
            <div style={{ marginBottom: 16 }}>
                {label && <Label required={required}>{label}</Label>}
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        className="eb-input"
                        autoFocus
                        placeholder="Type new name..."
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={saving}
                        style={{ background: B.green, border: "none", borderRadius: 10, width: 42, color: "#fff", cursor: "pointer", flexShrink: 0 }}
                    >
                        <Check size={16} style={{ margin: "0 auto" }} />
                    </button>
                    <button
                        type="button"
                        onClick={() => { setAdding(false); setNewValue(""); }}
                        style={{ background: B.blueFaint, border: "none", borderRadius: 10, width: 42, color: B.muted, cursor: "pointer", flexShrink: 0 }}
                    >
                        <X size={16} style={{ margin: "0 auto" }} />
                    </button>
                </div>
                <SubLabel>Saved names are available to every rep going forward.</SubLabel>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: 16 }}>
            {label && <Label required={required}>{label}</Label>}
            <div style={{ display: "flex", gap: 8 }}>
                <select
                    className="eb-input"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">{placeholder}</option>
                    {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    title="Add new"
                    style={{ background: B.blueFaint, border: `1.5px solid ${B.border}`, borderRadius: 10, width: 42, color: B.blue, cursor: "pointer", flexShrink: 0 }}
                >
                    <Plus size={16} style={{ margin: "0 auto" }} />
                </button>
            </div>
        </div>
    );
}
