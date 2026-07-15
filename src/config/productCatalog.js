const DTT_FLAVOURS = [
  {k:"O",    l:"Orange"},
  {k:"S",    l:"Strawberry"},
  {k:"P",    l:"Pineapple"},
  {k:"T",    l:"Tangerine"},
  {k:"F",    l:"Fizto"},
  {k:"LT",   l:"Lemon"},
  {k:"CP",   l:"Cocopine"},
  {k:"MC",   l:"Mango Colada"},
  {k:"LIME", l:"Lime Cordial"},
];
const RTD_FLAVOURS = [
  {k:"O",  l:"Orange"}, {k:"S",  l:"Strawberry"}, {k:"P", l:"Pineapple"},
  {k:"T",  l:"Tangerine"}, {k:"F", l:"Fizto"}, {k:"LT", l:"Lemon"},
];
const DTT_SIZES = ["500ml","700ml","1L","1.5L","2L","3L","5L"];
const RTD_SIZES = ["150C","150 PET","300N","300J","500S"];

const CHAMP_FLAVOURS = [
  {k:"O", l:"Orange"}, {k:"MC", l:"Mango Colada"}, {k:"BG", l:"BG"}, {k:"TW", l:"TW"},
];
const CHAMP_SIZES = ["100ml","150ml","300ml"];

const GOFRUT_FLAVOURS = [
  {k:"OR",l:"Orange"},{k:"AP",l:"Apple"},{k:"MN",l:"Mango"},
  {k:"MF",l:"MultiFruit"},{k:"MJ",l:"Mojito"},
];
const GOFRUT_SIZES = ["250ml","500ml","1L"];

const WB_FLAVOURS = [
  {k:"BK",l:"Blackcurrant"},{k:"TF",l:"Tuttifruit"},{k:"FT",l:"Fantasy"},
];
const WB_SIZES = ["100ml","250ml"];

const FF_FLAVOURS = [
  {k:"PC",l:"Pinacolada"},{k:"MN",l:"Mango"},{k:"CA",l:"Cranberry Apple"},
];

const JP_FLAVOURS = [{k:"S",l:"Strawberry"},{k:"B",l:"Blackcurrant"}];
const JP_SIZES    = ["30g","50g","65g"];

const WATER_SIZES    = ["200ml","300ml","500ml TP","1L","1.5L","5L","10L","18L"];
const COCOA_SACHETS  = ["8g","16g","40g"];
const COCOA_JARS     = ["80g jar","160g jar","320g jar"];
const DC_SACHETS     = ["8g","16g","50g","100g"];
const DC_JARS        = ["100g jar","200g jar","400g jar"];
const GLUC_SACHETS   = ["10g","50g"];
const GLUC_PKTS      = ["50g pkt","100g pkt"];
const GLUC_JARS      = ["250g jar","500g jar"];
const RELOAD_SIZES   = ["250ml","500ml"];
const ENERGY_SIZES   = ["300ml","500ml"];

// Shaded (invalid) cells from the physical Market Information Sheet
const INVALID = new Set([
  "DTT|500ml|S","DTT|500ml|T","DTT|500ml|F","DTT|500ml|LT","DTT|500ml|CP","DTT|500ml|MC","DTT|500ml|LIME",
  "DTT|700ml|S","DTT|700ml|T","DTT|700ml|LT","DTT|700ml|CP","DTT|700ml|MC",
  "DTT|1.5L|S",
  "DTT|2L|LIME",
  "DTT|3L|LIME",
  "DTT|5L|T","DTT|5L|LT","DTT|5L|LIME",
]);
const cellOk = (prod, size, flav) => !INVALID.has(`${prod}|${size}|${flav}`);

const POSITIONS    = ["Owner","Manager","Shop Attendant","Cashier","Supervisor","Other"];
const DISTRIBUTORS = ["Jumra","Twiga","Mahitaji","MG","Haykal","General Wholesaler","None","Other"];
const STEPS        = ["Outlet","Products"
  ,"Market","Review"];

export {
  DTT_FLAVOURS, DTT_SIZES,
  RTD_FLAVOURS, RTD_SIZES,
    CHAMP_FLAVOURS, CHAMP_SIZES,
    GOFRUT_FLAVOURS, GOFRUT_SIZES,
    WB_FLAVOURS, WB_SIZES,
    FF_FLAVOURS,
    JP_FLAVOURS, JP_SIZES,
    WATER_SIZES,
    COCOA_SACHETS, COCOA_JARS,
    DC_SACHETS, DC_JARS,
    GLUC_SACHETS, GLUC_PKTS, GLUC_JARS,
    RELOAD_SIZES,
    ENERGY_SIZES,
    INVALID, cellOk,
    POSITIONS, DISTRIBUTORS, STEPS,
};
// Competitor categories, matching the field audit report's structure —
// each maps to the Excel product line(s) it competes against, and ships
// with the brand names already seen in past audits as a starting list.
// The competitors table in Supabase is the source of truth once seeded;
// this is the fallback if that fetch fails or is empty.
export const COMPETITOR_CATEGORIES = [
    {
        key: "water",
        label: "Water",
        productKey: "water",
        options: ["Eden Waves", "Aquatick", "Dasani", "Keringet", "Glacier", "Highland", "Aquaclear", "Aquabook", "Aqua Creek", "Mt. Kenyan", "Belmont Springs", "Oxyrich", "Aquamist", "Quumist", "Baraka", "Mountain Chill", "Waba", "Aqua Falls", "Victoria Fresh", "Kenya Springs", "Aquatic Wells", "Mountain Springs", "Lango Water", "Jojah Water"],
    },
    {
        key: "rtd",
        label: "RTD",
        productKey: "rtd",
        options: ["Minute Maid", "Ukwaju", "Embe", "Jooz", "Afia", "Frutz", "Marchie", "Juo", "UFresh"],
    },
    {
        key: "dc",
        label: "Drinking Chocolate",
        productKey: "dc",
        options: ["Choco Primo", "Cadbury", "Dairyland", "Miksi", "Twisco", "Clovers Cocoa"],
    },
    {
        key: "cocoa",
        label: "Cocoa",
        productKey: "cocoa",
        options: ["Coco Primo", "Cadbury"],
    },
    {
        key: "tetrapak",
        label: "Tetra Pack (Fruit Full)",
        productKey: "ff",
        options: ["Pick N Peel", "Sun Top", "Ribena", "Del Monte", "Dairy Fresh", "Frosti", "Orchid Valley", "Acacia Kids"],
    },
    {
        key: "gluc",
        label: "Glucose",
        productKey: "gluc",
        options: ["Mr. Energy", "Clovers", "Rapras", "K-Power"],
    },
    {
        key: "dtd",
        label: "DTD (Quencher DTT)",
        productKey: "dtt",
        options: ["Savannah", "Highlands", "Pep"],
    },
];
