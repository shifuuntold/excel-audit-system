import { B } from "../../config/theme";

export default function Card({ children }) {
  return (
    <div
      style={{
        background: B.white,
        borderRadius: 16,
        padding: 18,
        marginBottom: 14,
        boxShadow: "0 2px 14px rgba(0,48,135,0.07)",
        border: `1px solid ${B.blueLight}`,
      }}
    >
      {children}
    </div>
  );
}