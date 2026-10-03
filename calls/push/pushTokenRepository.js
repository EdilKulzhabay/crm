import CallPushToken from "../../Models/CallPushToken.js";
import { MAX_PUSH_TOKENS_PER_PARTICIPANT } from "./pushConfig.js";

/** @typedef {import("../callPolicy.js").Participant} Participant */

const DUPLICATE_KEY_ERROR = 11000;

const byParticipant = (participant) => ({ participantType: participant.type, participantId: participant.id });

/** Оставляет только MAX_PUSH_TOKENS_PER_PARTICIPANT самых свежих токенов участника */
const trimOldTokens = async (participant) => {
    const stale = await CallPushToken.find(byParticipant(participant))
        .sort({ updatedAt: -1 })
        .skip(MAX_PUSH_TOKENS_PER_PARTICIPANT)
        .select("_id")
        .lean();
    if (stale.length > 0) {
        await CallPushToken.deleteMany({ _id: { $in: stale.map((doc) => doc._id) } });
    }
};

/**
 * @param {{ participant: Participant, platform: "ios" | "android", token: string, apnsEnvironment: string | null }} input
 */
const saveToken = async ({ participant, platform, token, apnsEnvironment }) => {
    const update = { $set: { ...byParticipant(participant), platform, apnsEnvironment } };
    try {
        await CallPushToken.updateOne({ token }, update, { upsert: true });
    } catch (error) {
        // Два одновременных upsert одного токена: второй падает на unique-индексе — просто обновляем
        if (error?.code !== DUPLICATE_KEY_ERROR) throw error;
        await CallPushToken.updateOne({ token }, update);
    }
    await trimOldTokens(participant);
};

/** Удаляет токен только если он принадлежит этому участнику (чужой токен не отвязать) */
const removeToken = async (participant, token) => {
    await CallPushToken.deleteOne({ token, ...byParticipant(participant) });
};

/**
 * @param {Participant} participant
 * @returns {Promise<{ platform: string, token: string, apnsEnvironment: string | null }[]>}
 */
const findTokens = (participant) =>
    CallPushToken.find(byParticipant(participant)).select("platform token apnsEnvironment -_id").lean();

/** @param {string[]} tokens */
const deleteTokens = async (tokens) => {
    if (tokens.length === 0) return;
    await CallPushToken.deleteMany({ token: { $in: tokens } });
};

export const mongoPushTokenRepository = Object.freeze({ saveToken, removeToken, findTokens, deleteTokens });
