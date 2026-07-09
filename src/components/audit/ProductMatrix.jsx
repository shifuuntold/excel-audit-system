import { memo, useCallback } from "react";

import { B } from "../../config/theme";
import { cellOk } from "../../config/productCatalog";

export default memo(function ProductMatrix({
    product,
    title,
    sizes,
    flavours,
    checked,
    onChange,
}) {

    const toggle = useCallback(
        (size, flavour) => {
            const key = `${size}|${flavour}`;

            onChange((prev) => ({
                ...prev,
                [key]: !prev[key],
            }));
        },
        [onChange]
    );
        const total = Object.values(checked).filter(Boolean).length;

    return (
        <div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                }}
            >
                <span
                    style={{
                        fontWeight: 700,
                        color: B.text,
                        fontSize: 13,
                    }}
                >
                    {title}
                </span>

                {total > 0 && (
                    <span
                        style={{
                            background: B.green,
                            color: "#fff",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 9px",
                        }}
                    >
                        {total} ✓
                    </span>
                )}
            </div>

            <div
                style={{
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                }}
            >
                <table
                    style={{
                        borderCollapse: "collapse",
                        fontSize: 11,
                        minWidth: Math.max(
                            300,
                            sizes.length * 58 + 110
                        ),
                    }}
                >
                    <thead>
                        <tr
                            style={{
                                background: B.blueFaint,
                            }}
                        >
                            <th
                                style={{
                                    padding: "7px 10px",
                                    textAlign: "left",
                                    color: B.muted,
                                    fontWeight: 600,
                                    borderBottom: `2px solid ${B.blueLight}`,
                                    minWidth: 100,
                                }}
                            >
                                Flavour
                            </th>

                            {sizes.map((size) => (
                                <th
                                    key={size}
                                    style={{
                                        padding: "7px 6px",
                                        textAlign: "center",
                                        color: B.blue,
                                        fontWeight: 700,
                                        borderBottom: `2px solid ${B.blueLight}`,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {size}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                                                {flavours.map(({ k, l }, rowIndex) => (
                            <tr
                                key={k}
                                style={{
                                    background:
                                        rowIndex % 2 === 0
                                            ? "#FAFBFF"
                                            : B.white,
                                }}
                            >
                                <td
                                    style={{
                                        padding: "5px 10px",
                                        fontWeight: 600,
                                        color: B.text,
                                        fontSize: 12,
                                        borderBottom: `1px solid ${B.blueLight}`,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {l}
                                </td>

                                {sizes.map((size) => {
                                    const valid = cellOk(
                                        product,
                                        size,
                                        k
                                    );

                                    const checkedValue =
                                        checked[`${size}|${k}`];

                                    return (
                                        <td
                                            key={size}
                                            style={{
                                                padding: "4px",
                                                textAlign: "center",
                                                borderBottom: `1px solid ${B.blueLight}`,
                                            }}
                                        >
                                            {valid ? (
                                                <button
                                                    onClick={() =>
                                                        toggle(size, k)
                                                    }
                                                    style={{
                                                        width: 30,
                                                        height: 30,
                                                        borderRadius: 7,
                                                        border: `2px solid ${
                                                            checkedValue
                                                                ? B.blue
                                                                : B.border
                                                        }`,
                                                        background:
                                                            checkedValue
                                                                ? B.blue
                                                                : B.white,
                                                        color: "#fff",
                                                        fontSize: 15,
                                                        cursor: "pointer",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        margin: "auto",
                                                        transition:
                                                            "all 0.12s",
                                                    }}
                                                >
                                                    {checkedValue && "✓"}
                                                </button>
                                            ) : (
                                                <div
                                                    title="Not available in this combination"
                                                    style={{
                                                        width: 30,
                                                        height: 30,
                                                        borderRadius: 7,
                                                        margin: "auto",
                                                        background:
                                                            "#B8C9E0",
                                                        backgroundImage:
                                                            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)",
                                                    }}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                                            </tbody>
                </table>
            </div>

            <p
                style={{
                    fontSize: 11,
                    color: B.muted,
                    marginTop: 7,
                    marginBottom: 0,
                }}
            >
                Tap a cell to mark as stocked. Shaded cells indicate product
                combinations that do not exist.
            </p>

        </div>
    );
});
