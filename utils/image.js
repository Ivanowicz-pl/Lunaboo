import { NextResponse } from "next/server";

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const DEFAULT_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"; // Phoenix 1.0 (lub zmień na swój)

async function pollForImage(generationId, apiKey) {
  const maxAttempts = 20;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Błąd pobierania obrazu. Status: ${res.status}`);
    }

    const data = await res.json();
    const url = data?.generations_by_pk?.generated_images?.[0]?.url;

    if (url) return url;
    await delay(3000);
  }

  throw new Error("Obraz nie został wygenerowany w czasie oczekiwania.");
}

async function parseJsonWithCorrection(input, apiKey) {
  try {
    return JSON.parse(input);
  } catch {
    console.warn("⚠️ Pierwsze parsowanie nieudane. Próbuję poprawić JSON przez GPT...");
    const fixPrompt = `Please fix and return valid JSON for the following malformed text:\n\n${input}`;
    const res = await fetch(`${process.env.NEXT_PUBLIC_TEXT_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: fixPrompt }],
        temperature: 0,
      }),
    });

    const data = await res.json();
    const corrected = data.choices?.[0]?.message?.content || "";

    try {
      return JSON.parse(corrected);
    } catch {
      console.warn("❌ Poprawiony JSON nadal nieprawidłowy.");
      return null;
    }
  }
}

async function describeChildAppearance(publicImageUrl) {
  const prompt = `You are a vision AI. Analyze the face in the image and return strictly and only a valid JSON object without any text before or after. Include only the following fields if visible (use null if not):\n\n{
  "age": number,
  "gender": "boy" | "girl" | null,
  "faceShape": string | null,
  "headSize": string | null,
  "eyeColor": string | null,
  "eyeShape": string | null,
  "eyelashLength": string | null,
  "eyebrowShape": string | null,
  "hairColor": string | null,
  "hairType": string | null,
  "hairLength": string | null,
  "hairstyle": string | null,
  "hairTexture": string | null,
  "noseShape": string | null,
  "lipShape": string | null,
  "mouthExpression": string | null,
  "skinTone": string | null,
  "freckles": string | null,
  "glasses": string | null,
  "dimples": string | null,
  "visibleDistinguishingFeatures": string | null
}`;

  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: publicImageUrl } },
      ],
    },
  ];

  const res = await fetch(`${process.env.NEXT_PUBLIC_TEXT_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages,
      temperature: 0,
    }),
  });

  const data = await res.json();
  const description = data.choices?.[0]?.message?.content || "";
  const parsed = await parseJsonWithCorrection(description, process.env.OPENAI_API_KEY);

  if (!parsed) return "";

  console.log("🔍 Zebrane cechy wyglądu dziecka:", parsed);
  return Object.entries(parsed)
    .filter(([_, v]) => v !== null && v !== "null")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export {
  pollForImage,
  parseJsonWithCorrection,
  describeChildAppearance,
  DEFAULT_MODEL_ID,
};
