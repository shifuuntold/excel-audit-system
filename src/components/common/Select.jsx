import Label from "./Label";
import SubLabel from "./SubLabel";

export default function Select({
    label,
    hint,
    error,
    required,
    placeholder,
    children,
    className = "",
    ...props
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            {label && <Label required={required}>{label}</Label>}

            <select
                className={`eb-input ${error ? "eb-input-error" : ""} ${className}`}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {children}
            </select>

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
