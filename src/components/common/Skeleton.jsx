// A single shimmering placeholder block. Compose these into page-specific
// layouts (see the Skeleton.* helpers below) so the loading state roughly
// mirrors the shape of the content that's about to arrive — that reads as
// faster and less jarring than a spinner, especially on slower connections.
export function SkeletonBlock({ width = "100%", height = 14, radius = 8, style = {} }) {
    return (
        <div
            className="eb-skeleton"
            style={{
                width,
                height,
                borderRadius: radius,
                ...style,
            }}
        />
    );
}

// A card-shaped skeleton matching the AuditHistory list item layout.
export function SkeletonAuditCard() {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #EBF1FA",
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <SkeletonBlock width="55%" height={16} />
                <SkeletonBlock width="35%" height={12} style={{ marginTop: 10 }} />
                <SkeletonBlock width="40%" height={12} style={{ marginTop: 8 }} />
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <SkeletonBlock width={90} height={18} radius={9} />
                    <SkeletonBlock width={70} height={18} radius={9} />
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <SkeletonBlock width={50} height={12} />
                <SkeletonBlock width={64} height={18} radius={10} />
            </div>
        </div>
    );
}

// A stack of audit-card skeletons, for AuditHistory / SupervisorDashboard lists.
export function SkeletonAuditList({ count = 4 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonAuditCard key={i} />
            ))}
        </div>
    );
}

// Matches the Dashboard stat-card grid + trend chart card.
export function SkeletonDashboard() {
    return (
        <>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            background: "#fff",
                            borderRadius: 16,
                            border: "1px solid #EBF1FA",
                            padding: 18,
                        }}
                    >
                        <SkeletonBlock width={34} height={34} radius={10} />
                        <SkeletonBlock width="70%" height={22} style={{ marginTop: 14 }} />
                        <SkeletonBlock width="90%" height={11} style={{ marginTop: 10 }} />
                    </div>
                ))}
            </div>
            <div
                style={{
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #EBF1FA",
                    padding: 20,
                    marginBottom: 28,
                }}
            >
                <SkeletonBlock width="45%" height={14} style={{ marginBottom: 18 }} />
                <SkeletonBlock width="100%" height={140} radius={12} />
            </div>
        </>
    );
}

// Matches the AuditDetails page's field-grid sections.
export function SkeletonAuditDetails() {
    return (
        <>
            {[6, 3, 2].map((fieldCount, sectionIndex) => (
                <div
                    key={sectionIndex}
                    style={{
                        background: "#fff",
                        borderRadius: 16,
                        border: "1px solid #EBF1FA",
                        padding: 22,
                        marginBottom: 16,
                    }}
                >
                    <SkeletonBlock width="35%" height={16} style={{ marginBottom: 18 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                        {Array.from({ length: fieldCount }).map((_, i) => (
                            <div key={i}>
                                <SkeletonBlock width="60%" height={10} />
                                <SkeletonBlock width="80%" height={14} style={{ marginTop: 8 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}

// Matches the Reports page's written-report card (heading + paragraph blocks).
export function SkeletonReport() {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #EBF1FA",
                padding: 26,
            }}
        >
            <SkeletonBlock width="50%" height={18} style={{ marginBottom: 8 }} />
            <SkeletonBlock width="70%" height={12} style={{ marginBottom: 24 }} />

            {[3, 4, 2].map((lineCount, i) => (
                <div key={i} style={{ marginBottom: 22 }}>
                    <SkeletonBlock width="30%" height={14} style={{ marginBottom: 12 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Array.from({ length: lineCount }).map((_, j) => (
                            <SkeletonBlock key={j} width={j === lineCount - 1 ? "60%" : "95%"} height={12} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
// Matches the NewAudit wizard shell — used briefly while an existing
// audit's data is being fetched for editing.
export function SkeletonAuditForm() {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: 18,
                border: "1px solid #EBF1FA",
                padding: 24,
            }}
        >
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 28 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBlock key={i} width={34} height={34} radius={999} />
                ))}
            </div>
            <SkeletonBlock width="40%" height={14} style={{ marginBottom: 18 }} />
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                    <SkeletonBlock width="25%" height={10} style={{ marginBottom: 8 }} />
                    <SkeletonBlock width="100%" height={40} radius={10} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonStatRow({ count = 3 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <SkeletonBlock width="40%" height={13} />
                    <SkeletonBlock width="20%" height={13} />
                </div>
            ))}
        </div>
    );
}
