import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";

export default function AuditDetails() {

    const { id } = useParams();

    const [audit, setAudit] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadAudit() {

            const { data, error } = await supabase
                .from("audit_submissions")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {

                console.error(error);

            } else {

                setAudit(data);

            }

            setLoading(false);

        }

        loadAudit();

    }, [id]);
        if (loading) {

        return (

            <div className="min-h-screen flex items-center justify-center">

                Loading audit...

            </div>

        );

    }

    if (!audit) {

        return (

            <div className="min-h-screen flex items-center justify-center">

                Audit not found.

            </div>

        );

    }

    return (

        <div className="min-h-screen bg-slate-100">

            <div className="bg-blue-900 text-white px-8 py-6">

                <h1 className="text-3xl font-bold">

                    Audit Details

                </h1>

            </div>

            <div className="max-w-5xl mx-auto p-8">

                <Link
                    to="/audits/today"
                    className="text-blue-700 hover:underline"
                >
                    ← Back
                </Link>
                                <div className="bg-white rounded-xl shadow mt-6 p-8">

                    <h2 className="text-2xl font-bold mb-6">

                        Outlet Information

                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">

                        <div>

                            <strong>Shop Name</strong>

                            <p>{audit.outlet?.shop_name || "-"}</p>

                        </div>

                        <div>

                            <strong>Visit Date</strong>

                            <p>{audit.outlet?.visit_date || "-"}</p>

                        </div>

                        <div>

                            <strong>Person Met</strong>

                            <p>{audit.outlet?.person_met || "-"}</p>

                        </div>

                        <div>

                            <strong>Position</strong>

                            <p>{audit.outlet?.position || "-"}</p>

                        </div>

                        <div>

                            <strong>Mobile</strong>

                            <p>{audit.outlet?.mobile || "-"}</p>

                        </div>

                        <div>

                            <strong>Area</strong>

                            <p>{audit.outlet?.area_id || "-"}</p>

                        </div>

                    </div>

                </div>

                <div className="bg-white rounded-xl shadow mt-6 p-8">

                    <h2 className="text-2xl font-bold mb-4">

                        Market Information

                    </h2>

                    <p><strong>Distributor:</strong> {audit.market?.distributor || "-"}</p>

                    <p><strong>Competitor:</strong> {audit.market?.competitor || "-"}</p>

                    <p><strong>Retailer Feedback:</strong> {audit.market?.feedback || "-"}</p>

                    <p><strong>Notes:</strong> {audit.market?.notes || "-"}</p>

                </div>

            </div>

        </div>

    );

}