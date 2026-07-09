export default function Pill({
    label,
    active,
    onClick,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                `px-4 py-2 rounded-full border transition
                ${
                    active
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white hover:bg-slate-100"
                }`
            }
        >
            {label}
        </button>
    );
}