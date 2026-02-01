import { Elysia, t } from "elysia";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
import { logger } from "./logger";

const elevenLabsClient = new ElevenLabsClient({
    apiKey: process.env["ELEVENLABS_API_KEY"]
})

export const elevenlabsRoutes = new Elysia({ prefix: "/elevenlabs" })
    .get("/", () => "ElevenLabs Route");


type Word = {
    text: string;
    start: number;
    end: number;
    type: string;
    speakerId: string;
    logprob: number;
}

type TranscriptionResponse = {
    languageCode: string;
    languageProbabilty: number;
    text: string;
    words: Word[]
}

function formatTranscript(data: TranscriptionResponse): string {
    // Guard clause for empty data
    if (!data.words || data.words.length === 0) {
        return "";
    }

    let output = "";
    let currentSpeaker: string | null = null;
    let currentLineBuffer = "";

    // 1. Sort by start time to ensure the sequence is correct
    const sortedWords = [...data.words].sort((a, b) => a.start - b.start);

    for (const item of sortedWords) {
        // Initialize the first speaker if null
        if (currentSpeaker === null) {
            currentSpeaker = item.speakerId;
        }

        // 2. If the speaker has changed
        if (item.speakerId !== currentSpeaker) {
            // Flush the previous speaker's line to output
            output += `${currentSpeaker}: ${currentLineBuffer.trim()}\n`;

            // Reset for the new speaker
            currentSpeaker = item.speakerId;
            currentLineBuffer = item.text;
        } else {
            // 3. Same speaker: keep appending text (includes spacing objects)
            currentLineBuffer += item.text;
        }
    }

    // 4. Flush the final line after the loop finishes
    if (currentSpeaker && currentLineBuffer.trim().length > 0) {
        output += `${currentSpeaker}: ${currentLineBuffer.trim()}\n`;
    }

    return output;
}

elevenlabsRoutes.post("/upload", async (request) => {
    const { audio } = request.body;

    logger.info(`received audio file: ${audio.name}`);

    const transcription = await elevenLabsClient.speechToText.convert({
        file: audio,
        modelId: "scribe_v2",
        tagAudioEvents: false,
        languageCode: undefined,
        diarize: true,
    }) as unknown as TranscriptionResponse;

    const transcript = formatTranscript(transcription);
    logger.info(`transcript: ${transcript}`);

    return {
        transcript,
    }

}, {
    body: t.Object({
        audio: t.File({
            type: "audio/*"
        })
    })
});

elevenlabsRoutes.post("/tts", async (request) => {
    const { text } = request.body;

    logger.info(`received text: ${text}`);

    const audio = await elevenLabsClient.textToSpeech.convert("dXtC3XhB9GtPusIpNtQx", {
        text: text,
        modelId: "eleven_flash_v2_5",
        outputFormat: "mp3_22050_32",
    });

    return new Response(audio as any, {
        headers: {
            "Content-Type": "audio/mpeg",
        }
    });

}, {
    body: t.Object({
        text: t.String(),
    })
}); 