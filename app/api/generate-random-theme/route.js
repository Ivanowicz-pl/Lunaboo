// /app/api/generate-random-theme/route.js
import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_API_URL = process.env.NEXT_PUBLIC_TEXT_API_URL || "https://api.openai.com";

export async function POST(req) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ success: false, error: "Missing OPENAI_API_KEY configuration." }, { status: 500 });
  }

  try {
    // Możemy w przyszłości przyjmować np. wiek dziecka z req.json() dla lepszego dopasowania tematu
    // const { age } = await req.json(); 
    // const ageContext = age ? `suitable for a ${age}-year-old child` : "suitable for a young child";

    const promptContent = `You are a creative assistant. Generate a short, catchy, and imaginative children's story theme or title in POLISH.
The theme should be suitable for a personalized children's book.
Return ONLY the theme/title text itself, without any prefixes, labels, or quotation marks.
The theme should be a maximum of 10-15 words.
Examples: "Przygoda zaginionej skarpetki", "Mały robot, który chciał zobaczyć gwiazdy", "Tajemnica Leśnej Polany".

Generated POLISH theme/title:`;

    const res = await fetch(`${TEXT_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o", // Lub inny preferowany model
        messages: [{ role: "user", content: promptContent }],
        temperature: 0.8, // Zwiększona temperatura dla większej kreatywności
        max_tokens: 50, // Wystarczająco na krótki tytuł/temat
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error from OpenAI API (random theme):", errorBody);
      throw new Error(`OpenAI API error: ${res.status} ${errorBody}`);
    }

    const data = await res.json();
    const theme = data.choices?.[0]?.message?.content.trim().replace(/["“„”]/g, ''); // Usuwamy cudzysłowy

    if (!theme) {
      throw new Error("LLM did not return a theme.");
    }

    return NextResponse.json({ success: true, theme: theme });

  } catch (err) {
    console.error("❌ Error in /api/generate-random-theme:", err);
    const errorMessage = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}