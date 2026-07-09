import { createContext, useContext, useState } from "react";

const AuditContext = createContext();

export function AuditProvider({ children }) {

    const [audit, setAudit] = useState({

        shop_name: "",
        area_id: "",
        visit_date: new Date().toISOString().split("T")[0],

        person_met: "",
        position: "",
        mobile: "",

        latitude: null,
        longitude: null,

        products: {},
        market: {}

    });

    return (

        <AuditContext.Provider
            value={{
                audit,
                setAudit
            }}
        >

            {children}

        </AuditContext.Provider>

    );

}

export function useAudit() {
    return useContext(AuditContext);
}