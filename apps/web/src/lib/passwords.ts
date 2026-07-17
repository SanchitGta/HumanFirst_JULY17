import bcrypt from "bcryptjs";

const COST_FACTOR = 12;

export async function hashPassword(raw: string): Promise<string> {
  return bcrypt.hash(raw, COST_FACTOR);
}

export async function verifyPassword(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}
