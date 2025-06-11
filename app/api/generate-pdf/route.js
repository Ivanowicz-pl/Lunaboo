// /app/api/generate-pdf/route.js
import { NextResponse } from "next/server";
import fs from 'fs/promises';
import path from 'path';

// Usunięto statyczne importy puppeteer i chromium, ponieważ ładujemy je dynamicznie
// w funkcji generatePdfBufferWithPuppeteer

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TEXT_API_URL = process.env.NEXT_PUBLIC_TEXT_API_URL || "https://api.openai.com";

const STYLE_TO_FONT_SET_MAP = {
    "Bajkowy pastelowy (domyślny)": {
        titleFontFamily: "Luckiest Guy",
        bodyFontFamily: "EB Garamond",
        files: { 
            "Luckiest Guy": { regular: "Luckiest_Guy/LuckiestGuy-Regular.ttf" },
            "Pacifico": { regular: "Pacifico/Pacifico-Regular.ttf" },
            "Dancing Script": { semibold: "Dancing_Script/DancingScript-SemiBold.ttf" },
            "Caveat Brush": { regular: "Caveat_Brush/CaveatBrush-Regular.ttf" },
            "Raleway": { light: "Raleway/Raleway-Light.ttf", regular: "Raleway/Raleway-Regular.ttf" },
            "EB Garamond": { regular: "EB_Garamond/EBGaramond-Regular.ttf", italic: "EB_Garamond/EBGaramond-Italic.ttf", bold: "EB_Garamond/EBGaramond-Bold.ttf" } 
        }
    },
    "Disney/Pixar": {
        titleFontFamily: "Luckiest Guy", bodyFontFamily: "Nunito",
        files: { "Luckiest Guy": { regular: "Luckiest_Guy/LuckiestGuy-Regular.ttf" }, "Nunito": { regular: "Nunito/Nunito-Regular.ttf", bold: "Nunito/Nunito-Bold.ttf" } }
    },
    "Płaski i minimalistyczny": {
        titleFontFamily: "Montserrat Alternates", bodyFontFamily: "Montserrat",
        files: { "Montserrat Alternates": { bold: "Montserrat_Alternates/MontserratAlternates-Bold.ttf" }, "Montserrat": { regular: "Montserrat/Montserrat-Regular.ttf", bold: "Montserrat/Montserrat-Bold.ttf" } }
    },
    "Akwarela": {
        titleFontFamily: "Dancing Script", bodyFontFamily: "Raleway",
        files: { "Dancing Script": { semibold: "Dancing_Script/DancingScript-SemiBold.ttf" }, "Raleway": { regular: "Raleway/Raleway-Regular.ttf", semibold: "Raleway/Raleway-SemiBold.ttf" } }
    },
    "Komiksowy": {
        titleFontFamily: "Bangers", bodyFontFamily: "Comic Neue",
        files: { "Bangers": { regular: "Bangers/Bangers-Regular.ttf" }, "Comic Neue": { regular: "Comic_Neue/ComicNeue-Regular.ttf", bold: "Comic_Neue/ComicNeue-Bold.ttf" } }
    },
    "Anime": {
        titleFontFamily: "Orbitron", bodyFontFamily: "M PLUS Rounded 1c",
        files: { "Orbitron": { medium: "Orbitron/Orbitron-Medium.ttf", bold: "Orbitron/Orbitron-Bold.ttf" }, "M PLUS Rounded 1c": { regular: "M_PLUS_Rounded_1c/MPLUSRounded1c-Regular.ttf", bold: "M_PLUS_Rounded_1c/MPLUSRounded1c-Bold.ttf" } }
    },
    "Ghibli": {
        titleFontFamily: "Caveat Brush", bodyFontFamily: "Merriweather Sans",
        files: { "Caveat Brush": { regular: "Caveat_Brush/CaveatBrush-Regular.ttf" }, "Merriweather Sans": { regular: "Merriweather_Sans/MerriweatherSans-Regular.ttf", bold: "Merriweather_Sans/MerriweatherSans-Bold.ttf" } }
    },
    "Fotorealistyczny": {
        titleFontFamily: "Anton", bodyFontFamily: "Roboto",
        files: { "Anton": { regular: "Anton/Anton-Regular.ttf" }, "Roboto": { regular: "Roboto/Roboto-Regular.ttf", bold: "Roboto/Roboto-Bold.ttf" } }
    }
};

async function getFormattedTitle(title) {
    if (!title || title.trim() === "" || title.includes('<br>')) return title;
    if (title.length < 25) return title;
    const prompt = `You are an expert book cover designer and typographer. Your task is to take a book title and format it for a cover by inserting a single <br> tag for the most aesthetically pleasing and logical line break. Return ONLY the formatted title with the <br> tag. Example: 'Podróż do Krainy Zaczarowanych Instrumentów' -> 'Podróż do Krainy<br>Zaczarowanych Instrumentów'. Now, format this title: "${title}"`;
    try {
        const res = await fetch(`${TEXT_API_URL}/v1/chat/completions`, {
            method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 50 }),
        });
        if (!res.ok) { console.error("Error formatting title (LLM API error):", await res.text()); return title; }
        const data = await res.json();
        const formattedTitle = data.choices?.[0]?.message?.content.trim();
        if (formattedTitle && formattedTitle.includes('<br>')) { return formattedTitle; }
        return title;
    } catch (error) { console.error("Exception formatting title:", error); return title; }
}

async function getFontAsBase64(fontPath) {
    try {
        const fullPath = path.join(process.cwd(), 'public', 'fonts', fontPath);
        const fontBuffer = await fs.readFile(fullPath);
        return fontBuffer.toString('base64');
    } catch (error) { console.error(`Could not read font file at: ${fontPath}`); return null; }
}

async function getDeclinedNameInPolish(name, caseType = "dla_kogo") {
    if (!name || name.trim() === "") return "";
    let caseDescription = "";
    if (caseType === "dla_kogo") caseDescription = "dative/genitive case used after 'dla' (for)";
    else if (caseType === "o_przygodach_kogo") caseDescription = "genitive case for 'opowieść o przygodach KOGO' (story of X's adventures)";
    else if (caseType === "kogo_czego_dopełniacz") caseDescription = "genitive case (kogo? czego?)";
    else return name;
    const prompt = `You are a Polish grammar expert. Given the Polish first name "${name}", return ONLY the correctly declined form. Example: "Anna" for "dla" -> "Anny". Declined form for "${name}":`;
    try {
        const res = await fetch(`${TEXT_API_URL}/v1/chat/completions`, {
            method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 20 }),
        });
        if (!res.ok) { console.error("Error declining name (LLM API error):", await res.text()); return name; }
        const data = await res.json();
        const declinedName = data.choices?.[0]?.message?.content.trim().replace(/[."]/g, '');
        return declinedName && declinedName.length > 0 ? declinedName : name;
    } catch (error) { console.error("Exception declining name:", error); return name; }
}

async function getPdfStyles(fontSet) {
    let fontFaces = "";
    if (fontSet && fontSet.files) {
        for (const fontFamily in fontSet.files) {
            for (const fontWeightStyleKey in fontSet.files[fontFamily]) {
                const filePath = fontSet.files[fontFamily][fontWeightStyleKey];
                const fontBase64 = await getFontAsBase64(filePath);
                if (fontBase64) {
                    let weight = 400; let style = "normal";
                    const keyLower = fontWeightStyleKey.toLowerCase();
                    if (keyLower.includes("extralight")) weight = 200; else if (keyLower.includes("light")) weight = 300; else if (keyLower.includes("regular")) weight = 400; else if (keyLower.includes("medium")) weight = 500; else if (keyLower.includes("semibold")) weight = 600; else if (keyLower.includes("bold")) weight = 700; else if (keyLower.includes("extrabold")) weight = 800; else if (keyLower.includes("black")) weight = 900;
                    if (keyLower.includes("italic")) style = "italic";
                    fontFaces += `@font-face { font-family: '${fontFamily}'; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); font-weight: ${weight}; font-style: ${style}; }\n`;
                }
            }
        }
    }

    return `
    <style>
      ${fontFaces}
      
      /* --- 1. USTAWIENIA GLOBALNE I PODSTAWOWE --- */
      @page { margin: 0; }
      body { font-family: "${fontSet.bodyFontFamily || "EB Garamond"}", serif; font-size: 11.5pt; line-height: 1.65; color: #34495e; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
      .page { page-break-after: always; width: 100%; height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; position: relative; padding: 18mm 13mm 20mm 13mm; }
      .page:not(.cover):not(.story-page) { border: 1px solid #e0e0e0; }
      .page:last-child { page-break-after: auto; }

      /* --- 2. OKŁADKA --- */
      .cover { background-size: cover; background-position: center center; justify-content: flex-end; align-items: flex-start; padding: 20mm 20mm 10mm 14mm; }
      .cover .cover-text-wrapper { text-align: left; }
      .cover .cover-title { font-family: "${fontSet.titleFontFamily || "Luckiest Guy"}", cursive; font-size: 32pt; line-height: 1.3; color: #FFFFFF; text-shadow: 3px 3px 0px rgba(45, 60, 45, 0.7), -1px -1px 0 rgba(45, 60, 45, 0.7), 1px -1px 0 rgba(45, 60, 45, 0.7), -1px 1px 0 rgba(45, 60, 45, 0.7), 1px 1px 0 rgba(45, 60, 45, 0.7); margin-bottom: 1mm; }
      .cover .cover-child-dedication { font-family: "Pacifico", cursive; font-size: 18pt; color: #FCEE8D; text-shadow: 1.5px 1.5px 3px rgba(40, 50, 40, 0.9); }
      
      /* --- 3. WEWNĘTRZNA STRONA TYTUŁOWA --- */
      .title-page { justify-content: center; align-items: center; text-align: center; }
      .title-page h1 { font-family: "Pacifico", cursive; font-size: 42pt; margin-bottom: 8mm; color: #2c3e50; }
      .title-page .subtitle { font-family: "${fontSet.bodyFontFamily || "EB Garamond"}", serif; font-size: 15pt; font-style: italic; color: #555; margin-bottom: 25mm; max-width: 75%; }
      .title-page .logo-placeholder { position: absolute; bottom: 20mm; left: 0; right: 0; font-size: 9pt; color: #b0b0b0; }
      
      /* --- 4. STRONA "TA KSIĄŻKA NALEŻY DO..." --- */
      .ownership-page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
      .ownership-page .belongs-to { font-family: "${fontSet.bodyFontFamily}", serif; font-size: 14pt; font-style: italic; color: #555; margin-bottom: 8mm; }
      .ownership-page .child-name-line { font-family: "${fontSet.titleFontFamily || "Luckiest Guy"}", cursive; font-size: 28pt; color: #2c3e50; border-bottom: 2px dotted #cccccc; padding: 0 10mm 4mm 10mm; min-width: 60%; margin-bottom: 8mm; white-space: nowrap; }
      .ownership-page .adventure-seeker { font-family: "${fontSet.bodyFontFamily || "EB Garamond"}", serif; font-size: 12pt; color: #7f8c8d; }
      
      /* --- 5. STRONA Z DEDYKACJĄ --- */
      .dedication-page { justify-content: center; align-items: center; text-align: center; font-size: 13pt; font-style: italic; padding: 15% 10%; color: #34495e; line-height: 1.8; }
      .dedication-page div { max-width: 80%; }
      
      /* --- 6. STRONY Z TREŚCIĄ BAJKI --- */
      .story-page { background-size: cover; background-position: center center; align-items: center; justify-content: flex-end; border: none !important; padding: 0; }
      .story-page::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 40%; background: linear-gradient(to top, rgba(255, 255, 255, 1) 30%, rgba(255, 255, 255, 0) 100%); z-index: 1; pointer-events: none; }
      .story-page .text-content { position: relative; z-index: 2; width: calc(100% - 20mm); max-height: 30%; margin-bottom: -10mm; padding: 15mm 12mm; font-size: 11.9pt; text-align: justify; color: #2c3e50; overflow-y: auto; }
      .story-page .text-content p { margin-top: 0; margin-bottom: 0.7em; }
      .story-page .text-content p + p { text-indent: 1.5em; }
      .story-page .text-content p:first-of-type::first-letter { font-family: "Dancing Script", cursive; font-size: 3.5em; float: left; line-height: 0.8; margin-right: 0.07em; margin-top: 0.05em; color: #34495e; }
      
      /* --- 7. STRONA KOŃCOWA --- */
      .ending-page { justify-content: center; align-items: center; text-align: center; }
      .ending-page .the-end-text { font-family: "${fontSet.titleFontFamily || "Luckiest Guy"}", cursive; font-size: 34pt; color: #34495e; margin-bottom: 10mm; }
      .ending-page .thank-you-text { font-family: "${fontSet.bodyFontFamily || "EB Garamond"}", serif; font-size: 12pt; color: #555; margin-bottom: 20mm; }
      .ending-page .logo-placeholder-ending { font-size: 10pt; color: #b0b0b0; }
    </style>
  `;
}

const escapeHtml = (unsafe) => unsafe?.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") || '';

function generateCoverHtml(title, coverImageUrl, childNameDeclinedForCover) {
    return `<div class="page cover" style="background-image: url('${escapeHtml(coverImageUrl)}');"><div class="cover-text-wrapper"><div class="cover-title">${title}</div>${childNameDeclinedForCover ? `<div class="cover-child-dedication">Specjalnie dla ${escapeHtml(childNameDeclinedForCover)}</div>` : ''}</div></div>`;
}

function generateTitlePageHtml(title, childNameDeclinedForSubtitle, logoPlaceholderText = "Twoja Personalizowana Bajka") {
    const cleanTitle = title.replace(/<br>/g, ' ');
    const subtitle = `Niezwykła, personalizowana opowieść o przygodach ${escapeHtml(childNameDeclinedForSubtitle)}`;
    return `<div class="page content-page title-page"><h1>${escapeHtml(cleanTitle)}</h1><p class="subtitle">${subtitle}</p><div class="logo-placeholder">${escapeHtml(logoPlaceholderText)}</div></div>`;
}

function generateOwnershipPageHtml(childNameDeclinedGenitive) {
    return `<div class="page content-page ownership-page"><p class="belongs-to">Ta magiczna książeczka jest pełna przygód i należy do</p><div class="child-name-line">${escapeHtml(childNameDeclinedGenitive)}</div><p class="adventure-seeker">wielkiego odkrywcy i marzyciela!</p></div>`;
}

function generateDedicationPageHtml(dedicationText) {
    if (!dedicationText || dedicationText.trim() === "") return '';
    const cleanedDedication = dedicationText.replace(/^\$+|\$+$/g, '').trim();
    const paragraphs = cleanedDedication.split('\n').map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
    return `<div class="page content-page dedication-page"><div>${paragraphs}</div></div>`;
}

function generateStoryPageHtml(fragmentText, imageUrl) {
    const formattedText = fragmentText.split(/\n\s*\n|\n(?=\s*[A-ZĄĆĘŁŃÓŚŹŻ])|\n(?=\s*•)/g).map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const imageHtmlPlaceholder = `<div class="page content-page" style="display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; background:#fafafa;">( Ilustracja dla tej strony nie została wygenerowana )<div class="text-content" style="margin-top:20px; width:100%;">${formattedText}</div></div>`;
    if (!imageUrl) { return imageHtmlPlaceholder; }
    return `<div class="page story-page" style="background-image: url('${escapeHtml(imageUrl)}');"><div class="text-content">${formattedText}</div></div>`;
}

function generateEndingPageHtml(logoPlaceholderText = "Dziękujemy za wspólną przygodę!") {
    return `<div class="page content-page ending-page"><div class="the-end-text">Koniec</div><div class="thank-you-text">${escapeHtml(logoPlaceholderText)}</div><div class="logo-placeholder-ending">Twoja Personalizowana Bajka</div></div>`;
}

async function generateFullHtmlForBook(bookData, fontSet) {
    const formattedTitle = await getFormattedTitle(bookData.storyTitle);
    const childNameNominative = bookData.childName;
    const childNameDeclinedForCover = await getDeclinedNameInPolish(childNameNominative, "dla_kogo");
    const childNameDeclinedForSubtitle = await getDeclinedNameInPolish(childNameNominative, "o_przygodach_kogo");
    const childNameDeclinedGenitive = await getDeclinedNameInPolish(childNameNominative, "kogo_czego_dopełniacz");
    const coverImageObj = bookData.generatedImages ? bookData.generatedImages[0] : null;
    const coverImageUrl = coverImageObj && coverImageObj.url && !coverImageObj.url.includes("placehold.co") ? coverImageObj.url : `https://placehold.co/1024x1024/a9a9a9/ffffff?text=Brak%20okładki`;
    
    let htmlString = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>${escapeHtml(bookData.storyTitle.replace(/<br>/g, ' '))}</title>${await getPdfStyles(fontSet)}</head><body>`;
    htmlString += generateCoverHtml(formattedTitle, coverImageUrl, childNameDeclinedForCover);
    htmlString += generateTitlePageHtml(bookData.storyTitle, childNameDeclinedForSubtitle, "Stworzone przez Twoja Personalizowana Bajka");
    htmlString += generateOwnershipPageHtml(childNameDeclinedGenitive);
    if (bookData.dedication && bookData.dedication.trim() !== "") { htmlString += generateDedicationPageHtml(bookData.dedication); }
    (bookData.fragments || []).forEach((fragment, index) => {
        const imageObj = bookData.generatedImages ? bookData.generatedImages[index + 1] : null;
        const imageUrlForPage = imageObj && imageObj.url && !imageObj.url.includes("placehold.co") ? imageObj.url : null;
        htmlString += generateStoryPageHtml(fragment, imageUrlForPage);
    });
    htmlString += generateEndingPageHtml();
    htmlString += `</body></html>`;
    return htmlString;
}

async function generatePdfBufferWithPuppeteer(htmlContent, bookProportion) {
    let browser = null;
    try {
        console.log("--- ROZPOCZYNAM GENEROWANIE PDF ---");

        // INTELIGENTNE WYKRYWANIE ŚRODOWISKA
        if (process.env.K_SERVICE) {
            // --- LOGIKA PRODUKCYJNA (GOOGLE CLOUD RUN) ---
            console.log("[PROD] Uruchamiam w środowisku Google Cloud.");
            const chromium = (await import('@sparticuz/chromium')).default;
            const puppeteer = (await import('puppeteer-core')).default;

            // Usunęliśmy wadliwą linię 'chromium.font(...)'

           let executablePath = await chromium.executablePath;
if (!executablePath) {
  console.warn("⚠️ executablePath jest null – ustawiam fallback na '/usr/bin/chromium-browser'");
  executablePath = "/usr/bin/chromium-browser";
}
            console.log(`[PROD] Uzyskano ścieżkę do przeglądarki: ${executablePath}`);

            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: executablePath,
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            });

        } else {
            // --- LOGIKA LOKALNA (TWÓJ KOMPUTER) ---
            console.log("Uruchamiam w trybie deweloperskim z lokalnym Puppeteer...");
            const puppeteer = (await import('puppeteer')).default;
            browser = await puppeteer.launch({
                headless: true
            });
        }

        console.log("Przeglądarka uruchomiona pomyślnie.");
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        console.log("Wstawiono treść HTML do strony.");
        
        let pdfOptions = { 
            printBackground: true, 
            margin: { top: '0', right: '0', bottom: '0', left: '0' } 
        };
        
        if (bookProportion === "square") { pdfOptions.width = '210mm'; pdfOptions.height = '210mm'; }
        else if (bookProportion === "portrait") { pdfOptions.format = 'A5'; } 
        else if (bookProportion === "landscape") { pdfOptions.width = '210mm'; pdfOptions.height = '148mm'; } 
        else { pdfOptions.format = 'A5'; }

        console.log("Próbuję wygenerować bufor PDF...");
        const pdfBuffer = await page.pdf(pdfOptions);
        console.log("Bufor PDF wygenerowany pomyślnie.");
        return pdfBuffer;

    } catch (error) {
        console.error("❌ KRYTYCZNY BŁĄG W generatePdfBufferWithPuppeteer:", error);
        if (error instanceof Error) {
            console.error("STACK TRACE BŁĘDU:", error.stack);
        }
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log("Przeglądarka została zamknięta.");
        }
    }
}

export async function POST(req) {
    try {
        const { searchParams } = new URL(req.url);
        const isPreview = searchParams.get('preview') === 'html';
        if (!OPENAI_API_KEY) { throw new Error("Missing OPENAI_API_KEY configuration on the server."); }
        const bookData = await req.json();
        if (!bookData || !bookData.storyTitle || !bookData.fragments || !bookData.generatedImages || !bookData.childName || !bookData.selectedStyle || !bookData.bookProportion) {
            return NextResponse.json({ success: false, error: "Incomplete book data for PDF generation." }, { status: 400 });
        }
        const fontSet = STYLE_TO_FONT_SET_MAP[bookData.selectedStyle] || STYLE_TO_FONT_SET_MAP["Bajkowy pastelowy (domyślny)"];
        const htmlContent = await generateFullHtmlForBook(bookData, fontSet);
        if (isPreview) {
            return new Response(htmlContent, { status: 200, headers: { 'Content-Type': 'text/html' }, });
        }
        const pdfBuffer = await generatePdfBufferWithPuppeteer(htmlContent, bookData.bookProportion);
        if (!pdfBuffer) throw new Error("Failed to generate PDF buffer.");
        const safeFileName = (bookData.storyTitle || "moja-ksiazeczka").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').toLowerCase() + ".pdf";
        return new NextResponse(pdfBuffer, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${safeFileName}"` }, });
    } catch (err) {
        console.error("❌ Error in /api/generate-pdf:", err);
        const errorMessage = err instanceof Error ? err.message : "Unexpected server error during PDF generation.";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}