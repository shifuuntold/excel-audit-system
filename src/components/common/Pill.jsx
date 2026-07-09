import { B } from "../../config/theme";

export default function Pill({
  label,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: active ? 700 : 400,
        margin: "3px",
        border: `2px solid ${active ? B.blue : B.border}`,
        background: active ? B.blue : B.white,
        color: active ? B.white : B.muted,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all .12s",
      }}
    >
      {label}
    </button>
  );
}