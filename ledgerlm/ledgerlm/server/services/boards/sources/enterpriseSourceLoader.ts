import {
  assertBoardSourceAccess,
  getAuthorizedBoardSource,
  type BoardSourceSelection,
} from "../../boardSourceService";
import type { BoardAnalysisRequest } from "../boardRunService";
import { createEnterpriseScopePlan, type BoardScopeQueryPlan } from "./scopeQueryPlanner";
import { getEnterpriseBoardSourceSchema } from "./sourceSchemaService";

export async function prepareEnterpriseBoardSource(params: {
  userId: string;
  selection: BoardSourceSelection;
  config: Record<string, unknown> | null | undefined;
  boardSettings: Record<string, unknown>;
  request: BoardAnalysisRequest;
}): Promise<{
  source: { id: string; name: string; sourceType: "enterprise" };
  schema: ReturnType<typeof getEnterpriseBoardSourceSchema>;
  plan: BoardScopeQueryPlan;
}> {
  if (params.selection.sourceType !== "enterprise") {
    throw new Error("Vault analysis is not available for this Board template yet; select an authorized Enterprise Data source.");
  }
  await assertBoardSourceAccess(params.userId, params.selection);
  const source = await getAuthorizedBoardSource(params.userId, params.selection);
  if (source.sourceType !== "enterprise") throw new Error("The selected Enterprise source is not available");

  const plan = createEnterpriseScopePlan({
    config: params.config,
    request: params.request,
    defaultDimensions: Array.isArray(params.boardSettings.defaultDimensions)
      ? params.boardSettings.defaultDimensions.map(String)
      : undefined,
  });
  return {
    source: { id: source.id, name: source.name, sourceType: "enterprise" },
    schema: getEnterpriseBoardSourceSchema(),
    plan,
  };
}
