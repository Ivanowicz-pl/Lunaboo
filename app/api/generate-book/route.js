import { NextResponse } from "next/server";
import { Buffer } from "buffer";

async function uploadToLeonardo(base64Image) {
  const blob = Buffer.from(base64Image, "base64");
  const form = new FormData();
  form.append("init_image", new Blob([blob], { type: "image/jpeg" }), "child.jpg");
  form.append("extension", "jpeg");

  const uploadRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/init-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LEONARDO_API_KEY}`,
    },
    body: form,
  });

  const rawText = await uploadRes.text();
  console.log("📜 Leonardo AI raw response:", rawText);

  try {
    const result = JSON.parse(rawText);
    return result?.uploadInitImage?.id || null;
  } catch (e) {
    console.error("❌ Błąd parsowania odpowiedzi JSON z Leonardo:", e);
    return null;
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const childName = formData.get("childName");
    const ageGroup = formData.get("ageGroup");
    const storyTheme = formData.get("storyTheme");
    const dedication = formData.get("dedication");
    const imageFile = formData.get("images");

    if (!childName || !ageGroup || !storyTheme || !imageFile) {
      return NextResponse.json({ success: false, error: "Brakuje wymaganych danych wejściowych." });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const initImageId = await uploadToLeonardo(base64Image);
    if (!initImageId) {
      return NextResponse.json({ success: false, error: "Nie udało się załadować zdjęcia do Leonardo." });
    }

    const storyPrompt = `Write a children's story in Polish for a ${ageGroup} year-old child named ${childName}, themed around ${storyTheme}. Divide the story into 5 parts. Each part must start with "**Fragment X: Title**". The story should be fun, age-appropriate, imaginative, and have a positive moral. End with the line: Tytuł bajki: "..."`;

    const storyRes = await fetch(`${process.env.NEXT_PUBLIC_TEXT_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: storyPrompt }],
        temperature: 0.8,
      }),
    });

    const storyJson = await storyRes.json();
    const storyText = storyJson.choices?.[0]?.message?.content || "";
    const titleMatch = storyText.match(/Tytuł bajki:\s*["“”']?(.*?)["“”']?$/im);
    const storyTitle = titleMatch ? titleMatch[1].trim() : `Przygody ${childName}`;
    const parts = storyText
      .split(/\*\*Fragment \d+:.*?\*\*/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      storyTitle,
      parts,
      dedication,
      initImageId,
    });
  } catch (error) {
    console.error("❌ Błąd serwera:", error);
    return NextResponse.json({ success: false, error: "Błąd serwera." });
  }
}
