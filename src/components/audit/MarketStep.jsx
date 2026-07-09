import Card from "../common/Card";
import CardTitle from "../common/CardTitle";
import { useAudit } from "../../contexts/AuditContext";

import {
    DISTRIBUTORS,
    POSITIONS,
} from "../../config/productCatalog";

export default function MarketStep() {
    const { audit, setAudit } = useAudit();

    const market = audit.market || {};

    function update(field, value) {

    setAudit(prev => ({

        ...prev,

        market: {

            ...prev.market,

            [field]: value,

        },

    }));

}

    return (

        <Card>

            <CardTitle icon="🏪">
                Market Information
            </CardTitle>

            <div className="space-y-5">
                            {/* Contact Person */}

            <div>
                <label className="block text-sm font-medium mb-2">
                    Contact Person Position
                </label>

                <select
                    className="w-full border rounded-lg p-3"
                    value={market.position || ""}
                    onChange={(e) =>
                        update("position", e.target.value)
                    }
                >
                    <option value="">
                        Select Position
                    </option>

                    {POSITIONS.map((position) => (
                        <option
                            key={position}
                            value={position}
                        >
                            {position}
                        </option>
                    ))}
                </select>
            </div>

            {/* Distributor */}

            <div>
                <label className="block text-sm font-medium mb-2">
                    Main Distributor
                </label>

                <select
                    className="w-full border rounded-lg p-3"
                    value={market.distributor || ""}
                    onChange={(e) =>
                        update("distributor", e.target.value)
                    }
                >
                    <option value="">
                        Select Distributor
                    </option>

                    {DISTRIBUTORS.map((distributor) => (
                        <option
                            key={distributor}
                            value={distributor}
                        >
                            {distributor}
                        </option>
                    ))}
                </select>
            </div>

            {/* Competitor */}

            <div>
                <label className="block text-sm font-medium mb-2">
                    Main Competitor
                </label>

                <input
                    type="text"
                    className="w-full border rounded-lg p-3"
                    placeholder="e.g. Coca-Cola, Kevian, Del Monte..."
                    value={market.competitor || ""}
                    onChange={(e) =>
                        update("competitor", e.target.value)
                    }
                />
            </div>
                        {/* Retailer Feedback */}

            <div>
                <label className="block text-sm font-medium mb-2">
                    Retailer Feedback
                </label>

                <textarea
                    rows={4}
                    className="w-full border rounded-lg p-3"
                    placeholder="What did the retailer say about Excel products?"
                    value={market.feedback || ""}
                    onChange={(e) =>
                        update("feedback", e.target.value)
                    }
                />
            </div>

            {/* Additional Notes */}

            <div>
                <label className="block text-sm font-medium mb-2">
                    Additional Notes
                </label>

                <textarea
                    rows={4}
                    className="w-full border rounded-lg p-3"
                    placeholder="Any additional market observations..."
                    value={market.notes || ""}
                    onChange={(e) =>
                        update("notes", e.target.value)
                    }
                />
            </div>

        </div>

    </Card>

    );

}