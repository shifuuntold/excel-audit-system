-- Assignments are area-based, not outlet-based
-- ---------------------------------------------------------------------
-- Correction from the original design: a Supervisor assigns a whole area
-- to an auditor ("cover Kwa Maiko this week"), not individual outlets one
-- at a time. outlet_name becomes optional — nullable, kept only in case a
-- specific-outlet assignment is ever needed again later — while area
-- becomes the required field an assignment actually centers on.
-- ---------------------------------------------------------------------

alter table outlet_assignments
    alter column outlet_name drop not null;

alter table outlet_assignments
    alter column area set not null;

comment on column outlet_assignments.outlet_name is
    'Optional — assignments are area-based. Only set for the rare case of assigning one specific outlet rather than a whole area.';
comment on column outlet_assignments.area is
    'The assigned territory. This is the primary thing an assignment represents.';
