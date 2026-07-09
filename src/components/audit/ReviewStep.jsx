import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import { useAudit } from "../../contexts/AuditContext";

export default function ReviewStep() {
    const { audit } = useAudit();
    
    const market = audit.market || {};
    const products = audit.products || {};

    return (

        <Card>

            <CardTitle icon="✅">
                Review Audit
            </CardTitle>

            <div className="space-y-6">
                                <div>

                    <h3 className="text-lg font-semibold mb-3">
                        Outlet Information
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">

                        <div>
                            <strong>Outlet</strong>
                            <br />
                            {audit.shop_name || "-"}
                        </div>

                        <div>
                            <strong>Area</strong>
                            <br />
                            {audit.area_id || "-"}
                        </div>

                        <div>
                            <strong>Person Met</strong>
                            <br />
                            {audit.person_met || "-"}
                        </div>

                        <div>
                            <strong>Mobile</strong>
                            <br />
                            {audit.mobile || "-"}
                        </div>

                    </div>

                </div>
                                <div>

                    <h3 className="text-lg font-semibold mb-3">
                        Market Information
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4">

                        <div>
                            <strong>Position</strong>
                            <br />
                            {market.position || "-"}
                        </div>

                        <div>
                            <strong>Distributor</strong>
                            <br />
                            {market.distributor || "-"}
                        </div>

                        <div>
                            <strong>Competitor</strong>
                            <br />
                            {market.competitor || "-"}
                        </div>

                    </div>

                </div>
                                <div>

                    <h3 className="text-lg font-semibold mb-3">
                        Products Summary
                    </h3>

                    <div className="bg-slate-100 rounded-lg p-4">

                        <p className="text-gray-700">
                            Total Products Recorded:
                            <strong className="ml-2">
                                {Object.values(products || {}).filter(Boolean).length}
                            </strong>
                        </p>

                    </div>

                </div>

                <div>

                    <h3 className="text-lg font-semibold mb-3">
                        Retailer Feedback
                    </h3>

                    <div className="bg-slate-100 rounded-lg p-4">

                        {market.feedback ? (
                            <p>{market.feedback}</p>
                        ) : (
                            <p className="text-gray-500">
                                No feedback recorded.
                            </p>
                        )}

                    </div>

                </div>

                <div>

                    <h3 className="text-lg font-semibold mb-3">
                        Additional Notes
                    </h3>

                    <div className="bg-slate-100 rounded-lg p-4">

                        {market.notes ? (
                            <p>{market.notes}</p>
                        ) : (
                            <p className="text-gray-500">
                                No notes recorded.
                            </p>
                        )}

                    </div>

                </div>

            </div>

        </Card>

    );

}