import { B } from "../../config/theme";

export default function PageContainer({ children, withNav = true, maxWidth = 960, style, ...rest }) {
    return (
        <div
            style={{
                minHeight: "100vh",
                background: B.bg,
                paddingBottom: withNav ? 88 : 32,
                ...style,
            }}
            {...rest}
        >
            <div
                style={{
                    maxWidth,
                    margin: "0 auto",
                    padding: "24px 20px",
                }}
            >
                {children}
            </div>
        </div>
    );
}
