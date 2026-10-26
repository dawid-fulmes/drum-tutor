-- Existing rows get the empty v1 signature; new rows must supply one (ADR-0050, spec §5).
-- Published lessons among them have no notes until reseeded, which ADR-0053 forbids (MVP data is disposable, ADR-0004).
ALTER TABLE "lessons" ADD COLUMN "signature" jsonb DEFAULT '{"version":"v1","slots":[{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""},{"instruments":[],"comment":""}]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "signature" DROP DEFAULT;
