import { B } from "../../config/theme";

export default function CardTitle({ icon, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 17 }}>{icon}</span>

      <span
        style={{
          fontWeight: 700,
          color: B.blue,
          fontSize: 14,
        }}
      >
        {children}
      </span>
    </div>
  );
}