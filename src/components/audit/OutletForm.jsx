import { useEffect, useState } from "react";
import { getAreas } from "../../services/areaService";
import { useAudit } from "../../contexts/AuditContext";

export default function OutletForm() {

    const { audit, setAudit } = useAudit();

const [areas, setAreas] = useState([]);

    useEffect(() => {
        async function loadAreas() {
            const list = await getAreas();
            setAreas(list);
        }
        loadAreas();
    }, []);

    function updateField(field, value) {

    setAudit({

        ...audit,

        [field]: value

    });

}

    return (

        <div className="bg-white rounded-xl shadow p-8">

            <h2 className="text-2xl font-bold mb-6">

                Outlet Information

            </h2>

            <div className="grid gap-5">

                <div>

                    <label className="block mb-2 font-semibold">

                        Shop Name

                    </label>

                    <input
                        className="w-full border rounded-lg p-3"
                        value={audit.shop_name || ""}
                        onChange={(e)=>updateField("shop_name",e.target.value)}
                    />

                </div>

                <div>

    <label className="block mb-2 font-semibold">

        Area

    </label>

    <select
        className="w-full border rounded-lg p-3"
        value={audit.area_id}
        onChange={(e)=>updateField("area_id",e.target.value)}
    >

        <option value="">

            Select Area

        </option>

        {areas.map(area=>(
            <option
                key={area.id}
                value={area.id}
            >
                {area.name}
            </option>
        ))}

    </select>

</div>

                <div>

                    <label className="block mb-2 font-semibold">

                        Visit Date

                    </label>

                    <input
                        type="date"
                        className="w-full border rounded-lg p-3"
                        value={audit.visit_date || ""}
                        onChange={(e)=>updateField("visit_date",e.target.value)}
                    />

                </div>

                <div>

                    <label className="block mb-2 font-semibold">

                        Person Met

                    </label>

                    <input
                        className="w-full border rounded-lg p-3"
                        value={audit.person_met || ""}
                        onChange={(e)=>updateField("person_met",e.target.value)}
                    />

                </div>

                <div>

                    <label className="block mb-2 font-semibold">

                        Position

                    </label>

                    <select
                        className="w-full border rounded-lg p-3"
                        value={audit.position || ""}
                        onChange={(e)=>updateField("position",e.target.value)}
                    >

                        <option value="">Select Position</option>
                        <option>Owner</option>
                        <option>Manager</option>
                        <option>Shop Attendant</option>
                        <option>Cashier</option>
                        <option>Supervisor</option>
                        <option>Other</option>

                    </select>

                </div>

                <div>

                    <label className="block mb-2 font-semibold">

                        Mobile Number

                    </label>

                    <input
                        className="w-full border rounded-lg p-3"
                        value={audit.mobile || ""}
                        onChange={(e)=>updateField("mobile",e.target.value)}
                    />

                </div>

            </div>

        </div>

    );

}