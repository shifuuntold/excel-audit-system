import { memo, useCallback } from "react";
import { B } from "../../config/theme";

export default memo(function SimpleMatrix({
  label,
  sizes,
  flavours,
  checked,
  onChange,
}) {
  const toggle = useCallback(
    (size, fk) => {
      const key = `${size}|${fk}`;
      onChange((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    [onChange]
  );

  const total = Object.values(checked || {}).filter(Boolean).length;

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: B.text,
            fontSize: 13,
          }}
        >
          {label}
        </span>

        {total > 0 && (
          <span
            style={{
              background: B.green,
              color: "#fff",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
            }}
          >
            {total} ✓
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 11,
            minWidth: sizes.length * 60 + 110,
          }}
        >
          <thead>
            <tr style={{ background: B.blueFaint }}>
              <th
                style={{
                  padding: "6px 10px",
                  textAlign: "left",
                  color: B.muted,
                  fontWeight: 600,
                  borderBottom: `2px solid ${B.blueLight}`,
                  minWidth: 100,
                }}
              >
                Flavour
              </th>

              {sizes.map((s) => (
                <th
                  key={s}
                  style={{
                    padding: "6px",
                    textAlign: "center",
                    color: B.blue,
                    fontWeight: 700,
                    borderBottom: `2px solid ${B.blueLight}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {flavours.map(({ k, l }, ri) => (
              <tr
                key={k}
                style={{
                  background: ri % 2 === 0 ? "#FAFBFF" : B.white,
                }}
              >
                <td
                  style={{
                    padding: "5px 10px",
                    fontWeight: 600,
                    color: B.text,
                    fontSize: 12,
                    borderBottom: `1px solid ${B.blueLight}`,
                  }}
                >
                  {l}
                </td>

                {sizes.map((s) => {
                  const ck = checked?.[`${s}|${k}`];

                  return (
                    <td
                      key={s}
                      style={{
                        padding: "4px",
                        textAlign: "center",
                        borderBottom: `1px solid ${B.blueLight}`,
                      }}
                    >
                      <button
                        onClick={() => toggle(s, k)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 7,
                          border: `2px solid ${ck ? B.blue : B.border}`,
                          background: ck ? B.blue : B.white,
                          color: "#fff",
                          fontSize: 15,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "auto",
                        }}
                      >
                        {ck && "✓"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});