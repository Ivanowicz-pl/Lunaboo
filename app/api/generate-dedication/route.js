// /app/api/generate-dedication/route.js
import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_API_URL = process.env.NEXT_PUBLIC_TEXT_API_URL || "https://api.openai.com";

export async function POST(req) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ success: false, error: "Missing OPENAI_API_KEY configuration." }, { status: 500 });
  }

  try {
    const { childName, age, storyTheme } = await req.json();

    if (!childName || !age) {
      return NextResponse.json({ success: false, error: "Child name and age are required to generate a dedication." }, { status: 400 });
    }

    // Można dodać bardziej złożone prompty w zależności od np. okazji, relacji itp.
    const promptContent = `You are a heartfelt writer. Generate a short, warm, and age-appropriate book dedication in POLISH for a child named ${childName} (${age} years old).
The book's theme is "${storyTheme || 'an amazing adventure'}".
The dedication should be touching and personal.
End the dedication with a placeholder like "[Miejsce na Twój Podpis/Relację]" or "[Z miłością, Twoja/Twój ...]", so the user can complete it.
The dedication should be around 3-5 sentences long.
Return ONLY the dedication text itself, without any prefixes or labels.

Example structure:
"Dla kochanego/kochanej [Imię Dziecka],
Niech ta bajeczka otworzy przed Tobą drzwi do świata pełnego magii i przygód. Pamiętaj, że jesteś wyjątkowy/a i możesz osiągnąć wszystko, o czym marzysz! Zawsze będziemy Cię wspierać na każdej drodze, którą wybierzesz.
[Miejsce na Twój Podpis/Relację]"

Generated POLISH dedication:`;

    const res = await fetch(`${TEXT_API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: promptContent }],
        temperature: 0.7,
        max_tokens: 150, // Więcej miejsca na dedykację
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Error from OpenAI API (dedication):", errorBody);
      throw new Error(`OpenAI API error: ${res.status} ${errorBody}`);
    }

    const data = await res.json();
    let dedication = data.choices?.[0]?.message?.content.trim();

    if (!dedication) {
      throw new Error("LLM did not return a dedication.");
    }
    
    // Proste czyszczenie, jeśli AI dodało cudzysłowy na początku/końcu
    if (dedication.startsWith('"') && dedication.endsWith('"')) {
        dedication = dedication.substring(1, dedication.length -1);
    }


    return NextResponse.json({ success: true, dedication: dedication });

  } catch (err) {
    console.error("❌ Error in /api/generate-dedication:", err);
    const errorMessage = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}