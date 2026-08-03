import { B } from "../../config/theme";

export default function CardTitle({ icon: Icon, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      {Icon && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 8,
            background: B.blueFaint,
            color: B.blue,
            flexShrink: 0,
          }}
        >
          <Icon size={15} strokeWidth={2.2} />
        </span>
      )}

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