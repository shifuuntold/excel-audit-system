import Label from "./Label";
import SubLabel from "./SubLabel";

export default function Input({
    label,
    hint,
    error,
    required,
    className = "",
    ...props
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            {label && <Label required={required}>{label}</Label>}

            <input
                className={`eb-input ${error ? "eb-input-error" : ""} ${className}`}
                {...props}
            />

            {error ? (
                <SubLabel>
                    <span style={{ color: "#C8102E" }}>{error}</span>
                </SubLabel>
            ) : (
                hint && <SubLabel>{hint}</SubLabel>
            )}
        </div>
    );
}
