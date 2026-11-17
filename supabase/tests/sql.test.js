// Runs the real migrations on an in-process PostgreSQL (PGlite).
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CONTRACTS } from "../functions/ai-dashboard-query/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const read = (f) => readFileSync(join(here, f), "utf8");
const migration = (name) => readFileSync(join(migrationsDir, name), "utf8");

const SUP = "00000000-0000-0000-0000-0000000000a1";
const AUD = "00000000-0000-0000-0000-0000000000b1";
const AUD2 = "00000000-0000-0000-0000-0000000000b2";

// Legacy audits are inserted BEFORE the migrations run, as in production.
function legacy(id, shop, area, lat, lon, extra = {}) {
  const outlet = { shop_name: shop, area_id: area, area_name: area, visit_date: "2026-08-01", person_met: "Jane", mobile: "0700", ...(lat != null ? { latitude: lat, longitude: lon } : {}) };
  return { id, outlet, products: extra.products ?? { dtt: { "500ml|orange": true } }, market: extra.market ?? { visited: "Yes", promotion: "No" }, created_at: extra.created_at ?? "2026-08-01T10:00:00Z", user_id: extra.user_id ?? AUD };
}

let db;
const legacyRows = [
  legacy("10000000-0000-0000-0000-000000000001", "Kim's Shop", "Kangemi", -1.2650, 36.7500),
  legacy("10000000-0000-0000-0000-000000000002", "Kim's Shop", "Kangemi", -1.2651, 36.7501, { created_at: "2026-08-05T10:00:00Z" }),
  legacy("10000000-0000-0000-0000-000000000003", "kim's  shop ", "Kangemi", -1.2650, 36.7500, { created_at: "2026-08-09T10:00:00Z" }),
  // same name, two places ~11 km apart -> ambiguous
  legacy("10000000-0000-0000-0000-000000000004", "Mama Mboga", "Kibera", -1.3100, 36.7800),
  legacy("10000000-0000-0000-0000-000000000005", "Mama Mboga", "Kibera", -1.4100, 36.7800),
  // generic names are never linked
  legacy("10000000-0000-0000-0000-000000000006", "Shop", "Kangemi", -1.2700, 36.7600),
  legacy("10000000-0000-0000-0000-000000000007", "Duka", "Kibera", null, null),
  // name + area only, no coordinates
  legacy("10000000-0000-0000-0000-000000000008", "Blue Door Kiosk", "Pipeline", null, null),
];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read("baseSchema.sql"));
  await db.exec(`insert into auth.users values ('${SUP}'), ('${AUD}'), ('${AUD2}');
    insert into profiles values ('${SUP}','Sam Supervisor','supervisor'), ('${AUD}','Ann Auditor','auditor'), ('${AUD2}','Bob Auditor','auditor');`);
  for (const r of legacyRows) {
    await db.query("insert into audit_submissions (id, user_id, created_at, outlet, products, market) values ($1,$2,$3,$4,$5,$6)",
      [r.id, r.user_id, r.created_at, r.outlet, r.products, r.market]);
  }
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    try { await db.exec(migration(f)); } catch (e) { replayFailures.push(f); }
  }
});

// FINDING: two historical migrations define get_ai_outlet_metrics with a
// correlated subquery PostgreSQL rejects ("subquery uses ungrouped column").
// 20260808 is the hotfix that supersedes them. A fresh database therefore
// cannot replay the history in order; production evidently got the fixed
// function another way. They are left untouched (already applied there);
// this test pins the list so any NEW replay failure is noticed.
const KNOWN_SUPERSEDED = ["20260805000000_outlet_coordinates.sql", "20260807000000_exclude_generic_outlet_names.sql"];
const replayFailures = [];
describe("migration replay on a fresh database", () => {
  it("only the two known-superseded migrations fail; everything else applies", () => {
    expect(replayFailures).toEqual(KNOWN_SUPERSEDED);
  });
});

const q = async (sql, params) => (await db.query(sql, params)).rows;
const asUser = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}', false);`);
  try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','', false);"); }
};

describe("distance helper", () => {
  it("computes a known great-circle distance", async () => {
    const [{ d }] = await q("select haversine_m(0,0,0,1) as d");
    expect(d).toBeGreaterThan(111000);
    expect(d).toBeLessThan(111400);
  });
  it("returns null when a coordinate is missing", async () => {
    const [{ d }] = await q("select haversine_m(null,0,0,1) as d");
    expect(d).toBeNull();
  });
});

describe("conservative outlet backfill", () => {
  it("links same-name audits within the cluster distance to ONE outlet", async () => {
    const rows = await q("select distinct outlet_id from audit_submissions where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003')");
    expect(rows).toHaveLength(1);
    expect(rows[0].outlet_id).not.toBeNull();
    const [o] = await q("select * from outlets where id = $1", [rows[0].outlet_id]);
    expect(o.needs_review).toBe(false);
    expect(o.location_source).toBe("backfill");
    expect(o.normalized_name).toBe("kim's shop");
  });
  it("does NOT link same-name audits that are far apart; sends them to review", async () => {
    const rows = await q("select outlet_id from audit_submissions where id in ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005')");
    expect(rows.every((r) => r.outlet_id === null)).toBe(true);
    const rev = await q("select reason from outlet_backfill_review where shop_name = 'Mama Mboga'");
    expect(rev).toHaveLength(2);
    expect(rev[0].reason).toMatch(/apart/);
  });
  it("never links generic outlet names", async () => {
    const rows = await q("select outlet_id from audit_submissions where id in ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007')");
    expect(rows.every((r) => r.outlet_id === null)).toBe(true);
    expect(await q("select 1 from outlet_backfill_review where shop_name in ('Shop','Duka')")).toHaveLength(2);
  });
  it("links name+area-only groups but flags them for review", async () => {
    const [a] = await q("select outlet_id from audit_submissions where id = '10000000-0000-0000-0000-000000000008'");
    expect(a.outlet_id).not.toBeNull();
    const [o] = await q("select needs_review, review_note, latitude from outlets where id = $1", [a.outlet_id]);
    expect(o.needs_review).toBe(true);
    expect(o.latitude).toBeNull();
    expect(o.review_note).toMatch(/name and area only/);
  });
  it("preserves every original audit and its outlet snapshot", async () => {
    const rows = await q("select id, outlet from audit_submissions order by id");
    expect(rows).toHaveLength(legacyRows.length);
    for (const r of rows) expect(r.outlet).toEqual(legacyRows.find((l) => l.id === r.id).outlet);
  });
  it("marks backfilled audits legacy_unverified, never 'verified'", async () => {
    const rows = await q("select distinct location_status from audit_submissions");
    expect(rows.map((r) => r.location_status)).toEqual(["legacy_unverified"]);
  });
  it("copies the old device capture into captured_* columns", async () => {
    const [r] = await q("select captured_latitude, captured_longitude from audit_submissions where id = '10000000-0000-0000-0000-000000000001'");
    expect(r.captured_latitude).toBeCloseTo(-1.265, 5);
  });
  it("is safe to re-run (no duplicate outlets or review rows)", async () => {
    const before = [(await q("select count(*)::int n from outlets"))[0].n, (await q("select count(*)::int n from outlet_backfill_review"))[0].n];
    await db.exec(migration("20260810000000_normalized_outlets_and_location_verification.sql"));
    const after = [(await q("select count(*)::int n from outlets"))[0].n, (await q("select count(*)::int n from outlet_backfill_review"))[0].n];
    expect(after).toEqual(before);
  });
});

describe("server-side location verification", () => {
  let outletId;
  const insertAudit = async (fields) => {
    const [r] = await q(
      `insert into audit_submissions (user_id, outlet, products, market, outlet_id, captured_latitude, captured_longitude, captured_accuracy_m, registers_outlet_location, location_status)
       values ($1,'{"shop_name":"Test Outlet"}','{}','{"visited":"Yes"}',$2,$3,$4,$5,$6,$7) returning location_status, location_distance_m, location_radius_m, captured_latitude`,
      [AUD, fields.outlet_id ?? outletId, fields.lat ?? null, fields.lon ?? null, fields.acc ?? null, fields.registers ?? false, fields.claimed ?? null]);
    return r;
  };
  beforeAll(async () => {
    const [o] = await q("insert into outlets (name, latitude, longitude, location_source, created_by) values ('Test Outlet', -1.3, 36.8, 'device_capture', $1) returning id", [AUD]);
    outletId = o.id;
  });

  it("verified: reading ~40 m from the outlet", async () => {
    const r = await insertAudit({ lat: -1.30036, lon: 36.8, acc: 10 });
    expect(r.location_status).toBe("verified");
    expect(Number(r.location_distance_m)).toBeGreaterThan(30);
    expect(Number(r.location_radius_m)).toBe(100);
  });
  it("outside_radius: reading ~1 km away, and the captured coordinates are KEPT", async () => {
    const r = await insertAudit({ lat: -1.309, lon: 36.8, acc: 10 });
    expect(r.location_status).toBe("outside_radius");
    expect(r.captured_latitude).toBeCloseTo(-1.309, 5);
  });
  it("low_accuracy: reported accuracy worse than the limit is flagged, not rejected", async () => {
    expect((await insertAudit({ lat: -1.309, lon: 36.8, acc: 400 })).location_status).toBe("low_accuracy");
  });
  it("accuracy is allowed for: 130 m away with 60 m accuracy is still consistent with the radius", async () => {
    expect((await insertAudit({ lat: -1.30117, lon: 36.8, acc: 60 })).location_status).toBe("verified");
  });
  it("unavailable: no device coordinates", async () => {
    expect((await insertAudit({})).location_status).toBe("unavailable");
  });
  it("no_registered_location: the outlet has no coordinates", async () => {
    const [o] = await q("insert into outlets (name, created_by) values ('No Coords', $1) returning id", [AUD]);
    expect((await insertAudit({ outlet_id: o.id, lat: -1.3, lon: 36.8 })).location_status).toBe("no_registered_location");
  });
  it("baseline_set: only when the capture really is the outlet's registered point", async () => {
    expect((await insertAudit({ lat: -1.3, lon: 36.8, registers: true })).location_status).toBe("baseline_set");
    expect((await insertAudit({ lat: -1.309, lon: 36.8, registers: true })).location_status).toBe("outside_radius");
  });
  it("a client cannot claim 'verified': the stored status is recomputed", async () => {
    expect((await insertAudit({ lat: -1.309, lon: 36.8, acc: 5, claimed: "verified" })).location_status).toBe("outside_radius");
  });
  it("the radius is read from app_settings (configurable)", async () => {
    await q("update app_settings set value = jsonb_set(value, '{radius_m}', '2000') where key = 'location_verification'");
    expect((await insertAudit({ lat: -1.309, lon: 36.8, acc: 5 })).location_status).toBe("verified");
    await q("update app_settings set value = jsonb_set(value, '{radius_m}', '100') where key = 'location_verification'");
  });
});

describe("row-level security on the new tables", () => {
  it("an auditor can register a new outlet as themselves", async () => {
    await asUser(AUD, async () => {
      await q("insert into outlets (name, created_by) values ('Auditor Made', $1)", [AUD]);
    });
  });
  it("an auditor cannot register an outlet as someone else", async () => {
    await asUser(AUD, async () => {
      await expect(q("insert into outlets (name, created_by) values ('Spoof', $1)", [SUP])).rejects.toThrow();
    });
  });
  it("an auditor cannot move an outlet's registered location", async () => {
    const [o] = await q("select id from outlets where name = 'Test Outlet'");
    await asUser(AUD, async () => {
      await q("update outlets set latitude = 0, longitude = 0 where id = $1", [o.id]);
    });
    const [after] = await q("select latitude from outlets where id = $1", [o.id]);
    expect(after.latitude).toBeCloseTo(-1.3, 5);
  });
  it("a supervisor can correct an outlet", async () => {
    const [o] = await q("select id from outlets where name = 'Test Outlet'");
    await asUser(SUP, async () => { await q("update outlets set address = 'Corrected' where id = $1", [o.id]); });
    expect((await q("select address from outlets where id = $1", [o.id]))[0].address).toBe("Corrected");
  });
  it("only admins may change settings", async () => {
    await asUser(SUP, async () => { await q("update app_settings set description = 'x' where key = 'location_verification'"); });
    expect((await q("select description from app_settings where key='location_verification'"))[0].description).not.toBe("x");
  });
  it("outlets cannot be deleted (no delete policy)", async () => {
    const [o] = await q("select id from outlets where name = 'Auditor Made'");
    await asUser(SUP, async () => { await q("delete from outlets where id = $1", [o.id]); });
    expect(await q("select 1 from outlets where id = $1", [o.id])).toHaveLength(1);
  });
});

describe("analytics functions return exactly the contracted fields", () => {
  const keysOf = (row) => Object.keys(row).sort();
  const expected = (name) => CONTRACTS[name].map((f) => f.name).sort();

  beforeAll(async () => {
    // fresh, controlled data for deterministic assertions
    await db.exec("truncate audit_submissions cascade; delete from outlets;");
    const [a] = await q("insert into outlets (name, area_name, latitude, longitude, created_by) values ('Alpha','Kangemi',-1.3,36.8,$1) returning id", [AUD]);
    const [b] = await q("insert into outlets (name, area_name, latitude, longitude, created_by) values ('Beta','Kangemi',-1.31,36.81,$1) returning id", [AUD]);
    await q("insert into outlets (name, area_name, created_by) values ('Gamma','Kibera',$1)", [AUD]);
    const ins = (o, uid, ts, products, market, lat, lon) => q(
      "insert into audit_submissions (user_id, created_at, outlet, products, market, outlet_id, captured_latitude, captured_longitude, captured_accuracy_m) values ($1,$2,$3,$4,$5,$6,$7,$8,10)",
      [uid, ts, { shop_name: "x", area_name: "Kangemi", person_met: "J", mobile: "07" }, products, market, o, lat, lon]);
    // Alpha: 3 audits, never promo, visit not confirmed twice, far-away GPS twice
    await ins(a.id, AUD, "2026-11-02T10:00:00Z", { dtt: { k: true } }, { visited: "No", promotion: "No" }, -1.309, 36.8);
    await ins(a.id, AUD, "2026-11-03T10:00:00Z", { dtt: { k: true } }, { visited: "No", promotion: "No" }, -1.309, 36.8);
    await ins(a.id, AUD2, "2026-11-04T10:00:00Z", { dtt: { k: true } }, { visited: "Yes", promotion: "No" }, -1.3, 36.8);
    // Beta: 1 audit with a promotion
    await ins(b.id, AUD2, "2026-11-04T11:00:00Z", { rtd: { k: true } }, { visited: "Yes", promotion: "Yes" }, -1.31, 36.81);
  });

  it("get_ai_overview_metrics: overall + area rows match the contract and the arithmetic", async () => {
    const [{ r }] = await q("select get_ai_overview_metrics('2026-11-01','2026-11-07') as r");
    expect(keysOf(r.overall)).toEqual(expected("overview_overall"));
    expect(r.overall.total_audits).toBe(4);
    expect(r.overall.outlets_audited).toBe(2);
    expect(r.overall.active_outlets).toBe(3);
    expect(r.overall.coverage_pct).toBe(66.7);
    expect(r.overall.promotion_rate_pct).toBe(25);
    expect(r.overall.visits_confirmed_pct).toBe(50);
    expect(r.overall.location_outside_radius).toBe(2);
    const k = r.area_performance.find((x) => x.area === "Kangemi");
    expect(keysOf(k)).toEqual(expected("overview_area"));
    expect(k.coverage_pct).toBe(100);
  });
  it("get_ai_outlet_metrics: grouped by outlet id with the contracted fields", async () => {
    const [{ r }] = await q("select get_ai_outlet_metrics('2026-11-01','2026-11-07') as r");
    expect(r).toHaveLength(3);
    for (const row of r) expect(keysOf(row)).toEqual(expected("outlet_metrics"));
    const alpha = r.find((x) => x.outlet_name === "Alpha");
    expect(alpha.visit_count).toBe(3);
    expect(alpha.visits_unconfirmed).toBe(2);
    expect(alpha.location_outside_radius).toBe(2);
    expect(alpha.ever_had_promotion).toBe(false);
  });
  it("get_ai_auditor_metrics keeps its contracted fields", async () => {
    const [{ r }] = await q("select get_ai_auditor_metrics('2026-11-01','2026-11-07') as r");
    expect(r.length).toBeGreaterThan(0);
    for (const row of r) expect(keysOf(row)).toEqual(expected("auditor_metrics"));
  });
  it("get_ai_distributor_metrics keeps its contracted fields", async () => {
    await q("insert into audit_submissions (user_id, created_at, outlet, market) values ($1,'2026-11-05T10:00:00Z','{\"shop_name\":\"z\",\"area_name\":\"Kangemi\"}', '{\"distributors\":[\"Acme\"]}')", [AUD]);
    const [{ r }] = await q("select get_ai_distributor_metrics('2026-11-01','2026-11-07') as r");
    expect(r).toHaveLength(1);
    expect(keysOf(r[0])).toEqual(expected("distributor_metrics"));
    await q("delete from audit_submissions where market ? 'distributors'");
  });
  it("get_ai_outlet_repeat_issues finds repeated problems at ONE outlet", async () => {
    const [{ r }] = await q("select get_ai_outlet_repeat_issues('2026-11-01','2026-11-07', 2) as r");
    for (const row of r) expect(keysOf(row)).toEqual(expected("repeat_issues"));
    const unconfirmed = r.find((x) => x.outlet_name === "Alpha" && x.issue_type === "visit_not_confirmed");
    expect(unconfirmed.occurrences).toBe(2);
    expect(unconfirmed.total_visits).toBe(3);
    const outside = r.find((x) => x.outlet_name === "Alpha" && x.issue_type === "location_outside_radius");
    expect(outside.occurrences).toBe(2);
    const champ = r.find((x) => x.outlet_name === "Alpha" && x.issue_detail === "champ");
    expect(champ.occurrences).toBe(3);
    expect(r.find((x) => x.outlet_name === "Beta")).toBeUndefined(); // 1 visit < 2
  });
  it("get_ai_cross_dimension: all three dimensions, contracted fields, correct arithmetic", async () => {
    for (const dim of ["area_product", "product_week", "auditor_week"]) {
      const [{ r }] = await q("select get_ai_cross_dimension('2026-11-01','2026-11-07',$1) as r", [dim]);
      expect(r.length).toBeGreaterThan(0);
      for (const row of r) expect(keysOf(row)).toEqual(expected("cross_dimension"));
    }
    const [{ r }] = await q("select get_ai_cross_dimension('2026-11-01','2026-11-07','area_product') as r");
    const cell = r.find((x) => x.row_label === "Kangemi" && x.col_label === "dtt");
    expect(cell.audits).toBe(4);
    expect(cell.hits).toBe(3);
    expect(cell.pct).toBe(75);
  });
  it("get_ai_cross_dimension rejects an unknown dimension", async () => {
    await expect(q("select get_ai_cross_dimension(null,null,'bogus')")).rejects.toThrow(/Unknown dimension/);
  });
});
