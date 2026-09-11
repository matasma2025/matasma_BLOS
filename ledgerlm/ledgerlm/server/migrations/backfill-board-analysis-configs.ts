import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Give legacy Boards a durable generic configuration without changing their
 * existing settings or report rows. The insert is intentionally idempotent.
 */
export async function backfillBoardAnalysisConfigs(): Promise<void> {
  await db.execute(sql`
    INSERT INTO board_analysis_configs (
      board_id, template_key, system_prompt, analysis_prompt, source_type,
      source_config, scope_mode, key_columns, comparison_basis
    )
    SELECT
      b.id,
      COALESCE(bt.slug, b.analysis_template, 'variance-analysis'),
      CASE WHEN jsonb_typeof(COALESCE(b.settings, '{}'::jsonb)->'analysisPrompts') = 'string'
        THEN b.settings->>'analysisPrompts' ELSE NULL END,
      CASE WHEN jsonb_typeof(COALESCE(b.settings, '{}'::jsonb)->'userPromptTemplate') = 'string'
        THEN b.settings->>'userPromptTemplate' ELSE NULL END,
      CASE WHEN NULLIF(b.settings->>'documentId', '') IS NOT NULL THEN 'vault' ELSE 'enterprise' END,
      CASE
        WHEN NULLIF(b.settings->>'documentId', '') IS NOT NULL
          THEN jsonb_build_object('sourceType', 'vault', 'documentId', b.settings->>'documentId')
        WHEN NULLIF(b.settings->>'cubeId', '') IS NOT NULL
          THEN jsonb_build_object('sourceType', 'enterprise', 'cubeId', b.settings->>'cubeId')
        ELSE '{}'::jsonb
      END,
      'all',
      COALESCE(b.settings->'defaultDimensions', '[]'::jsonb),
      '{}'
    FROM boards b
    LEFT JOIN board_templates bt ON bt.id = b.template_id
    WHERE NOT EXISTS (
      SELECT 1 FROM board_analysis_configs c WHERE c.board_id = b.id
    )
  `);
  console.log("✅ legacy Board analysis configurations backfilled");
}