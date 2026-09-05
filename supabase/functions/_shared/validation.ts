import { ApiError, assertOnlyKeys } from "./http.ts";

const EMAIL_LOCAL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/u;

export interface MemberInvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  nationalId: string | null;
  address: string | null;
  planId: string | null;
  amountPaid: number | null;
  agreedPrice: number | null;
  priceNote: string | null;
  paymentMethod: "upi" | "cash" | "card" | "wallet" | "complimentary" | null;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NATIONAL_ID_PATTERN = /^[0-9][0-9 ]{2,62}[0-9]$/;
const PAYMENT_METHODS = ["upi", "cash", "card", "wallet", "complimentary"] as const;

function normalizedText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a string.`);
  }

  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const length = [...normalized].length;
  if (length === 0 || length > maxLength || CONTROL_PATTERN.test(normalized)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} is invalid.`);
  }

  return normalized;
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "email must be a string.");
  }

  const email = value.normalize("NFKC").trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !/^[\x21-\x7e]+$/.test(email)) {
    throw new ApiError(400, "VALIDATION_ERROR", "email is invalid.");
  }

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== email.indexOf("@")) {
    throw new ApiError(400, "VALIDATION_ERROR", "email is invalid.");
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const labels = domain.split(".");
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !EMAIL_LOCAL_PATTERN.test(local) ||
    domain.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))
  ) {
    throw new ApiError(400, "VALIDATION_ERROR", "email is invalid.");
  }

  return email;
}

function normalizePhone(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "phone must be a string or null.");
  }

  const candidate = value.normalize("NFKC").trim();
  if (!/^\+[0-9 ()-]+$/.test(candidate)) {
    throw new ApiError(400, "VALIDATION_ERROR", "phone must use international format.");
  }

  const phone = `+${candidate.slice(1).replace(/[^0-9]/g, "")}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    throw new ApiError(400, "VALIDATION_ERROR", "phone must use international format.");
  }

  return phone;
}

function normalizeOptionalText(value: unknown, fieldName: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizedText(value, fieldName, maxLength);
  return normalized;
}

function normalizeIsoDate(value: unknown, fieldName: string, allowFuture: boolean): string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be an ISO date (YYYY-MM-DD).`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a real calendar date.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (!allowFuture && value > today) {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} cannot be in the future.`);
  }
  return value;
}

function normalizeOptionalIsoDate(value: unknown, fieldName: string, allowFuture: boolean): string | null {
  if (value === undefined || value === null || value === "") return null;
  return normalizeIsoDate(value, fieldName, allowFuture);
}

function normalizeNationalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "nationalId must be a string or null.");
  }
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!NATIONAL_ID_PATTERN.test(normalized) || normalized.replace(/\D/g, "").length < 4) {
    throw new ApiError(400, "VALIDATION_ERROR", "nationalId must be 4 to 64 digits.");
  }
  return normalized;
}

function normalizeAmountPaid(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10_000_000) {
    throw new ApiError(400, "VALIDATION_ERROR", "amountPaid must be a positive number.");
  }
  // Floating-point multiplication is inexact (19.99 * 100 is
  // 1998.9999999999998); compare within an epsilon instead of exactly.
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    throw new ApiError(400, "VALIDATION_ERROR", "amountPaid must not exceed two decimal places.");
  }
  return value;
}

function normalizePaymentMethod(value: unknown): MemberInvitationInput["paymentMethod"] {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !PAYMENT_METHODS.includes(value as (typeof PAYMENT_METHODS)[number])) {
    throw new ApiError(400, "VALIDATION_ERROR", "paymentMethod is invalid.");
  }
  return value as MemberInvitationInput["paymentMethod"];
}

export function parseMemberInvitationInput(body: Record<string, unknown>): MemberInvitationInput {
  assertOnlyKeys(body, [
    "email",
    "firstName",
    "lastName",
    "phone",
    "dateOfBirth",
    "emergencyName",
    "emergencyPhone",
    "nationalId",
    "address",
    "planId",
    // Accepted (as null) for older clients that always send the field;
    // non-null values are rejected below.
    "membershipStartDate",
    "amountPaid",
    "paymentMethod",
    "agreedPrice",
    "priceNote",
  ]);
  // Start dates are server-controlled; reject clients that still send one.
  if (body.membershipStartDate !== undefined && body.membershipStartDate !== null && body.membershipStartDate !== "") {
    throw new ApiError(400, "VALIDATION_ERROR", "Membership start dates are server-controlled.");
  }
  return {
    email: normalizeEmail(body.email),
    firstName: normalizedText(body.firstName, "firstName", 80),
    lastName: normalizedText(body.lastName, "lastName", 80),
    phone: normalizePhone(body.phone),
    dateOfBirth: normalizeOptionalIsoDate(body.dateOfBirth, "dateOfBirth", false),
    emergencyName: normalizeOptionalText(body.emergencyName, "emergencyName", 160),
    emergencyPhone: normalizePhone(body.emergencyPhone),
    nationalId: normalizeNationalId(body.nationalId),
    address: normalizeOptionalText(body.address, "address", 500),
    planId: body.planId === undefined || body.planId === null || body.planId === ""
      ? null
      : (isUuid(body.planId) ? body.planId : throwInvalidPlanId()),
    amountPaid: normalizeAmountPaid(body.amountPaid),
    agreedPrice: body.agreedPrice == null ? null : normalizeAmountPaid(body.agreedPrice),
    priceNote: normalizeOptionalText(body.priceNote, 'priceNote', 240),
    paymentMethod: normalizePaymentMethod(body.paymentMethod),
  };
}

function throwInvalidPlanId(): never {
  throw new ApiError(400, "VALIDATION_ERROR", "planId must be a valid UUID.");
}

export function parseInvitationId(body: Record<string, unknown>): string {
  assertOnlyKeys(body, ["invitationId"]);
  if (typeof body.invitationId !== "string" || !UUID_PATTERN.test(body.invitationId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "invitationId must be a valid UUID.");
  }

  return body.invitationId.toLowerCase();
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
