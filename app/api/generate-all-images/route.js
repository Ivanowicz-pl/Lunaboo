// /app/api/generate-all-images/route.js
import { NextResponse } from "next/server";

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;
const TEXT_API_URL = process.env.NEXT_PUBLIC_TEXT_API_URL || "https://api.openai.com";

const FALLBACK_LEONARDO_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"; // Leonardo Phoenix 1.0
const LEONARDO_MODEL_ID_TO_USE = process.env.LEONARDO_MODEL_ID || FALLBACK_LEONARDO_MODEL_ID;

const STYLE_MAP = {
  "Bajkowy pastelowy (domyślny)": "storybook illustration style, pastel colors, soft lighting, painterly texture, 2D fairytale",
  "Disney/Pixar": "3D animated style, inspired by Disney and Pixar, cinematic lighting, expressive characters, magical realism",
  "Płaski i minimalistyczny": "flat vector style, minimalist shapes, bold colors, simple characters, children's magazine style",
  "Akwarela": "hand-painted watercolor style, soft brush strokes, dreamy colors, traditional illustration",
  "Komiksowy": "comic book style, dynamic lines, exaggerated expressions, vivid saturated colors, energetic scene",
  "Anime": "anime-style illustration, large expressive eyes, dynamic composition, vibrant colors",
  "Ghibli": "inspired by Studio Ghibli, dreamy landscapes, soft shadows, magical realism, whimsical mood",
  "Fotorealistyczny": "photorealistic digital painting, high detail, cinematic lighting, fantasy atmosphere"
};

const PROPORTION_TO_DIMENSIONS = {
  "square": { width: 1024, height: 1024 },    
  "portrait": { width: 768, height: 1024 },   
  "landscape": { width: 1024, height: 768 }  
};

async function fetchWithRetry(url, options, maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const currentOptions = { ...options };
      if (!currentOptions.signal && options.timeout) { 
        const controller = new AbortController();
        currentOptions.signal = controller.signal;
        setTimeout(() => controller.abort(), options.timeout);
      }
      const response = await fetch(url, currentOptions);
      if (response.ok) return response;
      const errorBodyForLog = await response.text(); 
      if (response.status >= 500 && response.status <= 599 && attempt < maxRetries - 1) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.warn(`Fetch failed with status ${response.status} for ${url}. Retrying in ${delay}ms (${attempt + 1}/${maxRetries}). Body: ${errorBodyForLog.substring(0,100)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error(`Fetch failed for ${url} with status ${response.status} after ${attempt + 1} attempts. Body: ${errorBodyForLog.substring(0,500)}`);
      throw new Error(`Fetch failed for ${url} with status ${response.status}.`);
    } catch (error) {
      if (error.name === 'AbortError' && attempt < maxRetries -1) {
          const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
          console.warn(`Fetch aborted (timeout) for ${url}. Retrying in ${delay}ms (${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
      }
      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.warn(`Fetch failed for ${url} with error: ${error.message}. Retrying in ${delay}ms (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error(`Final fetch attempt failed for ${url} after ${maxRetries} retries. Error: ${error.message}`);
      throw error; 
    }
  }
  throw new Error(`Fetch failed for ${url} after ${maxRetries} retries (loop ended unexpectedly).`);
}

function randomCameraShot(isFallbackAttempt = false) {
  const standardShots = [
    "dynamic wide establishing shot, character in detailed environment", "eye-level medium shot, character interacting with key scene elements",
    "full shot of character performing action from story", "action shot, capturing movement and energy",
    "cinematic wide shot, showing depth and scale, character active within", "interactive scene, focus on the story's key event",
    "storybook illustration, rich detailed background, character naturally integrated", "whimsical and magical atmosphere, showing character's exploration",
    "adventurous scene, character navigating the environment"
  ];
  const safeShots = [ 
    "dynamic wide scene, character part of a detailed environment", "eye-level medium shot, character interacting with surroundings",
    "full shot of character in action, clear narrative moment", "energetic scene capturing movement",
    "cinematic wide view, showing depth and scale, character active within", "interactive scene, focus on the story's key event, character visible",
    "perspective showing the character looking at something wondrous", "overview of the location with character engaged in an activity",
  ];
  const shotsToUse = isFallbackAttempt ? safeShots : standardShots;
  return shotsToUse[Math.floor(Math.random() * shotsToUse.length)];
}

async function pollForImage(generationId) {
  const maxAttempts = 35; 
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`Polling for image ${generationId}, attempt ${attempt + 1}/${maxAttempts}...`);
    const options = { headers: { Authorization: `Bearer ${LEONARDO_API_KEY}` }, timeout: 12000 };
    const res = await fetchWithRetry(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, options, 2, 2000, 5000); 
    const data = await res.json();
    const url = data?.generations_by_pk?.generated_images?.[0]?.url;
    if (url) return url;
    const status = data?.generations_by_pk?.status;
    if (status && status !== 'PENDING' && status !== 'PROCESSING') {
        console.warn(`Image ${generationId} status is ${status}. Stopping poll. Response:`, data);
        throw new Error(`Image ${generationId} generation ended with status ${status}.`);
    }
    await delay(7000); 
  }
  throw new Error(`Image ${generationId} was not generated by Leonardo.AI within the expected polling time after ${maxAttempts} attempts.`);
}

async function parseJsonWithCorrection(input) {
  try { return JSON.parse(input); } 
  catch (e) {
    console.warn("Failed to parse JSON directly, attempting correction:", input.substring(0, 100) + "...");
    const fixPrompt = `The following text is a malformed JSON. Please correct it and return ONLY the valid JSON object, without any surrounding text or explanations. JSON to fix:\n\n${input}`;
    const options = {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: fixPrompt }], temperature: 0 }),
      timeout: 10000
    };
    const res = await fetchWithRetry(`${TEXT_API_URL}/v1/chat/completions`, options);
    const data = await res.json();
    const corrected = data.choices?.[0]?.message?.content || "";
    try { return JSON.parse(corrected); } 
    catch (finalError) { console.error("Failed to parse corrected JSON:", finalError, "Corrected text:", corrected); return null; }
  }
}

async function describeChildAppearance(publicImageUrl, ageFromForm) {
  const prompt = `You are a vision AI. Analyze the face in the image. The child is stated to be ${ageFromForm} years old. Confirm this age. Return strictly and only a valid JSON object without any text before or after. JSON keys and string values should be in English. 
Include 'age: ${ageFromForm}' (number). 
For other features, provide specific and clear descriptors. Prioritize accurate hair color.
Output fields: {
  \"age\": ${ageFromForm}, 
  \"gender\": \"boy\" | \"girl\" | null, 
  \"hairColor\": "e.g., golden blonde, dark brown, ginger red, black", 
  \"hairStyle\": "e.g., long wavy, short curly, straight with bangs, pigtails", 
  \"eyeColor\": "e.g., bright blue, deep brown, green",
  \"clothingDescription\": "e.g., wearing a blue t-shirt with a star and red shorts",
  \"distinctiveFeatures\": "e.g., light freckles, a cheerful smile" 
}`;
  
  const messages = [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: publicImageUrl } }] }];
  const options = {
    method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4-turbo", messages, temperature: 0.05, max_tokens: 150 }),
    timeout: 20000 
  };
  const res = await fetchWithRetry(`${TEXT_API_URL}/v1/chat/completions`, options);
  const data = await res.json();
  const description = data.choices?.[0]?.message?.content || "";
  const parsed = await parseJsonWithCorrection(description);
  
  if (!parsed) return { fullDescription: `a ${ageFromForm}-year-old child`, hair: null, eyes: null, gender: null };

  let appearanceParts = [];
  appearanceParts.push(`${parsed.age || ageFromForm}-year-old`);
  const gender = parsed.gender || null;
  if (gender) appearanceParts.push(gender);
  
  let hairCombined = null;
  if (parsed.hairColor) {
    hairCombined = parsed.hairColor; 
    if (parsed.hairStyle && !parsed.hairStyle.toLowerCase().includes(parsed.hairColor.toLowerCase())) {
        hairCombined = `${parsed.hairStyle} ${parsed.hairColor} hair`; 
    } else if (parsed.hairStyle) {
        hairCombined = `${parsed.hairStyle}`; 
    } else {
        hairCombined += " hair"; 
    }
    appearanceParts.push(hairCombined.trim().replace(/\s+/g, ' '));
  }

  let eyeCombined = null;
  if (parsed.eyeColor) {
    eyeCombined = `${parsed.eyeColor} eyes`;
    appearanceParts.push(eyeCombined);
  }
  if (parsed.clothingDescription) appearanceParts.push(parsed.clothingDescription);
  if (parsed.distinctiveFeatures) appearanceParts.push(parsed.distinctiveFeatures);
  
  let finalAppearance = appearanceParts.filter(Boolean).join(", ").trim();
    
  if (finalAppearance.length > 250) { 
    console.warn(`Child appearance initially long (${finalAppearance.length}): ${finalAppearance}. Shortening to ~250 chars.`);
    finalAppearance = finalAppearance.substring(0, 247) + "...";
  }
  return {
    fullDescription: finalAppearance || `a ${ageFromForm}-year-old child`,
    hair: hairCombined,
    eyes: eyeCombined,
    gender: gender
  };
}

// ZMODYFIKOWANA FUNKCJA z zaostrzonym promptem dla LLM
async function summarizeFragmentForImagePrompt(fragmentTextInPolish, childNameInStory, childAge, version = "full") {
  let targetChars = version === "full" ? 600 : 350; // Zwiększono limit dla "full" wersji
  let targetWords = version === "full" ? "80-100" : "40-55"; // Zwiększono target słów
  let maxLLMTokens = version === "full" ? 200 : 100; // Zwiększono max_tokens dla "full"

  const prompt = `You are an expert children's book scene describer for an AI image generator.
Based on the following POLISH children's story fragment (for a ${childAge}-year-old child), provide a vivid and DETAILED ENGLISH scene description.
The description MUST BE **UNDER ${targetChars} CHARACTERS** (target around ${targetWords} words).

Your description MUST include:
1. The main CHARACTER '${childNameInStory}' (${childAge} years old) and their primary ACTION or emotional state.
2. ALL other characters or creatures '${childNameInStory}' is INTERACTING with or that are significantly present. Describe them briefly (e.g., "a fluffy white rabbit with a blue vest", "three colorful singing butterflies: one red, one blue, one yellow", "a grumpy old troll under a wooden bridge").
3. A description of the ENVIRONMENT/BACKGROUND with 2-3 key visual details (e.g., "a sun-dappled magical forest with glowing flowers and tall, twisted trees", "a bustling medieval marketplace full of colorful stalls under a blue sky").
4. The overall MOOD or ATMOSPHERE of the scene (e.g., "joyful and bright", "mysterious and slightly spooky", "adventurous and exciting").
Ensure the description is dynamic, implies a full scene with interactions, and avoids a simple portrait focus. The character should be an integral part of the environment. Be direct and visual.
Output ONLY the English scene description.
**CRITICALLY IMPORTANT: The generated English description must be completely anodyne, child-safe, and contain NO words, substrings, or letter combinations that could be misinterpreted by a sensitive content moderation AI as inappropriate, offensive, or adult-themed, especially in a child context. Double-check for any accidental similarities to problematic English words.**

Polish Story Fragment:
"${fragmentTextInPolish}"

Detailed, child-safe English Scene Description for Illustration (MAX ${targetChars} characters):`;

  const options = {
    method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], temperature: version === "full" ? 0.55 : 0.25, max_tokens: maxLLMTokens }),
    timeout: 20000 // Zwiększony timeout dla potencjalnie dłuższego opisu
  };
  const res = await fetchWithRetry(`${TEXT_API_URL}/v1/chat/completions`, options);
  let summary = (await res.json()).choices?.[0]?.message?.content.trim() || `A scene from the story featuring ${childNameInStory}.`;
  
  if (summary.length > targetChars + 50) { // Dajemy większy bufor dla ucinania
      console.warn(`LLM summary (version: ${version}) was too long (${summary.length}), truncating to ${targetChars + 50} chars.`);
      summary = summary.substring(0, targetChars + 47) + "..."; 
  }
  return summary;
}

export async function POST(req) {
  try {
    if (!IMGBB_API_KEY || !OPENAI_API_KEY || !LEONARDO_API_KEY) {
        throw new Error("Missing one or more API key configurations on the server.");
    }

    const formData = await req.formData();
    const childName = formData.get("childName");
    const ageGroup = formData.get("ageGroup");
    const storyTheme = formData.get("storyTheme");
    const dedication = formData.get("dedication");
    const selectedStyle = formData.get("selectedStyle") || "Bajkowy pastelowy (domyślny)";
    const imageFile = formData.get("images");
    const bookProportion = formData.get("bookProportion") || "square";

    if (!childName || !ageGroup || !storyTheme || !imageFile) {
      return NextResponse.json({ success: false, error: "Missing required input data (name, age, theme, image)." }, { status: 400 });
    }

    const imgbbForm = new FormData();
    imgbbForm.append("image", imageFile);
    const imgbbRes = await fetchWithRetry(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: imgbbForm, timeout: 20000 });
    const imgbbData = await imgbbRes.json();
    const publicImageUrl = imgbbData?.data?.url;
    if (!publicImageUrl) throw new Error("Failed to upload image to ImgBB or get a public URL after retries.");

    const childAppearanceData = await describeChildAppearance(publicImageUrl, ageGroup); 
    const detailedChildAppearanceString = childAppearanceData.fullDescription;
    const childKeyFeatures = `a ${ageGroup}-year-old ${childAppearanceData.gender || 'child'}${childAppearanceData.hair ? ` with ${childAppearanceData.hair}` : ''}${childAppearanceData.eyes ? ` and ${childAppearanceData.eyes}` : ''}`;

    const selectedStylePrompt = STYLE_MAP[selectedStyle] || STYLE_MAP["Bajkowy pastelowy (domyślny)"];

    const storyGenerationPrompt = `You are a children's story writer. Write a captivating children's story in POLISH for a ${ageGroup}-year-old child named ${childName}. The theme of the story is: "${storyTheme}". The story must be divided into exactly 5 parts (fragments). Each part must start with the exact format: "**Fragment X: [A catchy Polish title for the fragment]**" (where X is the fragment number from 1 to 5). The entire story should be engaging and around 400-600 words long. At the very end of the entire story, after all fragments, add a line in the exact format: Tytuł bajki: "[The Polish title for the whole story]" Example of a fragment start: **Fragment 1: Tajemnicza Ścieżka** ${childName}, który/która miał/a ${ageGroup} lat, pewnego dnia bawił/a się w ogrodzie... Ensure the story is age-appropriate, imaginative, and written entirely in POLISH.`;
    const storyRes = await fetchWithRetry(`${TEXT_API_URL}/v1/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: storyGenerationPrompt }], temperature: 0.85 }),
      timeout: 45000 
    });
    const storyData = await storyRes.json();
    const storyTextInPolish = storyData.choices?.[0]?.message?.content || "";
    const titleMatch = storyTextInPolish.match(/Tytuł bajki:\s*["“]([^"”]+)["”]/im);
    const storyTitleInPolish = titleMatch ? titleMatch[1].trim() : `Przygody ${childName}`;
    const fragmentHeaders = [...storyTextInPolish.matchAll(/\*\*(Fragment \d+: [^\*]+)\*\*/g)];
    let fragmentsInPolish = [];
    if (fragmentHeaders.length > 0) {
        for(let i = 0; i < fragmentHeaders.length; i++) {
            const header = fragmentHeaders[i][0];
            const nextHeaderSearchTerm = fragmentHeaders[i+1] ? fragmentHeaders[i+1][0] : "Tytuł bajki:";
            const startIndex = storyTextInPolish.indexOf(header) + header.length;
            let endIndex = storyTextInPolish.indexOf(nextHeaderSearchTerm, startIndex);
            if (endIndex === -1 && nextHeaderSearchTerm === "Tytuł bajki:") { endIndex = storyTextInPolish.length; }
            const fragmentContent = storyTextInPolish.substring(startIndex, endIndex !== -1 ? endIndex : undefined).trim();
            if(fragmentContent) fragmentsInPolish.push(fragmentContent);
        }
    }
    fragmentsInPolish = fragmentsInPolish.slice(0, 5);
    if (fragmentsInPolish.length === 0 && storyTextInPolish.length > 0) { 
        console.warn("Advanced fragment parsing failed, trying simple split by '**Fragment'.");
        const simpleParts = storyTextInPolish.split(/\*\*Fragment \d+:.*?\*\*/g).map(t => t.replace(/Tytuł bajki:.*/i, "").trim()).filter(Boolean);
        fragmentsInPolish = simpleParts.slice(0,5);
    }
    if (fragmentsInPolish.length < 5 && fragmentsInPolish.length > 0) { 
        console.warn(`Warning: Only ${fragmentsInPolish.length} fragments were obtained. Story: "${storyTextInPolish.substring(0,100)}..."`);
    } else if (fragmentsInPolish.length === 0) {
        console.error("CRITICAL: No fragments could be parsed. Cannot generate image prompts.");
        throw new Error("Failed to parse any story fragments.");
    }
    
    const contentToIllustrate = [{ type: "cover", storyTheme: storyTheme }];
    fragmentsInPolish.forEach((fragment) => contentToIllustrate.push({ type: "fragment", content: fragment }));

    const imageUrls = [];
    const negativePrompt = "text, words, letters, watermark, signature, blurry, low quality, jpeg artifacts, deformed, ugly, disfigured, extra limbs, missing limbs, bad anatomy, mutated hands, poorly drawn hands, poorly drawn face, extra fingers, too many fingers, low detail, undetailed scene, empty scene, doll, plastic, fake, ((monochrome)), ((grayscale)), ((text box)), ((speech bubble)), frames, borders, artifacts, signature, username, logo, (worst quality, low quality, normal quality:1.4), (jpeg artifacts), (blurry), (poorly drawn), (bad hands), (bad anatomy), (disfigured), (extra limbs), (missing limbs), (fused fingers), (too many fingers), (malformed hands)";
    const imageDimensions = PROPORTION_TO_DIMENSIONS[bookProportion] || PROPORTION_TO_DIMENSIONS["landscape"]; 

    for (const [index, itemToIllustrate] of contentToIllustrate.entries()) {
      let currentPromptText;
      let promptVersionUsed = "full";
      let generationSuccessful = false;
      let generationId = null;
      let finalImageUrl = null;
      let isModeratedRetry = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        console.log(`Generating image ${index + 1}/${contentToIllustrate.length} (Attempt ${attempt}) for proportion: ${bookProportion} (${imageDimensions.width}x${imageDimensions.height})...`);
        
        let condensedSceneDesc = "";
        let currentShotType = randomCameraShot(isModeratedRetry);

        if (itemToIllustrate.type === "fragment") {
          condensedSceneDesc = await summarizeFragmentForImagePrompt( itemToIllustrate.content, childName, ageGroup, attempt === 1 ? "full" : "short" );
        }

        if (itemToIllustrate.type === "cover") {
          currentPromptText = 
            `${selectedStylePrompt}. ` +
            `Children's book cover: "${storyTitleInPolish}". ` +
            `Featuring main character: ${childKeyFeatures}. Full appearance details: (${detailedChildAppearanceString}). ` + 
            `Theme: '${itemToIllustrate.storyTheme}'. Magical, inviting, dynamic scene with a sense of wonder. Vibrant colors. ` + // Skrócono nieco
            `Composition: ${currentShotType}.`;
        } else {
          currentPromptText = 
            `${selectedStylePrompt}. ` +
            `Illustration for a children's story. ` +
            `Main character: ${childKeyFeatures}. Full appearance details: (${detailedChildAppearanceString}). ` +
            `Scene based on this summary: "${condensedSceneDesc}". Ensure all mentioned characters and interactions from the summary are depicted. ` + // Dodano wzmocnienie
            `Shot: ${currentShotType}. ` + 
            `The illustration must be dynamic, showing the main character actively participating and integrated into a detailed environment. Avoid static portraits. Focus on the narrative moment, action, and emotions.`;
        }
        
        if (currentPromptText.length > 1480) { 
            console.warn(`Prompt (Attempt ${attempt}, Version ${promptVersionUsed}) for image ${index+1} is very long (${currentPromptText.length}), truncating.`);
            currentPromptText = currentPromptText.substring(0, 1477) + "..."; 
        }
        promptVersionUsed = (attempt === 1) ? "full_scene_desc" : "short_scene_desc";
        console.log(`Attempt ${attempt} - Leonardo Prompt (Length: ${currentPromptText.length}): ${currentPromptText}`);

        const leonardoRequestBody = {
          prompt: currentPromptText, negative_prompt: negativePrompt, modelId: LEONARDO_MODEL_ID_TO_USE,
          width: imageDimensions.width, height: imageDimensions.height, 
          num_images: 1, guidance_scale: 7, num_inference_steps: 30, promptMagic: false,
        };

        const generationRes = await fetchWithRetry("https://cloud.leonardo.ai/api/rest/v1/generations", {
            method: "POST", headers: { Authorization: `Bearer ${LEONARDO_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(leonardoRequestBody), timeout: 25000 
          }, 2, 3000, 6000 
        );
        
        const responseText = await generationRes.text(); 
        let generationData;
        try { 
            generationData = JSON.parse(responseText); 
            if (typeof generationData === 'string' && generationData.startsWith('<!DOCTYPE html>')) {
                console.error(`Leonardo.AI returned HTML error page (Attempt ${attempt}) for image ${index+1}.`);
                throw new Error("Leonardo.AI returned HTML error page.");
            }
        } 
        catch (e) { 
          console.error(`Error parsing Leonardo.AI JSON (Attempt ${attempt}) for image ${index+1}: ${responseText.substring(0,300)}`, e);
          if (attempt === 1) { isModeratedRetry = responseText.includes("moderated"); continue; } else break;
        }
        
        if (generationData && generationData.error) {
            console.error(`Leonardo.AI API Error (Attempt ${attempt}) for image ${index+1}: ${generationData.error}`);
            if (attempt === 1 && (generationData.error.includes("maximum length") || generationData.error.includes("moderated"))) {
                 isModeratedRetry = generationData.error.includes("moderated");
                 continue; 
            } else if (attempt === 1 && generationData.error.includes("pending jobs")) {
                await new Promise(resolve => setTimeout(resolve, 5000)); 
                isModeratedRetry = false; 
                continue;
            }
            break; 
        }

        generationId = generationData?.sdGenerationJob?.generationId;
        if (generationId) {
          try {
            finalImageUrl = await pollForImage(generationId); 
            generationSuccessful = true;
            break; 
          } catch (pollError) {
            console.error(`Error polling for image ${generationId} (Attempt ${attempt}):`, pollError);
            break; 
          }
        } else {
          console.error(`Leonardo.AI did not return generationId (Attempt ${attempt}). Response:`, generationData);
          if (attempt === 1) { isModeratedRetry = responseText.includes("moderated"); continue; } else break;
        }
      } 

      if (generationSuccessful) {
        imageUrls.push({ prompt: currentPromptText, generationId, url: finalImageUrl, promptVersionUsed });
      } else {
        console.error(`Failed to generate image ${index + 1} after all attempts.`);
        imageUrls.push({ prompt: currentPromptText, generationId: null, url: `https://placehold.co/${imageDimensions.width}x${imageDimensions.height}/FF0000/FFFFFF?text=Image+Gen+Failed+${index+1}`, error: `Failed after retries`, promptVersionUsed });
      }
    }
    
    return NextResponse.json({
      success: true, storyTitle: storyTitleInPolish, fragments: fragmentsInPolish,    
      generatedImages: imageUrls, dedication: dedication          
    });

  } catch (err) {
    console.error("❌ Error in /api/generate-all-images:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected server error occurred.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}