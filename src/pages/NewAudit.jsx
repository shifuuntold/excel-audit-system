import { saveAudit } from "../services/auditService";
import { useAuth } from "../contexts/AuthContext";
import { useAudit } from "../contexts/AuditContext";
import { useState } from "react";
import { Link } from "react-router-dom";

import OutletForm from "../components/audit/OutletForm";
import ProductsStep from "../components/audit/ProductsStep";
import MarketStep from "../components/audit/MarketStep";
import ReviewStep from "../components/audit/ReviewStep";

export default function NewAudit() {

    const { user } = useAuth();

    const { audit, setAudit } = useAudit();

    const [step, setStep] = useState(1);

    const nextStep = () => {
    if (step < 4) {
        setStep(step + 1);
    }
};

async function handleSubmit() {

    try {

        await saveAudit({

    userId: user.id,

    outlet: {
        shop_name: audit.shop_name,
        area_id: audit.area_id,
        visit_date: audit.visit_date,
        person_met: audit.person_met,
        position: audit.position,
        mobile: audit.mobile,
        latitude: audit.latitude,
        longitude: audit.longitude,
    },

    products: audit.products,

    market: audit.market,

});

        alert("✅ Audit submitted successfully!");

        setStep(1);

setAudit({

    shop_name: "",
    area_id: "",
    visit_date: new Date().toISOString().split("T")[0],

    person_met: "",
    position: "",
    mobile: "",

    latitude: null,
    longitude: null,

    products: {},

    market: {},

});

    } catch (error) {

        console.error(error);

        alert("Failed to submit audit.");

    }

}

const previousStep = () => {
    if (step > 1) {
        setStep(step - 1);
    }
};

    return (
        <div className="min-h-screen bg-slate-100">

            <div className="bg-blue-900 text-white px-8 py-6 shadow">

                <h1 className="text-3xl font-bold">
                    New Outlet Audit
                </h1>

                <p className="text-blue-200">
                    Excel Chemicals Field Audit
                </p>

            </div>

            <div className="max-w-6xl mx-auto p-8">

                <Link
                    to="/dashboard"
                    className="text-blue-700 hover:underline"
                >
                    ← Back to Dashboard
                </Link>

                <div className="mt-8 bg-white rounded-xl shadow p-8">
                                    <div className="flex justify-center gap-3 mb-8">

                    {[1, 2, 3, 4].map((number) => (

                        <div
                            key={number}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold
                            ${
                                step >= number
                                    ? "bg-blue-700 text-white"
                                    : "bg-gray-300 text-gray-600"
                            }`}
                        >
                            {number}
                        </div>

                    ))}

                </div>

                {step === 1 && (
                    <OutletForm/>
                )}

                {step === 2 && (
                    <ProductsStep/>
                )}

                {step === 3 && (
                    <MarketStep/>
                )}

                {step === 4 && (
                    <ReviewStep/>
                )}

                <div className="flex justify-between mt-10">

                    <button
                        onClick={previousStep}
                        disabled={step === 1}
                        className={`px-6 py-3 rounded-lg font-semibold
                        ${
                            step === 1
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-gray-600 text-white hover:bg-gray-700"
                        }`}
                    >
                        Previous
                    </button>

                    {step < 4 ? (

                        <button
                            onClick={nextStep}
                            className="px-6 py-3 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-semibold"
                        >
                            Next
                        </button>

                    ) : (

                        <button
    onClick={handleSubmit}
    className="px-6 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold"
>
    Submit Audit
</button>

                    )}

                </div>
                                </div>

            </div>

        </div>

    );

}