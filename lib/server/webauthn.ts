import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "./db";
import { audit } from "./audit";

const rpName = process.env.WEBAUTHN_RP_NAME || "Moov Assist";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

async function rememberChallenge(userId: string, type: "REGISTRATION"|"AUTHENTICATION", challenge: string, context?: Record<string, unknown>) {
  await db().webAuthnChallenge.deleteMany({ where: { userId, type, expiresAt: { lt: new Date() } } });
  await db().webAuthnChallenge.create({ data: { userId, type, challenge, context: context as object | undefined, expiresAt: new Date(Date.now() + 5 * 60_000) } });
}

async function consumeChallenge(userId: string, type: "REGISTRATION"|"AUTHENTICATION") {
  const record = await db().webAuthnChallenge.findFirst({ where: { userId, type, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!record) throw new Error("Challenge expiré ou introuvable.");
  await db().webAuthnChallenge.delete({ where: { id: record.id } });
  return { challenge: record.challenge, context: record.context as Record<string, unknown> | null };
}

export async function registrationOptions(phone: string, displayName?: string) {
  const user = await db().user.upsert({ where: { phone }, update: { displayName: displayName || undefined }, create: { phone, displayName } });
  const credentials = await db().webAuthnCredential.findMany({ where: { userId: user.id } });
  const options = await generateRegistrationOptions({
    rpName, rpID, userName: phone, userDisplayName: displayName || phone,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: credentials.map(item => ({ id: item.credentialId, transports: item.transports as AuthenticatorTransport[] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required", authenticatorAttachment: "platform" },
  });
  await rememberChallenge(user.id, "REGISTRATION", options.challenge);
  return { options, userId: user.id };
}

export async function verifyRegistration(phone: string, response: RegistrationResponseJSON) {
  const user = await db().user.findUniqueOrThrow({ where: { phone } });
  const expected = await consumeChallenge(user.id, "REGISTRATION");
  const verification = await verifyRegistrationResponse({ response, expectedChallenge: expected.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!verification.verified || !verification.registrationInfo) throw new Error("Enregistrement biométrique non vérifié.");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await db().webAuthnCredential.create({ data: {
    userId: user.id,
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: BigInt(credential.counter),
    transports: credential.transports || response.response.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    webauthnUserId: user.id,
  }});
  await audit("webauthn.register", "credential", "success", { userId: user.id, resourceId: credential.id, metadata: { deviceType: credentialDeviceType, backedUp: credentialBackedUp } });
  return { verified: true, userId: user.id };
}

export async function authenticationOptions(phone: string, context?: Record<string, unknown>) {
  const user = await db().user.findUniqueOrThrow({ where: { phone }, include: { credentials: true } });
  if (!user.credentials.length) throw new Error("Aucune passkey enregistrée pour ce compte.");
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required", allowCredentials: user.credentials.map(item => ({ id: item.credentialId, transports: item.transports as AuthenticatorTransport[] })) });
  await rememberChallenge(user.id, "AUTHENTICATION", options.challenge, context);
  return { options, userId: user.id };
}

export async function verifyAuthentication(phone: string, response: AuthenticationResponseJSON) {
  const user = await db().user.findUniqueOrThrow({ where: { phone } });
  const credential = await db().webAuthnCredential.findUniqueOrThrow({ where: { credentialId: response.id } });
  if (credential.userId !== user.id) throw new Error("Identifiant biométrique invalide.");
  const expected = await consumeChallenge(user.id, "AUTHENTICATION");
  const verification = await verifyAuthenticationResponse({
    response, expectedChallenge: expected.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: credential.credentialId, publicKey: credential.publicKey, counter: Number(credential.counter), transports: credential.transports as AuthenticatorTransport[] },
  });
  if (!verification.verified) throw new Error("Authentification biométrique refusée.");
  await db().webAuthnCredential.update({ where: { id: credential.id }, data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() } });
  await audit("webauthn.authenticate", "credential", "success", { userId: user.id, resourceId: credential.credentialId });
  return { verified: true, userId: user.id, context: expected.context || undefined };
}
