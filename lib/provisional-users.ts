/** Comptes provisoires Gabon — POC Moov Assist */

export type ProvisionalUser = {
  id: string;
  displayName: string;
  phone: string;
  phoneE164: string;
  locale: string;
  initials: string;
};

export const PROVISIONAL_USERS: Record<string, ProvisionalUser> = {
  "06123456": {
    id: "user-jean-direl",
    displayName: "Jean Direl",
    phone: "06123456",
    phoneE164: "+24106123456",
    locale: "fr",
    initials: "JD",
  },
  "06123457": {
    id: "user-christian-beyeme",
    displayName: "Christian BEYEME",
    phone: "06123457",
    phoneE164: "+24106123457",
    locale: "fr",
    initials: "CB",
  },
  "06123458": {
    id: "user-xavier-ondo",
    displayName: "Xavier Ondo",
    phone: "06123458",
    phoneE164: "+24106123458",
    locale: "fr",
    initials: "XO",
  },
};

export const DEMO_OTP = "123456";

export function normalizeGabonPhone(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("241") && digits.length >= 11) digits = digits.slice(3);
  if (digits.length === 8 && "1234567".includes(digits[0])) digits = `0${digits}`;
  return digits;
}

export function lookupProvisional(phone: string): ProvisionalUser | undefined {
  return PROVISIONAL_USERS[normalizeGabonPhone(phone)];
}
