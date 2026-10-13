import { db } from "../db";
import { sql } from "drizzle-orm";

/** Additive only: never alter existing Boards, templates, or report records. */
export async function createDomainBoardTemplateOverrides(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS domain_board_template_overrides (
      domain_id VARCHAR NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      template_slug VARCHAR(100) NOT NULL,
      report_template TEXT NOT NULL DEFAULT '',
      report_template_pptx_base64 TEXT,
      file_name TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ,
      PRIMARY KEY (domain_id, template_slug),
      CONSTRAINT domain_board_template_overrides_slug_check
        CHECK (template_slug IN ('kpi-metrics', 'balance-sheet-tracker', 'entity-pnl'))
    )
  `);
  console.log("Bosch master template storage ready");
}
