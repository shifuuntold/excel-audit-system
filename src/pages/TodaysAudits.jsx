import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

import { getTodaysAudits } from "../services/auditHistoryService";

export default function TodaysAudits() {

    const { user } = useAuth();

    const [audits, setAudits] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

    async function loadAudits() {

        if (!user) return;

        try {

            const data = await getTodaysAudits(user.id);

            setAudits(data);

        } catch (error) {

            console.error(error);

        } finally {

            setLoading(false);

        }

    }

    loadAudits();

}, [user]);

if (loading) {

    return (

        <div className="min-h-screen flex items-center justify-center">

            <p className="text-lg font-semibold">

                Loading today's audits...

            </p>

        </div>

    );

}

return (

    <div className="min-h-screen bg-slate-100">

        <div className="bg-blue-900 text-white px-8 py-6 shadow">

            <h1 className="text-3xl font-bold">

                Today's Audits

            </h1>

            <p className="text-blue-200">

                Audits submitted today

            </p>

        </div>

        <div className="max-w-5xl mx-auto p-8">

            <Link

                to="/dashboard"

                className="text-blue-700 hover:underline"

            >

                ← Back to Dashboard

            </Link>

            <div className="mt-6 space-y-4">
                {audits.length === 0 ? (

    <div className="bg-white rounded-xl shadow p-8 text-center">

        <p className="text-gray-500">

            No audits submitted today.

        </p>

    </div>

) : (

    audits.map((audit) => (

        <div
            key={audit.id}
            className="bg-white rounded-xl shadow p-6"
        >

            <div className="flex justify-between items-start">

                <div>

                    <h2 className="text-xl font-bold">

                        {audit.outlet?.shop_name || "Unnamed Outlet"}

                    </h2>

                    <p className="text-gray-600 mt-1">

                        Area: {audit.outlet?.area_id || "-"}

                    </p>

                    <p className="text-gray-600">

                        Person Met: {audit.outlet?.person_met || "-"}

                    </p>

                </div>

                <div className="text-right">

                    <p className="text-sm text-gray-500">

                        {new Date(audit.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}

                    </p>

                </div>

            </div>

        </div>

    ))

)}
            </div>

        </div>

    </div>

)};