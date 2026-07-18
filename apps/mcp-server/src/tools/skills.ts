import { z } from "zod";
import { prisma } from "@humanfirst/db";
import type { Principal } from "../context.js";
import { ToolError } from "../toolError.js";
import { withToolGuard } from "./guard.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const SKILL_FIELDS = {
  id: true,
  name: true,
  expansionType: true,
  promptText: true,
  audience: true,
  writingStyle: true,
  temperature: true,
  outputFormat: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const getSkillShape = {
  skillId: z.string(),
};
const getSkillSchema = z.object(getSkillShape);

async function getSkillHandler(args: z.infer<typeof getSkillSchema>, principal: Principal) {
  const skill = await prisma.skill.findUnique({ where: { id: args.skillId } });
  if (!skill) {
    throw new ToolError("NOT_FOUND", "Skill not found");
  }
  if (skill.ownerId !== principal.userId) {
    throw new ToolError("FORBIDDEN", "Skill is not owned by this PAT's user");
  }

  const data = Object.fromEntries(
    Object.keys(SKILL_FIELDS).map((key) => [key, (skill as Record<string, unknown>)[key]]),
  );
  return { data, articleId: null };
}

export const getSkill = withToolGuard("get_skill", getSkillHandler);

export const listSkillsShape = {
  limit: z.number().int().positive().optional(),
};
const listSkillsSchema = z.object(listSkillsShape);

async function listSkillsHandler(args: z.infer<typeof listSkillsSchema>, principal: Principal) {
  const skills = await prisma.skill.findMany({
    where: { ownerId: principal.userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: SKILL_FIELDS,
  });
  return { data: skills, articleId: null };
}

export const listSkills = withToolGuard("list_skills", listSkillsHandler);
