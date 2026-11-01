-- Seed the channels we sync from.
INSERT INTO "channels" ("id", "name") VALUES ('rrr', 'RRR') ON CONFLICT DO NOTHING;
