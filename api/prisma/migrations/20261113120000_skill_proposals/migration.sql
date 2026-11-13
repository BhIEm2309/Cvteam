-- Propuestas de competencias generadas por la IA a partir de un CV (Paso 5).
-- Generada sin base de datos con: prisma migrate diff --from-schema-datamodel (esquema anterior) --to-schema-datamodel prisma/schema.prisma --script
-- Se agregaron a mano los CHECK y los triggers que Prisma no expresa (mismo estilo que 20261112230000_init).
-- CreateTable
CREATE TABLE "skill_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraction_run_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" "skill_category" NOT NULL,
    "level" INTEGER,
    "excerpt" TEXT NOT NULL,
    "review_status" "review_status" NOT NULL DEFAULT 'PENDING',
    "employee_id" UUID,
    "skill_id" UUID,
    "reviewed_by_member_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "skill_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_proposals_review_idx" ON "skill_proposals"("organization_id", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "skill_proposals_fk_idx_93" ON "skill_proposals"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "skill_proposals_fk_idx_94" ON "skill_proposals"("organization_id", "skill_id");

-- CreateIndex
CREATE INDEX "skill_proposals_fk_idx_95" ON "skill_proposals"("organization_id", "reviewed_by_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_proposals_org_id_key" ON "skill_proposals"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_proposals_uq_1" ON "skill_proposals"("organization_id", "extraction_run_id", "name");

-- AddForeignKey
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_fk_91" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_fk_92" FOREIGN KEY ("organization_id", "extraction_run_id") REFERENCES "extraction_runs"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_fk_93" FOREIGN KEY ("organization_id", "employee_id") REFERENCES "employees"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_fk_94" FOREIGN KEY ("organization_id", "skill_id") REFERENCES "skills"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_fk_95" FOREIGN KEY ("organization_id", "reviewed_by_member_id") REFERENCES "organization_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Reglas que Prisma no expresa en schema.prisma.
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_ck_1" CHECK (level IS NULL OR level BETWEEN 1 AND 5);
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_ck_2" CHECK (length(btrim(name)) > 0 AND length(btrim(excerpt)) > 0);
-- Una propuesta revisada (confirmada o descartada) guarda quién y cuándo la revisó.
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_ck_3" CHECK (review_status = 'PENDING' OR (reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL));
-- Una propuesta confirmada indica a qué persona y a qué competencia del catálogo corresponde.
ALTER TABLE "skill_proposals" ADD CONSTRAINT "skill_proposals_ck_4" CHECK (review_status <> 'CONFIRMED' OR (employee_id IS NOT NULL AND skill_id IS NOT NULL));

COMMENT ON TABLE "skill_proposals" IS 'competencia propuesta por la IA, pendiente de revisión humana.';

CREATE TRIGGER skill_proposals_identity BEFORE UPDATE ON skill_proposals FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER skill_proposals_updated_at BEFORE UPDATE ON skill_proposals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
