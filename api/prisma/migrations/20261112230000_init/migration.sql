-- Migracion inicial: esquema completo de Diagnostico Organizacional Inteligente (28 tablas).
-- Origen: DB/001_schema.sql (generado y verificado contra PostgreSQL 17).
-- Incluye lo que schema.prisma no puede expresar: CHECK, EXCLUDE (btree_gist), indices parciales y triggers.
-- No editar una migracion ya aplicada: los cambios van en migraciones nuevas (pnpm db:migrate).

BEGIN;
SET LOCAL search_path = public;
SET LOCAL TIME ZONE 'UTC';

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE member_role AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'VIEWER');
CREATE TYPE membership_status AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE employee_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE responsibility_role AS ENUM ('ACCOUNTABLE', 'CONTRIBUTOR');
CREATE TYPE severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE skill_category AS ENUM ('TECHNICAL', 'BEHAVIORAL');
CREATE TYPE verification_status AS ENUM ('DECLARED', 'VERIFIED', 'REJECTED');
CREATE TYPE document_type AS ENUM ('CV', 'JOB_PROFILE', 'SUPPORTING');
CREATE TYPE upload_status AS ENUM ('PENDING_UPLOAD', 'STORED', 'REJECTED', 'PURGED');
CREATE TYPE run_status AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE observation_source AS ENUM ('MANUAL', 'IMPORT');
CREATE TYPE evidence_kind AS ENUM ('DOCUMENT', 'OBSERVATION', 'MANUAL');
CREATE TYPE finding_type AS ENUM ('UNFILLED_POSITION', 'UNASSIGNED_RESPONSIBILITY', 'AMBIGUOUS_ACCOUNTABILITY', 'SKILL_GAP', 'ESTIMATED_OVERLOAD', 'INSUFFICIENT_DATA');
CREATE TYPE review_status AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');
CREATE TYPE recommendation_origin AS ENUM ('RULE', 'AI', 'HUMAN');
CREATE TYPE recommendation_status AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'APPLIED');
CREATE TYPE scenario_status AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE scenario_change_type AS ENUM ('UNCHANGED', 'ADDED', 'MODIFIED', 'REMOVED');

-- 01. Organization
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name varchar(160) NOT NULL,
    slug varchar(100) NOT NULL,
    legal_name varchar(200),
    industry varchar(100),
    timezone varchar(64) NOT NULL DEFAULT 'America/Santiago',
    archived_at timestamptz(3),
    CONSTRAINT organizations_uq_1 UNIQUE (slug),
    CONSTRAINT organizations_ck_1 CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT organizations_ck_2 CHECK (btrim(name) <> '')
 );

-- 02. User
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    auth_subject uuid NOT NULL,
    email varchar(254) NOT NULL,
    display_name varchar(160) NOT NULL,
    disabled_at timestamptz(3),
    CONSTRAINT users_uq_1 UNIQUE (auth_subject),
    CONSTRAINT users_ck_1 CHECK (email = lower(btrim(email))),
    CONSTRAINT users_ck_2 CHECK (btrim(display_name) <> '')
 );

-- 03. OrganizationMember
CREATE TABLE organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id uuid NOT NULL,
    role member_role NOT NULL DEFAULT 'VIEWER',
    status membership_status NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT organization_members_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT organization_members_uq_1 UNIQUE (organization_id, user_id)
 );

-- 04. Department
CREATE TABLE departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code varchar(40) NOT NULL,
    name varchar(160) NOT NULL,
    description text,
    parent_department_id uuid,
    archived_at timestamptz(3),
    CONSTRAINT departments_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT departments_uq_1 UNIQUE (organization_id, code),
    CONSTRAINT departments_ck_1 CHECK (parent_department_id IS NULL OR parent_department_id <> id)
 );

-- 05. Position
CREATE TABLE positions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code varchar(40) NOT NULL,
    title varchar(160) NOT NULL,
    description text,
    department_id uuid NOT NULL,
    parent_position_id uuid,
    target_headcount integer NOT NULL DEFAULT 1,
    criticality severity NOT NULL DEFAULT 'MEDIUM',
    archived_at timestamptz(3),
    CONSTRAINT positions_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT positions_uq_1 UNIQUE (organization_id, code),
    CONSTRAINT positions_ck_1 CHECK (target_headcount >= 1),
    CONSTRAINT positions_ck_2 CHECK (parent_position_id IS NULL OR parent_position_id <> id)
 );

-- 06. Employee
CREATE TABLE employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employee_code varchar(60),
    full_name varchar(200) NOT NULL,
    email varchar(254),
    weekly_capacity_hours numeric(6,2),
    status employee_status NOT NULL DEFAULT 'ACTIVE',
    archived_at timestamptz(3),
    CONSTRAINT employees_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT employees_uq_1 UNIQUE (organization_id, employee_code),
    CONSTRAINT employees_ck_1 CHECK (weekly_capacity_hours IS NULL OR weekly_capacity_hours > 0)
 );

-- 07. PositionAssignment
CREATE TABLE position_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employee_id uuid NOT NULL,
    position_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    allocation_percent numeric(5,2) NOT NULL DEFAULT 100,
    notes text,
    CONSTRAINT position_assignments_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT position_assignments_ck_1 CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT position_assignments_ck_2 CHECK (allocation_percent > 0 AND allocation_percent <= 100),
    CONSTRAINT position_assignments_no_overlap EXCLUDE USING gist (organization_id WITH =, employee_id WITH =, position_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
 );

-- 08. Responsibility
CREATE TABLE responsibilities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code varchar(60) NOT NULL,
    name varchar(160) NOT NULL,
    description text,
    department_id uuid,
    criticality severity NOT NULL DEFAULT 'MEDIUM',
    archived_at timestamptz(3),
    CONSTRAINT responsibilities_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT responsibilities_uq_1 UNIQUE (organization_id, code)
 );

-- 09. PositionResponsibility
CREATE TABLE position_responsibilities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position_id uuid NOT NULL,
    responsibility_id uuid NOT NULL,
    assignment_role responsibility_role NOT NULL,
    expected_weekly_hours numeric(6,2),
    CONSTRAINT position_responsibilities_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT position_responsibilities_uq_1 UNIQUE (organization_id, position_id, responsibility_id),
    CONSTRAINT position_responsibilities_ck_1 CHECK (expected_weekly_hours IS NULL OR expected_weekly_hours >= 0)
 );

-- 10. ResponsibilityAssignment
CREATE TABLE responsibility_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employee_id uuid NOT NULL,
    responsibility_id uuid NOT NULL,
    assignment_role responsibility_role NOT NULL,
    actual_weekly_hours numeric(6,2),
    start_date date NOT NULL,
    end_date date,
    evidence_id uuid,
    recorded_by_member_id uuid,
    CONSTRAINT responsibility_assignments_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT responsibility_assignments_ck_1 CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT responsibility_assignments_ck_2 CHECK (actual_weekly_hours IS NULL OR actual_weekly_hours >= 0),
    CONSTRAINT responsibility_assignments_no_overlap EXCLUDE USING gist (organization_id WITH =, employee_id WITH =, responsibility_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
 );

-- 11. Skill
CREATE TABLE skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    code varchar(80) NOT NULL,
    name varchar(160) NOT NULL,
    category skill_category NOT NULL,
    description text,
    archived_at timestamptz(3),
    CONSTRAINT skills_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT skills_uq_1 UNIQUE (organization_id, code)
 );

-- 12. PositionSkill
CREATE TABLE position_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    required_level integer,
    is_mandatory boolean NOT NULL DEFAULT true,
    weight numeric(5,2) NOT NULL DEFAULT 1,
    CONSTRAINT position_skills_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT position_skills_uq_1 UNIQUE (organization_id, position_id, skill_id),
    CONSTRAINT position_skills_ck_1 CHECK (required_level IS NULL OR required_level BETWEEN 1 AND 5),
    CONSTRAINT position_skills_ck_2 CHECK (weight > 0)
 );

-- 13. EmployeeSkill
CREATE TABLE employee_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    employee_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    level integer,
    verification_status verification_status NOT NULL DEFAULT 'DECLARED',
    evidence_id uuid,
    verified_by_member_id uuid,
    verified_at timestamptz(3),
    CONSTRAINT employee_skills_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT employee_skills_uq_1 UNIQUE (organization_id, employee_id, skill_id),
    CONSTRAINT employee_skills_ck_1 CHECK (level IS NULL OR level BETWEEN 1 AND 5),
    CONSTRAINT employee_skills_ck_2 CHECK (verification_status <> 'VERIFIED' OR (evidence_id IS NOT NULL AND verified_by_member_id IS NOT NULL AND verified_at IS NOT NULL))
 );

-- 14. Document
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title varchar(200) NOT NULL,
    type document_type NOT NULL,
    employee_id uuid,
    position_id uuid,
    archived_at timestamptz(3),
    CONSTRAINT documents_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT documents_ck_1 CHECK (num_nonnulls(employee_id, position_id) <= 1),
    CONSTRAINT documents_ck_2 CHECK (type <> 'CV' OR position_id IS NULL),
    CONSTRAINT documents_ck_3 CHECK (type <> 'JOB_PROFILE' OR employee_id IS NULL)
 );

-- 15. DocumentVersion
CREATE TABLE document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    original_name varchar(255) NOT NULL,
    storage_key varchar(500) NOT NULL,
    mime_type varchar(100) NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 varchar(64),
    upload_status upload_status NOT NULL DEFAULT 'PENDING_UPLOAD',
    uploaded_by_member_id uuid NOT NULL,
    uploaded_at timestamptz(3),
    purged_at timestamptz(3),
    CONSTRAINT document_versions_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT document_versions_uq_1 UNIQUE (storage_key),
    CONSTRAINT document_versions_uq_2 UNIQUE (organization_id, document_id, version_number),
    CONSTRAINT document_versions_ck_1 CHECK (version_number >= 1),
    CONSTRAINT document_versions_ck_2 CHECK (size_bytes > 0),
    CONSTRAINT document_versions_ck_3 CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT document_versions_ck_4 CHECK (upload_status <> 'STORED' OR (sha256 IS NOT NULL AND uploaded_at IS NOT NULL)),
    CONSTRAINT document_versions_ck_5 CHECK ((upload_status = 'PURGED') = (purged_at IS NOT NULL))
 );

-- 16. ExtractionRun
CREATE TABLE extraction_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    document_version_id uuid NOT NULL,
    status run_status NOT NULL DEFAULT 'QUEUED',
    idempotency_key varchar(160) NOT NULL,
    parser_version varchar(80) NOT NULL,
    provider varchar(80),
    model varchar(120),
    prompt_version varchar(80),
    output_schema_version varchar(40) NOT NULL,
    extracted_text text,
    structured_output jsonb,
    attempt_count integer NOT NULL DEFAULT 0,
    error_code varchar(80),
    error_message text,
    started_at timestamptz(3),
    finished_at timestamptz(3),
    CONSTRAINT extraction_runs_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT extraction_runs_uq_1 UNIQUE (organization_id, idempotency_key),
    CONSTRAINT extraction_runs_uq_2 UNIQUE (organization_id, document_version_id, id),
    CONSTRAINT extraction_runs_ck_1 CHECK (attempt_count >= 0),
    CONSTRAINT extraction_runs_ck_2 CHECK (structured_output IS NULL OR jsonb_typeof(structured_output) = 'object'),
    CONSTRAINT extraction_runs_ck_3 CHECK (status <> 'SUCCEEDED' OR (structured_output IS NOT NULL AND finished_at IS NOT NULL)),
    CONSTRAINT extraction_runs_ck_4 CHECK (status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED') OR finished_at IS NOT NULL),
    CONSTRAINT extraction_runs_ck_5 CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
    CONSTRAINT extraction_runs_ck_6 CHECK (status <> 'RUNNING' OR started_at IS NOT NULL)
 );

-- 17. OperationalObservation
CREATE TABLE operational_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metric_code varchar(80) NOT NULL,
    metric_version varchar(40) NOT NULL,
    department_id uuid,
    position_id uuid,
    employee_id uuid,
    value numeric(18,4) NOT NULL,
    unit varchar(40) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    source_type observation_source NOT NULL,
    source_reference varchar(200),
    idempotency_key varchar(160) NOT NULL,
    recorded_by_member_id uuid,
    notes text,
    supersedes_observation_id uuid,
    CONSTRAINT operational_observations_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT operational_observations_uq_1 UNIQUE (organization_id, idempotency_key),
    CONSTRAINT operational_observations_uq_2 UNIQUE (organization_id, supersedes_observation_id),
    CONSTRAINT operational_observations_ck_1 CHECK (num_nonnulls(department_id, position_id, employee_id) <= 1),
    CONSTRAINT operational_observations_ck_2 CHECK (period_end > period_start),
    CONSTRAINT operational_observations_ck_3 CHECK (supersedes_observation_id IS NULL OR supersedes_observation_id <> id)
 );

-- 18. Evidence
CREATE TABLE evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    kind evidence_kind NOT NULL,
    document_version_id uuid,
    extraction_run_id uuid,
    observation_id uuid,
    page_number integer,
    locator varchar(300),
    excerpt text NOT NULL,
    recorded_by_member_id uuid,
    CONSTRAINT evidence_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT evidence_ck_1 CHECK (page_number IS NULL OR page_number >= 1),
    CONSTRAINT evidence_ck_2 CHECK (btrim(excerpt) <> ''),
    CONSTRAINT evidence_ck_3 CHECK ((kind = 'DOCUMENT' AND document_version_id IS NOT NULL AND observation_id IS NULL) OR (kind = 'OBSERVATION' AND observation_id IS NOT NULL AND document_version_id IS NULL AND extraction_run_id IS NULL AND page_number IS NULL) OR (kind = 'MANUAL' AND document_version_id IS NULL AND extraction_run_id IS NULL AND observation_id IS NULL AND page_number IS NULL AND recorded_by_member_id IS NOT NULL))
 );

-- 19. DiagnosticRun
CREATE TABLE diagnostic_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    department_id uuid,
    status run_status NOT NULL DEFAULT 'QUEUED',
    as_of_date date NOT NULL,
    requested_by_member_id uuid,
    idempotency_key varchar(160) NOT NULL,
    ruleset_version varchar(80) NOT NULL,
    input_schema_version varchar(40) NOT NULL,
    configuration jsonb NOT NULL,
    input_snapshot jsonb,
    input_hash varchar(64),
    summary jsonb,
    attempt_count integer NOT NULL DEFAULT 0,
    error_code varchar(80),
    error_message text,
    started_at timestamptz(3),
    finished_at timestamptz(3),
    CONSTRAINT diagnostic_runs_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT diagnostic_runs_uq_1 UNIQUE (organization_id, idempotency_key),
    CONSTRAINT diagnostic_runs_ck_1 CHECK (attempt_count >= 0),
    CONSTRAINT diagnostic_runs_ck_2 CHECK (jsonb_typeof(configuration) = 'object'),
    CONSTRAINT diagnostic_runs_ck_3 CHECK (input_snapshot IS NULL OR jsonb_typeof(input_snapshot) = 'object'),
    CONSTRAINT diagnostic_runs_ck_4 CHECK (input_hash IS NULL OR input_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT diagnostic_runs_ck_5 CHECK (status <> 'SUCCEEDED' OR (input_snapshot IS NOT NULL AND input_hash IS NOT NULL AND finished_at IS NOT NULL)),
    CONSTRAINT diagnostic_runs_ck_6 CHECK (status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED') OR finished_at IS NOT NULL),
    CONSTRAINT diagnostic_runs_ck_7 CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
    CONSTRAINT diagnostic_runs_ck_8 CHECK (status <> 'RUNNING' OR (started_at IS NOT NULL AND input_snapshot IS NOT NULL AND input_hash IS NOT NULL))
 );

-- 20. Finding
CREATE TABLE findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diagnostic_run_id uuid NOT NULL,
    rule_code varchar(80) NOT NULL,
    fingerprint varchar(160) NOT NULL,
    type finding_type NOT NULL,
    severity severity NOT NULL,
    title varchar(200) NOT NULL,
    description text NOT NULL,
    department_id uuid,
    position_id uuid,
    employee_id uuid,
    responsibility_id uuid,
    skill_id uuid,
    metrics jsonb,
    review_status review_status NOT NULL DEFAULT 'PENDING',
    reviewed_by_member_id uuid,
    reviewed_at timestamptz(3),
    review_notes text,
    CONSTRAINT findings_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT findings_uq_1 UNIQUE (organization_id, diagnostic_run_id, fingerprint),
    CONSTRAINT findings_ck_1 CHECK (review_status = 'PENDING' OR (reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL))
 );

-- 21. FindingEvidence
CREATE TABLE finding_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finding_id uuid NOT NULL,
    evidence_id uuid NOT NULL,
    explanation text,
    CONSTRAINT finding_evidence_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT finding_evidence_uq_1 UNIQUE (organization_id, finding_id, evidence_id)
 );

-- 22. Recommendation
CREATE TABLE recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finding_id uuid NOT NULL,
    title varchar(200) NOT NULL,
    description text NOT NULL,
    origin recommendation_origin NOT NULL,
    generation_metadata jsonb,
    priority severity NOT NULL,
    status recommendation_status NOT NULL DEFAULT 'PROPOSED',
    decided_by_member_id uuid,
    decided_at timestamptz(3),
    decision_notes text,
    CONSTRAINT recommendations_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT recommendations_ck_1 CHECK (status = 'PROPOSED' OR (decided_by_member_id IS NOT NULL AND decided_at IS NOT NULL)),
    CONSTRAINT recommendations_ck_2 CHECK (origin <> 'AI' OR (generation_metadata IS NOT NULL AND jsonb_typeof(generation_metadata) = 'object'))
 );

-- 23. Scenario
CREATE TABLE scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    name varchar(160) NOT NULL,
    description text,
    source_diagnostic_run_id uuid,
    baseline_schema_version varchar(40) NOT NULL,
    baseline_snapshot jsonb NOT NULL,
    baseline_hash varchar(64) NOT NULL,
    revision integer NOT NULL DEFAULT 1,
    status scenario_status NOT NULL DEFAULT 'DRAFT',
    created_by_member_id uuid NOT NULL,
    approved_by_member_id uuid,
    approved_at timestamptz(3),
    archived_at timestamptz(3),
    CONSTRAINT scenarios_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT scenarios_ck_1 CHECK (revision >= 1),
    CONSTRAINT scenarios_ck_2 CHECK (jsonb_typeof(baseline_snapshot) = 'object'),
    CONSTRAINT scenarios_ck_3 CHECK (baseline_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT scenarios_ck_4 CHECK (status <> 'APPROVED' OR (approved_by_member_id IS NOT NULL AND approved_at IS NOT NULL))
 );

-- 24. ScenarioPosition
CREATE TABLE scenario_positions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scenario_id uuid NOT NULL,
    source_position_id uuid,
    department_id uuid,
    department_name_snapshot varchar(160),
    code varchar(40) NOT NULL,
    title varchar(160) NOT NULL,
    description text,
    parent_scenario_position_id uuid,
    target_headcount integer NOT NULL,
    criticality severity NOT NULL,
    change_type scenario_change_type NOT NULL,
    layout jsonb,
    CONSTRAINT scenario_positions_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT scenario_positions_uq_1 UNIQUE (organization_id, scenario_id, code),
    CONSTRAINT scenario_positions_uq_2 UNIQUE (organization_id, scenario_id, id),
    CONSTRAINT scenario_positions_ck_1 CHECK (target_headcount >= 1),
    CONSTRAINT scenario_positions_ck_2 CHECK (parent_scenario_position_id IS NULL OR parent_scenario_position_id <> id),
    CONSTRAINT scenario_positions_ck_3 CHECK (layout IS NULL OR jsonb_typeof(layout) = 'object')
 );

-- 25. ScenarioPositionAssignment
CREATE TABLE scenario_position_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scenario_id uuid NOT NULL,
    scenario_position_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    employee_name_snapshot varchar(200) NOT NULL,
    allocation_percent numeric(5,2) NOT NULL,
    CONSTRAINT scenario_position_assignments_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT scenario_position_assignments_uq_1 UNIQUE (organization_id, scenario_id, scenario_position_id, employee_id),
    CONSTRAINT scenario_position_assignments_ck_1 CHECK (allocation_percent > 0 AND allocation_percent <= 100)
 );

-- 26. ScenarioResponsibility
CREATE TABLE scenario_responsibilities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scenario_id uuid NOT NULL,
    source_responsibility_id uuid,
    scenario_position_id uuid,
    name varchar(160) NOT NULL,
    description text,
    criticality severity NOT NULL,
    assignment_role responsibility_role NOT NULL,
    expected_weekly_hours numeric(6,2),
    change_type scenario_change_type NOT NULL,
    CONSTRAINT scenario_responsibilities_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT scenario_responsibilities_ck_1 CHECK (expected_weekly_hours IS NULL OR expected_weekly_hours >= 0)
 );

-- 27. Alert
CREATE TABLE alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finding_id uuid NOT NULL,
    recipient_member_id uuid NOT NULL,
    read_at timestamptz(3),
    acknowledged_at timestamptz(3),
    CONSTRAINT alerts_org_id_key UNIQUE (organization_id, id),
    CONSTRAINT alerts_uq_1 UNIQUE (organization_id, finding_id, recipient_member_id)
 );

-- 28. AuditEvent
CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_member_id uuid,
    action varchar(100) NOT NULL,
    entity_type varchar(80) NOT NULL,
    entity_id uuid,
    request_id varchar(100),
    changes jsonb,
    metadata jsonb,
    CONSTRAINT audit_events_org_id_key UNIQUE (organization_id, id)
 );

-- Relaciones diferidas hasta crear todas las tablas (incluye referencias a evidencia).
ALTER TABLE organization_members ADD CONSTRAINT organization_members_fk_1 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_fk_2 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE departments ADD CONSTRAINT departments_fk_3 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE departments ADD CONSTRAINT departments_fk_4 FOREIGN KEY (organization_id, parent_department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE positions ADD CONSTRAINT positions_fk_5 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE positions ADD CONSTRAINT positions_fk_6 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE positions ADD CONSTRAINT positions_fk_7 FOREIGN KEY (organization_id, parent_position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employees ADD CONSTRAINT employees_fk_8 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_assignments ADD CONSTRAINT position_assignments_fk_9 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_assignments ADD CONSTRAINT position_assignments_fk_10 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_assignments ADD CONSTRAINT position_assignments_fk_11 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibilities ADD CONSTRAINT responsibilities_fk_12 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibilities ADD CONSTRAINT responsibilities_fk_13 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_responsibilities ADD CONSTRAINT position_responsibilities_fk_14 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_responsibilities ADD CONSTRAINT position_responsibilities_fk_15 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_responsibilities ADD CONSTRAINT position_responsibilities_fk_16 FOREIGN KEY (organization_id, responsibility_id) REFERENCES responsibilities (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibility_assignments ADD CONSTRAINT responsibility_assignments_fk_17 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibility_assignments ADD CONSTRAINT responsibility_assignments_fk_18 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibility_assignments ADD CONSTRAINT responsibility_assignments_fk_19 FOREIGN KEY (organization_id, responsibility_id) REFERENCES responsibilities (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibility_assignments ADD CONSTRAINT responsibility_assignments_fk_20 FOREIGN KEY (organization_id, evidence_id) REFERENCES evidence (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE responsibility_assignments ADD CONSTRAINT responsibility_assignments_fk_21 FOREIGN KEY (organization_id, recorded_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE skills ADD CONSTRAINT skills_fk_22 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_skills ADD CONSTRAINT position_skills_fk_23 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_skills ADD CONSTRAINT position_skills_fk_24 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE position_skills ADD CONSTRAINT position_skills_fk_25 FOREIGN KEY (organization_id, skill_id) REFERENCES skills (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_fk_26 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_fk_27 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_fk_28 FOREIGN KEY (organization_id, skill_id) REFERENCES skills (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_fk_29 FOREIGN KEY (organization_id, evidence_id) REFERENCES evidence (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE employee_skills ADD CONSTRAINT employee_skills_fk_30 FOREIGN KEY (organization_id, verified_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE documents ADD CONSTRAINT documents_fk_31 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE documents ADD CONSTRAINT documents_fk_32 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE documents ADD CONSTRAINT documents_fk_33 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_fk_34 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_fk_35 FOREIGN KEY (organization_id, document_id) REFERENCES documents (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE document_versions ADD CONSTRAINT document_versions_fk_36 FOREIGN KEY (organization_id, uploaded_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE extraction_runs ADD CONSTRAINT extraction_runs_fk_37 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE extraction_runs ADD CONSTRAINT extraction_runs_fk_38 FOREIGN KEY (organization_id, document_version_id) REFERENCES document_versions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_39 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_40 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_41 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_42 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_43 FOREIGN KEY (organization_id, recorded_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE operational_observations ADD CONSTRAINT operational_observations_fk_44 FOREIGN KEY (organization_id, supersedes_observation_id) REFERENCES operational_observations (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE evidence ADD CONSTRAINT evidence_fk_45 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE evidence ADD CONSTRAINT evidence_fk_46 FOREIGN KEY (organization_id, document_version_id) REFERENCES document_versions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE evidence ADD CONSTRAINT evidence_fk_47 FOREIGN KEY (organization_id, observation_id) REFERENCES operational_observations (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE evidence ADD CONSTRAINT evidence_fk_48 FOREIGN KEY (organization_id, recorded_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE diagnostic_runs ADD CONSTRAINT diagnostic_runs_fk_49 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE diagnostic_runs ADD CONSTRAINT diagnostic_runs_fk_50 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE diagnostic_runs ADD CONSTRAINT diagnostic_runs_fk_51 FOREIGN KEY (organization_id, requested_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_52 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_53 FOREIGN KEY (organization_id, diagnostic_run_id) REFERENCES diagnostic_runs (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_54 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_55 FOREIGN KEY (organization_id, position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_56 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_57 FOREIGN KEY (organization_id, responsibility_id) REFERENCES responsibilities (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_58 FOREIGN KEY (organization_id, skill_id) REFERENCES skills (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE findings ADD CONSTRAINT findings_fk_59 FOREIGN KEY (organization_id, reviewed_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE finding_evidence ADD CONSTRAINT finding_evidence_fk_60 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE finding_evidence ADD CONSTRAINT finding_evidence_fk_61 FOREIGN KEY (organization_id, finding_id) REFERENCES findings (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE finding_evidence ADD CONSTRAINT finding_evidence_fk_62 FOREIGN KEY (organization_id, evidence_id) REFERENCES evidence (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_fk_63 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_fk_64 FOREIGN KEY (organization_id, finding_id) REFERENCES findings (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_fk_65 FOREIGN KEY (organization_id, decided_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_fk_66 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_fk_67 FOREIGN KEY (organization_id, source_diagnostic_run_id) REFERENCES diagnostic_runs (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_fk_68 FOREIGN KEY (organization_id, created_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenarios ADD CONSTRAINT scenarios_fk_69 FOREIGN KEY (organization_id, approved_by_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_positions ADD CONSTRAINT scenario_positions_fk_70 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_positions ADD CONSTRAINT scenario_positions_fk_71 FOREIGN KEY (organization_id, scenario_id) REFERENCES scenarios (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_positions ADD CONSTRAINT scenario_positions_fk_72 FOREIGN KEY (organization_id, source_position_id) REFERENCES positions (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_positions ADD CONSTRAINT scenario_positions_fk_73 FOREIGN KEY (organization_id, department_id) REFERENCES departments (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_position_assignments ADD CONSTRAINT scenario_position_assignments_fk_74 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_position_assignments ADD CONSTRAINT scenario_position_assignments_fk_75 FOREIGN KEY (organization_id, scenario_id) REFERENCES scenarios (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_position_assignments ADD CONSTRAINT scenario_position_assignments_fk_76 FOREIGN KEY (organization_id, employee_id) REFERENCES employees (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_responsibilities ADD CONSTRAINT scenario_responsibilities_fk_77 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_responsibilities ADD CONSTRAINT scenario_responsibilities_fk_78 FOREIGN KEY (organization_id, scenario_id) REFERENCES scenarios (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_responsibilities ADD CONSTRAINT scenario_responsibilities_fk_79 FOREIGN KEY (organization_id, source_responsibility_id) REFERENCES responsibilities (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE alerts ADD CONSTRAINT alerts_fk_80 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE alerts ADD CONSTRAINT alerts_fk_81 FOREIGN KEY (organization_id, finding_id) REFERENCES findings (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE alerts ADD CONSTRAINT alerts_fk_82 FOREIGN KEY (organization_id, recipient_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_fk_83 FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_fk_84 FOREIGN KEY (organization_id, actor_member_id) REFERENCES organization_members (organization_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE evidence ADD CONSTRAINT evidence_fk_85 FOREIGN KEY (organization_id, document_version_id, extraction_run_id) REFERENCES extraction_runs (organization_id, document_version_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_positions ADD CONSTRAINT scenario_positions_fk_86 FOREIGN KEY (organization_id, scenario_id, parent_scenario_position_id) REFERENCES scenario_positions (organization_id, scenario_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_position_assignments ADD CONSTRAINT scenario_position_assignments_fk_87 FOREIGN KEY (organization_id, scenario_id, scenario_position_id) REFERENCES scenario_positions (organization_id, scenario_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE scenario_responsibilities ADD CONSTRAINT scenario_responsibilities_fk_88 FOREIGN KEY (organization_id, scenario_id, scenario_position_id) REFERENCES scenario_positions (organization_id, scenario_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMENT ON TABLE organizations IS 'empresa u organización analizada.';
COMMENT ON TABLE users IS 'cuenta de una persona que utiliza la aplicación.';
COMMENT ON TABLE organization_members IS 'pertenencia y rol de un usuario dentro de una empresa.';
COMMENT ON TABLE departments IS 'área, unidad, faena o departamento.';
COMMENT ON TABLE positions IS 'puesto organizacional esperado.';
COMMENT ON TABLE employees IS 'trabajador de la empresa, con o sin acceso a la aplicación.';
COMMENT ON TABLE position_assignments IS 'ocupación de un puesto por una persona durante un intervalo.';
COMMENT ON TABLE responsibilities IS 'función o responsabilidad de la organización.';
COMMENT ON TABLE position_responsibilities IS 'función que formalmente corresponde a un puesto.';
COMMENT ON TABLE responsibility_assignments IS 'función que una persona realiza efectivamente.';
COMMENT ON TABLE skills IS 'competencia normalizada dentro de una empresa.';
COMMENT ON TABLE position_skills IS 'competencia exigida por un puesto.';
COMMENT ON TABLE employee_skills IS 'competencia registrada para una persona.';
COMMENT ON TABLE documents IS 'documento lógico, independiente de sus archivos/versiones.';
COMMENT ON TABLE document_versions IS 'archivo de una versión concreta.';
COMMENT ON TABLE extraction_runs IS 'ejecución lógica de extracción para una versión.';
COMMENT ON TABLE operational_observations IS 'dato operativo importado o declarado para un período.';
COMMENT ON TABLE evidence IS 'fuente concreta e identificable que respalda un dato o hallazgo.';
COMMENT ON TABLE diagnostic_runs IS 'diagnóstico ejecutado con entradas y reglas concretas.';
COMMENT ON TABLE findings IS 'hallazgo obtenido en un diagnóstico.';
COMMENT ON TABLE finding_evidence IS 'relación muchos-a-muchos entre hallazgo y sus fuentes.';
COMMENT ON TABLE recommendations IS 'acción sugerida para un hallazgo.';
COMMENT ON TABLE scenarios IS 'propuesta editable aislada de la estructura real.';
COMMENT ON TABLE scenario_positions IS 'puesto dentro de una propuesta.';
COMMENT ON TABLE scenario_position_assignments IS 'persona propuesta para un puesto de un escenario.';
COMMENT ON TABLE scenario_responsibilities IS 'función propuesta y su destino dentro del escenario.';
COMMENT ON TABLE alerts IS 'alerta de un hallazgo para un destinatario.';
COMMENT ON TABLE audit_events IS 'registro de una acción relevante.';

CREATE INDEX organization_members_fk_idx_2 ON organization_members (user_id);
CREATE INDEX departments_fk_idx_4 ON departments (organization_id, parent_department_id);
CREATE INDEX positions_fk_idx_6 ON positions (organization_id, department_id);
CREATE INDEX positions_fk_idx_7 ON positions (organization_id, parent_position_id);
CREATE INDEX position_assignments_fk_idx_10 ON position_assignments (organization_id, employee_id);
CREATE INDEX position_assignments_fk_idx_11 ON position_assignments (organization_id, position_id);
CREATE INDEX responsibilities_fk_idx_13 ON responsibilities (organization_id, department_id);
CREATE INDEX position_responsibilities_fk_idx_16 ON position_responsibilities (organization_id, responsibility_id);
CREATE INDEX responsibility_assignments_fk_idx_18 ON responsibility_assignments (organization_id, employee_id);
CREATE INDEX responsibility_assignments_fk_idx_19 ON responsibility_assignments (organization_id, responsibility_id);
CREATE INDEX responsibility_assignments_fk_idx_20 ON responsibility_assignments (organization_id, evidence_id);
CREATE INDEX responsibility_assignments_fk_idx_21 ON responsibility_assignments (organization_id, recorded_by_member_id);
CREATE INDEX position_skills_fk_idx_25 ON position_skills (organization_id, skill_id);
CREATE INDEX employee_skills_fk_idx_28 ON employee_skills (organization_id, skill_id);
CREATE INDEX employee_skills_fk_idx_29 ON employee_skills (organization_id, evidence_id);
CREATE INDEX employee_skills_fk_idx_30 ON employee_skills (organization_id, verified_by_member_id);
CREATE INDEX documents_fk_idx_32 ON documents (organization_id, employee_id);
CREATE INDEX documents_fk_idx_33 ON documents (organization_id, position_id);
CREATE INDEX document_versions_fk_idx_36 ON document_versions (organization_id, uploaded_by_member_id);
CREATE INDEX operational_observations_fk_idx_40 ON operational_observations (organization_id, department_id);
CREATE INDEX operational_observations_fk_idx_41 ON operational_observations (organization_id, position_id);
CREATE INDEX operational_observations_fk_idx_42 ON operational_observations (organization_id, employee_id);
CREATE INDEX operational_observations_fk_idx_43 ON operational_observations (organization_id, recorded_by_member_id);
CREATE INDEX evidence_fk_idx_46 ON evidence (organization_id, document_version_id);
CREATE INDEX evidence_fk_idx_47 ON evidence (organization_id, observation_id);
CREATE INDEX evidence_fk_idx_48 ON evidence (organization_id, recorded_by_member_id);
CREATE INDEX evidence_fk_idx_85 ON evidence (organization_id, document_version_id, extraction_run_id);
CREATE INDEX diagnostic_runs_fk_idx_50 ON diagnostic_runs (organization_id, department_id);
CREATE INDEX diagnostic_runs_fk_idx_51 ON diagnostic_runs (organization_id, requested_by_member_id);
CREATE INDEX findings_fk_idx_54 ON findings (organization_id, department_id);
CREATE INDEX findings_fk_idx_55 ON findings (organization_id, position_id);
CREATE INDEX findings_fk_idx_56 ON findings (organization_id, employee_id);
CREATE INDEX findings_fk_idx_57 ON findings (organization_id, responsibility_id);
CREATE INDEX findings_fk_idx_58 ON findings (organization_id, skill_id);
CREATE INDEX findings_fk_idx_59 ON findings (organization_id, reviewed_by_member_id);
CREATE INDEX finding_evidence_fk_idx_62 ON finding_evidence (organization_id, evidence_id);
CREATE INDEX recommendations_fk_idx_64 ON recommendations (organization_id, finding_id);
CREATE INDEX recommendations_fk_idx_65 ON recommendations (organization_id, decided_by_member_id);
CREATE INDEX scenarios_fk_idx_67 ON scenarios (organization_id, source_diagnostic_run_id);
CREATE INDEX scenarios_fk_idx_68 ON scenarios (organization_id, created_by_member_id);
CREATE INDEX scenarios_fk_idx_69 ON scenarios (organization_id, approved_by_member_id);
CREATE INDEX scenario_positions_fk_idx_72 ON scenario_positions (organization_id, source_position_id);
CREATE INDEX scenario_positions_fk_idx_73 ON scenario_positions (organization_id, department_id);
CREATE INDEX scenario_positions_fk_idx_86 ON scenario_positions (organization_id, scenario_id, parent_scenario_position_id);
CREATE INDEX scenario_position_assignments_fk_idx_76 ON scenario_position_assignments (organization_id, employee_id);
CREATE INDEX scenario_responsibilities_fk_idx_78 ON scenario_responsibilities (organization_id, scenario_id);
CREATE INDEX scenario_responsibilities_fk_idx_79 ON scenario_responsibilities (organization_id, source_responsibility_id);
CREATE INDEX scenario_responsibilities_fk_idx_88 ON scenario_responsibilities (organization_id, scenario_id, scenario_position_id);
CREATE INDEX alerts_fk_idx_82 ON alerts (organization_id, recipient_member_id);
CREATE INDEX audit_events_fk_idx_84 ON audit_events (organization_id, actor_member_id);

-- Indices parciales de escenarios.
CREATE UNIQUE INDEX scenario_positions_source_uq ON scenario_positions (organization_id, scenario_id, source_position_id) WHERE source_position_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_responsibilities_assigned_uq ON scenario_responsibilities (organization_id, scenario_id, source_responsibility_id, scenario_position_id) WHERE source_responsibility_id IS NOT NULL AND scenario_position_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_responsibilities_unassigned_uq ON scenario_responsibilities (organization_id, scenario_id, source_responsibility_id) WHERE source_responsibility_id IS NOT NULL AND scenario_position_id IS NULL;

-- Indices de acceso frecuentes.
CREATE INDEX organization_members_user_status_idx ON organization_members (user_id, status);
CREATE INDEX positions_department_active_idx ON positions (organization_id, department_id, archived_at);
CREATE INDEX employees_directory_idx ON employees (organization_id, status, full_name);
CREATE INDEX position_assignments_employee_date_idx ON position_assignments (organization_id, employee_id, start_date);
CREATE INDEX position_assignments_position_date_idx ON position_assignments (organization_id, position_id, start_date);
CREATE INDEX responsibility_assignments_employee_date_idx ON responsibility_assignments (organization_id, employee_id, start_date);
CREATE INDEX responsibility_assignments_function_date_idx ON responsibility_assignments (organization_id, responsibility_id, start_date);
CREATE INDEX documents_list_idx ON documents (organization_id, created_at DESC, id DESC);
CREATE INDEX document_versions_hash_idx ON document_versions (organization_id, sha256);
CREATE INDEX extraction_runs_history_idx ON extraction_runs (organization_id, document_version_id, created_at DESC);
CREATE INDEX extraction_runs_queue_idx ON extraction_runs (status, created_at);
CREATE INDEX observations_metric_period_idx ON operational_observations (organization_id, metric_code, period_start, period_end);
CREATE INDEX diagnostic_runs_history_idx ON diagnostic_runs (organization_id, created_at DESC, id DESC);
CREATE INDEX diagnostic_runs_queue_idx ON diagnostic_runs (status, created_at);
CREATE INDEX findings_filter_idx ON findings (organization_id, diagnostic_run_id, severity, review_status);
CREATE INDEX recommendations_status_idx ON recommendations (organization_id, finding_id, status);
CREATE INDEX scenarios_list_idx ON scenarios (organization_id, status, updated_at DESC);
CREATE INDEX audit_events_history_idx ON audit_events (organization_id, created_at DESC, id DESC);
CREATE INDEX audit_events_entity_idx ON audit_events (organization_id, entity_type, entity_id, created_at);
CREATE INDEX alerts_unread_idx ON alerts (organization_id, recipient_member_id, created_at DESC) WHERE read_at IS NULL;

-- updated_at se mantiene tambien para escrituras SQL fuera del ORM.
CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

-- El id y la empresa de una fila no se reasignan despues de crearla.
CREATE FUNCTION protect_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'La identidad y fecha de creacion de % son inmutables', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF (to_jsonb(NEW)->'organization_id') IS DISTINCT FROM (to_jsonb(OLD)->'organization_id') THEN
        RAISE EXCEPTION 'No se puede cambiar la organizacion de %', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

-- Estas tablas conservan sus registros originales. La retencion requiere mantenimiento explicito.
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% es append-only: no se permite %', TG_TABLE_NAME, TG_OP USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER organizations_identity BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER users_identity BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER organization_members_identity BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER departments_identity BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER positions_identity BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER employees_identity BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER position_assignments_identity BEFORE UPDATE ON position_assignments FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER position_assignments_updated_at BEFORE UPDATE ON position_assignments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER responsibilities_identity BEFORE UPDATE ON responsibilities FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER responsibilities_updated_at BEFORE UPDATE ON responsibilities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER position_responsibilities_identity BEFORE UPDATE ON position_responsibilities FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER position_responsibilities_updated_at BEFORE UPDATE ON position_responsibilities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER responsibility_assignments_identity BEFORE UPDATE ON responsibility_assignments FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER responsibility_assignments_updated_at BEFORE UPDATE ON responsibility_assignments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER skills_identity BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER skills_updated_at BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER position_skills_identity BEFORE UPDATE ON position_skills FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER position_skills_updated_at BEFORE UPDATE ON position_skills FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER employee_skills_identity BEFORE UPDATE ON employee_skills FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER employee_skills_updated_at BEFORE UPDATE ON employee_skills FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER documents_identity BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER document_versions_identity BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER document_versions_updated_at BEFORE UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER extraction_runs_identity BEFORE UPDATE ON extraction_runs FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER extraction_runs_updated_at BEFORE UPDATE ON extraction_runs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER operational_observations_immutable BEFORE UPDATE OR DELETE ON operational_observations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER diagnostic_runs_identity BEFORE UPDATE ON diagnostic_runs FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER diagnostic_runs_updated_at BEFORE UPDATE ON diagnostic_runs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER findings_identity BEFORE UPDATE ON findings FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER findings_updated_at BEFORE UPDATE ON findings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER finding_evidence_immutable BEFORE UPDATE OR DELETE ON finding_evidence FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER recommendations_identity BEFORE UPDATE ON recommendations FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER recommendations_updated_at BEFORE UPDATE ON recommendations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER scenarios_identity BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER scenarios_updated_at BEFORE UPDATE ON scenarios FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER scenario_positions_identity BEFORE UPDATE ON scenario_positions FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER scenario_positions_updated_at BEFORE UPDATE ON scenario_positions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER scenario_position_assignments_identity BEFORE UPDATE ON scenario_position_assignments FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER scenario_position_assignments_updated_at BEFORE UPDATE ON scenario_position_assignments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER scenario_responsibilities_identity BEFORE UPDATE ON scenario_responsibilities FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER scenario_responsibilities_updated_at BEFORE UPDATE ON scenario_responsibilities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER alerts_identity BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION protect_identity();
CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- Las reglas de autorizacion, ciclos de arboles, publicacion y aprobacion se detallan en README.md.
COMMIT;
