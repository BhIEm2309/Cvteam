-- Ejecutar despues de 001_schema.sql en una base de pruebas.
-- No conserva los registros creados por estas verificaciones.
BEGIN;
SET LOCAL search_path = public;

DO $$
DECLARE
    org_a uuid := gen_random_uuid();
    org_b uuid := gen_random_uuid();
    usr uuid := gen_random_uuid();
    member_a uuid := gen_random_uuid();
    member_b uuid := gen_random_uuid();
    area_a uuid := gen_random_uuid();
    person_a uuid := gen_random_uuid();
    person_b uuid := gen_random_uuid();
    position_a uuid := gen_random_uuid();
    responsibility_a uuid := gen_random_uuid();
    skill_a uuid := gen_random_uuid();
    doc_a uuid := gen_random_uuid();
    file_a uuid := gen_random_uuid();
    file_b uuid := gen_random_uuid();
    extraction_a uuid := gen_random_uuid();
    scenario_a uuid := gen_random_uuid();
    scenario_b uuid := gen_random_uuid();
    scenario_position_a uuid := gen_random_uuid();
    evidence_a uuid := gen_random_uuid();
    audit_a uuid := gen_random_uuid();
    n integer;
BEGIN
    SELECT count(*) INTO n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'; -- tabla de control de Prisma, no del dominio
    IF n <> 28 THEN RAISE EXCEPTION 'Se esperaban 28 tablas, hay %', n; END IF;

    INSERT INTO organizations (id, name, slug) VALUES
      (org_a, 'Prueba A', 'prueba-a-' || org_a),
      (org_b, 'Prueba B', 'prueba-b-' || org_b);
    INSERT INTO users (id, auth_subject, email, display_name)
      VALUES (usr, gen_random_uuid(), 'prueba@example.invalid', 'Prueba');
    INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
      (member_a, org_a, usr, 'OWNER'), (member_b, org_b, usr, 'OWNER');
    INSERT INTO departments (id, organization_id, code, name)
      VALUES (area_a, org_a, 'OPS', 'Operaciones');
    INSERT INTO positions (id, organization_id, department_id, code, title)
      VALUES (position_a, org_a, area_a, 'PLAN', 'Planificador');
    INSERT INTO employees (id, organization_id, full_name) VALUES
      (person_a, org_a, 'Persona A'), (person_b, org_b, 'Persona B');

    BEGIN
      INSERT INTO position_assignments (organization_id, employee_id, position_id, start_date)
        VALUES (org_a, person_b, position_a, '2026-01-01');
      RAISE EXCEPTION 'Fallo: se permitio enlazar empresas distintas';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO position_assignments (organization_id, employee_id, position_id, start_date, end_date)
      VALUES (org_a, person_a, position_a, '2026-01-01', '2026-06-01');
    BEGIN
      INSERT INTO position_assignments (organization_id, employee_id, position_id, start_date, end_date)
        VALUES (org_a, person_a, position_a, '2026-05-01', '2026-07-01');
      RAISE EXCEPTION 'Fallo: se permitio un intervalo solapado';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;
    -- Limites adyacentes son validos: el fin es excluido.
    INSERT INTO position_assignments (organization_id, employee_id, position_id, start_date)
      VALUES (org_a, person_a, position_a, '2026-06-01');

    INSERT INTO responsibilities (id, organization_id, code, name)
      VALUES (responsibility_a, org_a, 'MAINT', 'Coordinar mantenimiento');
    INSERT INTO responsibility_assignments
      (organization_id, employee_id, responsibility_id, assignment_role, start_date)
      VALUES (org_a, person_a, responsibility_a, 'ACCOUNTABLE', '2026-01-01');
    BEGIN
      INSERT INTO responsibility_assignments
        (organization_id, employee_id, responsibility_id, assignment_role, start_date)
        VALUES (org_a, person_a, responsibility_a, 'CONTRIBUTOR', '2026-02-01');
      RAISE EXCEPTION 'Fallo: se duplico una funcion vigente';
    EXCEPTION WHEN exclusion_violation THEN NULL;
    END;

    INSERT INTO skills (id, organization_id, code, name, category)
      VALUES (skill_a, org_a, 'SQL', 'SQL', 'TECHNICAL');
    BEGIN
      INSERT INTO employee_skills (organization_id, employee_id, skill_id, verification_status)
        VALUES (org_a, person_a, skill_a, 'VERIFIED');
      RAISE EXCEPTION 'Fallo: se verifico una habilidad sin respaldo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO documents (id, organization_id, title, type)
      VALUES (doc_a, org_a, 'CV sin identificar', 'CV');
    BEGIN
      INSERT INTO documents (organization_id, title, type, position_id)
        VALUES (org_a, 'CV invalido', 'CV', position_a);
      RAISE EXCEPTION 'Fallo: se asocio un CV a un puesto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO document_versions
      (id, organization_id, document_id, version_number, original_name, storage_key,
       mime_type, size_bytes, sha256, upload_status, uploaded_by_member_id, uploaded_at)
      VALUES
      (file_a, org_a, doc_a, 1, 'cv.pdf', 'test/' || file_a, 'application/pdf', 100,
       repeat('a', 64), 'STORED', member_a, CURRENT_TIMESTAMP),
      (file_b, org_a, doc_a, 2, 'cv-v2.pdf', 'test/' || file_b, 'application/pdf', 120,
       repeat('b', 64), 'STORED', member_a, CURRENT_TIMESTAMP);
    BEGIN
      INSERT INTO document_versions
        (organization_id, document_id, version_number, original_name, storage_key,
         mime_type, size_bytes, uploaded_by_member_id)
        VALUES (org_a, doc_a, 2, 'duplicado.pdf', 'test/duplicate-' || doc_a,
                'application/pdf', 100, member_a);
      RAISE EXCEPTION 'Fallo: se duplico el numero de version';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO extraction_runs
      (id, organization_id, document_version_id, idempotency_key, parser_version, output_schema_version)
      VALUES (extraction_a, org_a, file_a, 'extract-' || file_a, 'parser-v1', 'v1');
    BEGIN
      INSERT INTO evidence (organization_id, kind, document_version_id, extraction_run_id, excerpt)
        VALUES (org_a, 'DOCUMENT', file_b, extraction_a, 'Fuente inconsistente');
      RAISE EXCEPTION 'Fallo: la extraccion no coincide con la version citada';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    INSERT INTO evidence (id, organization_id, kind, document_version_id, extraction_run_id, excerpt)
      VALUES (evidence_a, org_a, 'DOCUMENT', file_a, extraction_a, 'Fuente correcta');
    BEGIN
      UPDATE evidence SET excerpt = 'Modificacion' WHERE id = evidence_a;
      RAISE EXCEPTION 'Fallo: se modifico evidencia historica';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    INSERT INTO scenarios
      (id, organization_id, name, baseline_schema_version, baseline_snapshot, baseline_hash, created_by_member_id)
      VALUES (scenario_a, org_a, 'Escenario A', 'v1', '{}', repeat('a',64), member_a),
             (scenario_b, org_a, 'Escenario B', 'v1', '{}', repeat('b',64), member_a);
    INSERT INTO scenario_positions
      (id, organization_id, scenario_id, code, title, target_headcount, criticality, change_type)
      VALUES (scenario_position_a, org_a, scenario_a, 'PLAN', 'Planificador', 1, 'MEDIUM', 'ADDED');
    BEGIN
      INSERT INTO scenario_position_assignments
        (organization_id, scenario_id, scenario_position_id, employee_id, employee_name_snapshot, allocation_percent)
        VALUES (org_a, scenario_b, scenario_position_a, person_a, 'Persona A', 100);
      RAISE EXCEPTION 'Fallo: se enlazaron escenarios distintos';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO audit_events (id, organization_id, actor_member_id, action, entity_type)
      VALUES (audit_a, org_a, member_a, 'TEST', 'TEST');
    BEGIN
      DELETE FROM audit_events WHERE id = audit_a;
      RAISE EXCEPTION 'Fallo: se elimino un evento de auditoria';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE employees SET organization_id = org_b WHERE id = person_a;
      RAISE EXCEPTION 'Fallo: se reasigno la empresa de un registro';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    RAISE NOTICE 'OK: 28 tablas; empresas, intervalos, competencias, documentos, evidencia, escenarios y auditoria verificados.';
END;
$$;

ROLLBACK;
