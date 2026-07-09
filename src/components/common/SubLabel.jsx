import { B } from "../../config/theme";

export default function SubLabel({ children }) {
    return (
        <p
            style={{
                fontSize: 12,
                color: B.muted,
                marginTop: 4,
                marginBottom: 0,
            }}
        >
            {children}
        </p>
    );
}
