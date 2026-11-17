import { localIsoDate } from "../utils/format";

export const BLANK_AUDIT = {
    shop_name: "",
    outlet_id: null,          // registered outlet this audit is linked to (null = new outlet)
    area_id: "",
    area_name: "",
    visit_date: localIsoDate(),

    person_met: "",
    position: "",
    mobile: "",

    latitude: null,
    longitude: null,
    captured_accuracy_m: null, // device-reported accuracy of the capture, metres

    products: {},
    market: {},
};
