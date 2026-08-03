import { useContext } from "react";
import { AuthContext } from "../contexts/authContextObject";

export function useAuth() {
    return useContext(AuthContext);
}
