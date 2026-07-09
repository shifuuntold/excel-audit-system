import { B } from "../../config/theme";

export default function Label({ children, required }) {
    return (
        <label
            style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: B.text,
                marginBottom: 6,
            }}
        >
            {children}
            {required && <span style={{ color: B.red }}> *</span>}
        </label>
    );
}
