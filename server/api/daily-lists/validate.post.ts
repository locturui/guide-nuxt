import { requireAuth } from "~/server/utils/auth";
import {
  buildPreview,
  parseDailyJsonData,
  processGroupForPreview,
  validateDailyGroupAgeRules,
} from "~/server/utils/daily-lists";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event);

  const { groups, errors: parseErrors } = parseDailyJsonData(body);
  parseErrors.push(...validateDailyGroupAgeRules(groups));

  const sheetPreviews = await Promise.all(groups.map(g => processGroupForPreview(g, auth.userId)));
  return buildPreview(groups, parseErrors, sheetPreviews);
});
