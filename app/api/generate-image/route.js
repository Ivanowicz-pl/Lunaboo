import { NextResponse } from "next/server";
import { Buffer } from "buffer";

const MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"; // Phoenix 1.0

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

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString("base64");

    // Upload do Leonardo
    const blob = Buffer.from(base64Image, "base64");
    const form = new FormData();
    form.append("init_image", new Blob([blob], { type: "image/jpeg" }), "child.jpg");
    form.append("extension", "jpeg");

    const uploadRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/init-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LEONARDO_API_KEY}` },
      body: form,
    });

    const uploadResult = JSON.parse(await uploadRes.text());
    const initImageId = uploadResult?.uploadInitImage?.id;
    if (!initImageId) throw new Error("Brak initImageId");

    // Generowanie promptów
    const storyPrompt = `Write a fairytale in Polish for a child aged ${ageGroup} named ${childName}. Theme: ${storyTheme}. Divide it into 5 parts. Each part titled: \"**Fragment X: Title**\".`;
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

    const storyText = (await storyRes.json()).choices?.[0]?.message?.content || "";
    const fragments = storyText
      .split(/\*\*Fragment \d+:.*?\*\*/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const promptGen = `Create prompts for illustrations in English (cover, dedication, 5 fragments). Style: soft 2D animation, pastel, fairytale. Child's name: ${childName}. Dedication: ${dedication}.\n\n${fragments.map((f, i) => `Fragment ${i + 1}: ${f}`).join("\n\n")}`;
    const promptRes = await fetch(`${process.env.NEXT_PUBLIC_TEXT_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: promptGen }],
        temperature: 0.7,
      }),
    });

    const promptText = (await promptRes.json()).choices?.[0]?.message?.content || "";
    const firstPrompt = promptText.split("\n").find(line => line.toLowerCase().includes("fragment")) || promptText;

    const genRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LEONARDO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: firstPrompt,
        modelId: MODEL_ID,
        init_image_id: initImageId,
        width: 768,
        height: 512,
        num_images: 1,
        promptMagic: true,
      }),
    });

    const genJson = await genRes.json();

    return NextResponse.json({
      success: true,
      promptText,
      generationId: genJson.sdGenerationJob?.generationId || null,
    });

  } catch (err) {
    console.error("❌ Błąd generate-image:", err);
    return NextResponse.json({ success: false, error: "Błąd serwera przy generowaniu ilustracji." });
  }
}
