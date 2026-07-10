import { useEffect, useRef, useState } from "react";
import { getAreas, findOrCreateArea } from "../../services/areaService";
import Label from "../common/Label";
import SubLabel from "../common/SubLabel";
import { B } from "../../config/theme";
import { Search, MapPin, Loader2, Star } from "lucide-react";

// Debounced search across (1) your own saved areas and (2) OpenStreetMap's
// Nominatim geocoder, restricted to Kenya — so a rep can type "Pipeline" or
// "Utawala" and find it even if it's not in the areas table yet.
export default function LocationSearch({ value, onSelect, required }) {
    const [query, setQuery] = useState(value || "");
    const [open, setOpen] = useState(false);
    const [savedAreas, setSavedAreas] = useState([]);
    const [remoteResults, setRemoteResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const debounceRef = useRef(null);
    const boxRef = useRef(null);

    useEffect(() => {
        getAreas().then(setSavedAreas).catch(console.error);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQuery(value || "");
    }, [value]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (boxRef.current && !boxRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleChange(text) {
        setQuery(text);
        setOpen(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!text.trim() || text.trim().length < 3) {
            setRemoteResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ke&addressdetails=1&limit=6&q=${encodeURIComponent(text)}`;
                const res = await fetch(url, {
                    headers: { "Accept-Language": "en" },
                });
                const data = await res.json();
                setRemoteResults(data || []);
            } catch (error) {
                console.error("Location search failed", error);
                setRemoteResults([]);
            } finally {
                setSearching(false);
            }
        }, 450);
    }

    const matchedSaved = savedAreas.filter((a) =>
        a.name.toLowerCase().includes(query.trim().toLowerCase())
    ).slice(0, 5);

    async function pickSaved(area) {
        setQuery(area.name);
        setOpen(false);
        onSelect({ area_id: area.id, area_name: area.name });
    }

    async function pickRemote(result) {
        const name = formatPlaceName(result);
        setSaving(true);
        try {
            const area = await findOrCreateArea(name, {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
            });
            setQuery(area.name);
            setOpen(false);
            setSavedAreas((prev) => (prev.some((a) => a.id === area.id) ? prev : [...prev, area]));
            onSelect({ area_id: area.id, area_name: area.name });
        } catch (error) {
            console.error("Couldn't save this location", error);
            alert("Couldn't save this location. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    function formatPlaceName(result) {
        const a = result.address || {};
        const parts = [
            a.suburb || a.neighbourhood || a.village || a.town,
            a.city_district || a.city || a.county,
        ].filter(Boolean);
        return parts.length ? [...new Set(parts)].join(", ") : result.display_name;
    }

    return (
        <div ref={boxRef} style={{ position: "relative", marginBottom: 16 }}>
            <Label required={required}>Area / Location</Label>

            <div style={{ position: "relative" }}>
                <Search
                    size={16}
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: B.muted }}
                />
                <input
                    className="eb-input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Search e.g. Pipeline, Utawala..."
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => handleChange(e.target.value)}
                />
                {(searching || saving) && (
                    <Loader2
                        size={16}
                        className="animate-spin"
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: B.blue }}
                    />
                )}
            </div>

            <SubLabel>Search finds your saved areas first, then Kenya-wide locations.</SubLabel>

            {open && query.trim().length > 0 && (matchedSaved.length > 0 || remoteResults.length > 0) && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: B.white,
                        border: `1px solid ${B.blueLight}`,
                        borderRadius: 12,
                        boxShadow: "0 10px 30px rgba(0,48,135,0.18)",
                        marginTop: 4,
                        maxHeight: 280,
                        overflowY: "auto",
                        zIndex: 30,
                    }}
                >
                    {matchedSaved.length > 0 && (
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", padding: "8px 12px 4px", margin: 0 }}>
                                Saved Areas
                            </p>
                            {matchedSaved.map((area) => (
                                <button
                                    key={area.id}
                                    onClick={() => pickSaved(area)}
                                    style={optionStyle}
                                >
                                    <Star size={14} style={{ color: B.amber, flexShrink: 0 }} />
                                    <span>{area.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {remoteResults.length > 0 && (
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: B.muted, textTransform: "uppercase", padding: "8px 12px 4px", margin: 0 }}>
                                Kenya Locations
                            </p>
                            {remoteResults.map((result) => (
                                <button
                                    key={result.place_id}
                                    onClick={() => pickRemote(result)}
                                    style={optionStyle}
                                >
                                    <MapPin size={14} style={{ color: B.blue, flexShrink: 0 }} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {formatPlaceName(result)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const optionStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #F3F4F6",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13.5,
};
