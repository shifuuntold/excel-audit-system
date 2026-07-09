import { B } from "../../config/theme";

export default function Toggle({ options, value, onChange }) {
    return (
        <div
            style={{
                display: "inline-flex",
                background: B.blueFaint,
                borderRadius: 10,
                padding: 4,
                gap: 4,
            }}
        >
            {options.map((option) => {
                const active = value === option;
                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 8,
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 13,
                            fontWeight: 600,
                            background: active ? B.blue : "transparent",
                            color: active ? B.white : B.muted,
                            transition: "all .15s ease",
                        }}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}
