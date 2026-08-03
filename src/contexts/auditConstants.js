import { localIsoDate } from "../utils/format";

export const BLANK_AUDIT = {
    shop_name: "",
    area_id: "",
    area_name: "",
    visit_date: localIsoDate(),

    person_met: "",
    position: "",
    mobile: "",

    latitude: null,
    longitude: null,

    products: {},
    market: {},
};
