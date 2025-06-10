"use client";

import React, { useState, useEffect } from 'react';
import {
  UserIcon, CalendarIcon, PhotoIcon, CameraIcon, SparklesIcon,
  BookOpenIcon, PaintBrushIcon, PencilIcon, ArrowRightIcon,
  ArrowLeftIcon, CheckIcon, LightBulbIcon, GiftIcon
} from "@heroicons/react/24/solid";

// --- NOWA FUNKCJA POMOCNICZA DO PONAWIANIA PRÓB (z poprawnymi typami) ---
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 3000): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      throw new Error(`Server error: ${response.status}`);
    } catch (error) {
      console.log(`Próba ${i + 1} nie powiodła się. Ponawiam za ${delay / 1000}s...`);
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Nie udało się wykonać zapytania po kilku próbach.");
};

// --- Stałe konfiguracyjne ---
const themesByCategory: { [key: string]: { icon: JSX.Element; themes: string[] } } = {
  "Przygoda": {
    icon: <SparklesIcon className="w-6 h-6 mr-3 text-amber-500" />,
    themes: ["Przygoda w kosmosie", "Podwodny świat", "Wyścig przez dżunglę", "Safari w Afryce z magicznym jeepem", "Wyprawa w czasie – poznajemy dinozaury"]
  },
  "Magia i baśnie": {
    icon: <SparklesIcon className="w-6 h-6 mr-3 text-violet-500" />,
    themes: ["Wyprawa do magicznego lasu", "Szkoła magii i czarów", "Latający dywan i dżin z lampy", "Tajemniczy zamek na szczycie góry", "Czarnoksiężnik i zagubiona księga zaklęć"]
  },
  "Superbohaterowie i science-fiction": {
    icon: <BookOpenIcon className="w-6 h-6 mr-3 text-sky-500" />,
    themes: ["Superbohater ratuje świat", "Mały wynalazca i jego robot", "Avengers: Misja specjalna", "Star Wars: Młody Jedi kontra Imperium"]
  },
  "Zwierzęta i natura": {
    icon: <BookOpenIcon className="w-6 h-6 mr-3 text-green-500" />,
    themes: ["Przygoda w świecie baśniowych zwierząt", "Zwierzaki z tajemniczego lasu", "Mały kotek i jego wielka przygoda", "Dziecko, które rozumiało język zwierząt", "Przygoda wśród owadów w ogrodzie"]
  },
  "Emocje i wartości": {
    icon: <BookOpenIcon className="w-6 h-6 mr-3 text-rose-500" />,
    themes: ["Mały bohater i jego pierwsza lekcja odwagi", "W świecie emocji – podróż przez smutek i radość", "Ekologiczna przygoda: ratujemy planetę", "Tajemnice ciała człowieka – bajka od środka"]
  }
};

const graphicStyles = [
  { name: "Bajkowy pastelowy (domyślny)", imageSrc: "https://placehold.co/200x150/d1d5db/6b7280?text=Pastel" },
  { name: "Disney/Pixar", imageSrc: "https://placehold.co/200x150/f9a8d4/c026d3?text=Disney" },
  { name: "Płaski i minimalistyczny", imageSrc: "https://placehold.co/200x150/a5b4fc/4338ca?text=Flat" },
  { name: "Akwarela", imageSrc: "https://placehold.co/200x150/bae6fd/075985?text=Watercolor" },
  { name: "Komiksowy", imageSrc: "https://placehold.co/200x150/fde047/b45309?text=Comic" },
  { name: "Anime", imageSrc: "https://placehold.co/200x150/fecaca/991b1b?text=Anime" },
  { name: "Ghibli", imageSrc: "https://placehold.co/200x150/bbf7d0/166534?text=Ghibli" },
  { name: "Fotorealistyczny", imageSrc: "https://placehold.co/200x150/6b7280/111827?text=Realistic" },
];

const bookProportionsOptions = [
    { value: "square", label: "Kwadrat" },
    { value: "portrait", label: "Portret" },
    { value: "landscape", label: "Krajobraz" }
];

const steps = [
    { number: 1, title: "O dziecku i formacie" },
    { number: 2, title: "Fabuła" },
    { number: 3, title: "Styl i dedykacja" },
    { number: 4, title: "Podsumowanie" }
];

export default function BookForm() {
  const [step, setStep] = useState(1);
  const [childName, setChildName] = useState("");
  const [age, setAge] = useState(""); 
  const [storyTheme, setStoryTheme] = useState("");
  const [customStoryTheme, setCustomStoryTheme] = useState("");
  const [dedication, setDedication] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Bajkowy pastelowy (domyślny)");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); 
  const [response, setResponse] = useState<any | null>(null); 
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(Object.keys(themesByCategory)[0]);
  const [bookProportion, setBookProportion] = useState("square"); 
  const [loadingRandomTheme, setLoadingRandomTheme] = useState(false);
  const [loadingDedication, setLoadingDedication] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyTheme) {
      const firstCategory = Object.keys(themesByCategory)[0];
      if (firstCategory && themesByCategory[firstCategory].themes.length > 0) {
          setStoryTheme(themesByCategory[firstCategory].themes[0]);
      }
    }
  }, []); 

  useEffect(() => {
    if (customStoryTheme.trim() !== "") {
      setStoryTheme("Własna opowieść");
    } else if (storyTheme === "Własna opowieść" && customStoryTheme.trim() === "") { 
        const firstCategory = Object.keys(themesByCategory)[0];
        if (firstCategory && themesByCategory[firstCategory].themes.length > 0) {
            setStoryTheme(themesByCategory[firstCategory].themes[0]);
        }
    }
  }, [customStoryTheme, storyTheme]); 

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    setIsMobile(/android|iphone|ipad|ipod/i.test(userAgent));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSurpriseClick = async () => {
    setLoadingRandomTheme(true);
    try {
      const requestBody: { age?: string } = {};
      if (age.trim()) { 
          requestBody.age = age;
      }
      const res = await fetch('/api/generate-random-theme', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody) 
      });
      if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Nie udało się odczytać błędu serwera."}));
          throw new Error(errorData.error || 'Nie udało się wygenerować losowego tematu.');
      }
      const data = await res.json();
      if (data.theme) {
        setCustomStoryTheme(data.theme);
      } else {
        throw new Error('API nie zwróciło tematu.');
      }
    } catch (error) {
      console.error("Error generating random theme:", error);
      alert(error instanceof Error ? error.message : "Przepraszamy, nie udało się wygenerować losowego tematu. Spróbuj ponownie.");
    } finally {
      setLoadingRandomTheme(false);
    }
  };

  const handleGenerateDedication = async () => {
    if (!childName.trim() || !age.trim()) {
        alert("Proszę najpierw podać imię i wiek dziecka, aby trafniej wygenerować dedykację.");
        return;
    }
    setLoadingDedication(true);
    try {
      const finalCurrentTheme = customStoryTheme.trim() !== "" ? customStoryTheme.trim() : storyTheme;
      const res = await fetch('/api/generate-dedication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            childName: childName.trim(), 
            age: age.trim(), 
            storyTheme: finalCurrentTheme 
        }),
      });
      if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Nie udało się odczytać błędu serwera."}));
          throw new Error(errorData.error || 'Nie udało się wygenerować dedykacji.');
      }
      const data = await res.json();
      if (data.dedication) {
        setDedication(data.dedication);
      } else {
        throw new Error('API nie zwróciło dedykacji.');
      }
    } catch (error) {
      console.error("Error generating dedication:", error);
      alert(error instanceof Error ? error.message : "Przepraszamy, nie udało się wygenerować dedykacji. Spróbuj ponownie.");
    } finally {
      setLoadingDedication(false);
    }
  };

  const handleSubmit = async () => { 
    console.log("handleSubmit WYWOŁANY przez kliknięcie dedykowanego przycisku");
    const finalTheme = customStoryTheme.trim() !== "" ? customStoryTheme : storyTheme;

    if (!childName.trim() || !age.trim() || !image || !bookProportion) { 
      alert("Proszę wypełnić wszystkie dane dziecka (imię, wiek, format, zdjęcie).");
      setStep(1); 
      return;
    }
    if (!finalTheme || finalTheme.trim() === "" || (storyTheme === "Własna opowieść" && !customStoryTheme.trim())) {
        alert("Proszę wybrać temat bajki lub wpisać własny pomysł.");
        setStep(2); 
        return;
    }

    setLoading(true);
    setResponse(null); 
    setError(null);
    const formData = new FormData();
    formData.append("childName", childName);
    formData.append("ageGroup", age); 
    formData.append("storyTheme", finalTheme);
    formData.append("dedication", dedication);
    formData.append("selectedStyle", selectedStyle);
    formData.append("images", image);
    try {
      const res = await fetchWithRetry("/api/generate-all-images", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Wystąpił nieznany błąd serwera podczas generowania treści.");
      setResponse(data); 
      console.log("Sukces! Otrzymano dane książki:", data);
      setPaymentStatus(null); 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Wystąpił nieznany błąd.";
      console.error("Błąd podczas generowania treści książki: ", errorMessage);
      setError("Błąd podczas generowania treści książki: " + errorMessage);
      alert("Błąd podczas generowania treści książki: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePdfDownload = async () => {
      if (!response || paymentStatus !== 'success') { 
          alert("Płatność nie została zakończona lub wystąpił błąd danych książki.");
          return;
      }
      setLoading(true); 
      setError(null);
      try {
          const pdfRequestData = {
              storyTitle: response.storyTitle, fragments: response.fragments,
              generatedImages: response.generatedImages, dedication: response.dedication, 
              childName: childName, selectedStyle: selectedStyle, 
              bookProportion: bookProportion, age: age 
          };
          
          const pdfRes = await fetchWithRetry("/api/generate-pdf", { 
              method: "POST", headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pdfRequestData),
          });

          if (!pdfRes.ok) {
              const errorData = await pdfRes.json().catch(() => ({error: "Nie udało się odczytać błędu serwera PDF."}));
              throw new Error(errorData.error || "Nie udało się wygenerować pliku PDF.");
          }
          const blob = await pdfRes.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          const fileName = (response.storyTitle || "ksiazeczka").replace(/[^\p{L}\p{N}_]+/gu, '_').toLowerCase() + ".pdf";
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Wystąpił nieznany błąd.";
          console.error("Błąd podczas pobierania PDF: ", errorMessage);
          setError("Błąd podczas pobierania PDF: " + errorMessage);
          alert("Błąd podczas pobierania PDF: " + errorMessage);
      } finally {
          setLoading(false);
      }
  };

  const resetFormAndBook = () => {
    setResponse(null); setStep(1); setChildName(""); setAge("");
    const firstCategory = Object.keys(themesByCategory)[0];
    if (firstCategory && themesByCategory[firstCategory].themes.length > 0) {
        setStoryTheme(themesByCategory[firstCategory].themes[0]);
    } else { setStoryTheme(""); }
    setCustomStoryTheme(""); setDedication(""); setSelectedStyle("Bajkowy pastelowy (domyślny)");
    setImage(null); setImagePreview(null); setExpandedCategory(firstCategory);
    setBookProportion("square"); setShowPaymentModal(false); setPaymentStatus(null); setUserEmail("");
  };
  
  const prevStep = () => setStep(s => Math.max(s - 1, 1)); 

  const nextStep = () => {
    if (step === 1) {
      if (!childName.trim() || !age.trim() || !image || !bookProportion) {
        alert("Proszę wypełnić wszystkie pola (imię, wiek, format książki) i wgrać zdjęcie, aby przejść dalej.");
        return; 
      }
    }
    if (step === 2) {
      const finalThemeToValidate = customStoryTheme.trim() !== "" ? customStoryTheme.trim() : storyTheme;
      if (!finalThemeToValidate || finalThemeToValidate.trim() === "") { 
          alert("Proszę wybrać temat bajki lub wpisać własny pomysł, aby przejść dalej.");
          return; 
      }
      if (storyTheme === "Własna opowieść" && !customStoryTheme.trim()) {
        alert("Proszę wpisać własny temat bajki lub wybrać gotowy pomysł.");
        return;
      }
    }
    setStep((s: number) => Math.min(s + 1, steps.length)); 
  };
  
  const handleProceedToPayment = () => { setShowPaymentModal(true); };

  return (
    <div className="w-full max-w-5xl mx-auto mt-10 p-6 sm:p-8 bg-white/80 rounded-3xl shadow-2xl backdrop-blur-xl border border-gray-200 text-gray-900">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 text-center">Stwórz wyjątkową książkę</h1>
      
      {!response ? (
        <>
          <p className="text-center text-gray-500 mb-8">Wypełnij formularz w kilku prostych krokach</p>
          <div className="mb-10 px-4">
            <div className="flex items-center">
              {steps.map((s, index) => (
                <React.Fragment key={s.number}>
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${step >= s.number ? 'bg-violet-600 text-white' : 'bg-gray-200'}`}>
                      {step > s.number ? <CheckIcon className="w-6 h-6" /> : <span className={`${step >= s.number ? 'text-white' : 'text-gray-500'}`}>{s.number}</span>}
                    </div>
                    <p className={`mt-2 text-xs sm:text-sm text-center ${step >= s.number ? 'font-semibold text-violet-700' : 'text-gray-500'}`}>{s.title}</p>
                  </div>
                  {index < steps.length - 1 && ( <div className={`flex-1 h-1 transition-all duration-300 mx-2 ${step > index + 1 ? 'bg-violet-600' : 'bg-gray-200'}`}></div> )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* === KOD JSX FORMULARZA (POZOSTAWIONY W CAŁOŚCI) === */}
          <div className="space-y-8">
            {step === 1 && (
              <div className="animate-fade-in space-y-8">
                <div> <label className="font-semibold text-gray-700 block mb-2">Imię dziecka</label> <div className="relative"> <UserIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"/> <input type="text" value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="np. Zosia" className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition" /> </div> </div>
                <div> <label className="font-semibold text-gray-700 block mb-2">Wiek dziecka</label> <div className="relative"> <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"/> <input type="text" inputMode="numeric" pattern="\d*" value={age} onChange={(e) => { const newAge = e.target.value; if (/^\d*$/.test(newAge) && (newAge === "" || (parseInt(newAge) >= 1 && parseInt(newAge) <= 18))) { setAge(newAge); }}} placeholder="Wiek (np. 5)" className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent rounded-xl shadow-sm appearance-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition" /> </div> </div>
                <div> <label className="font-semibold text-gray-700 block mb-2">Wybierz format książeczki:</label> <div className="flex flex-wrap gap-4 justify-center sm:justify-start"> {bookProportionsOptions.map(prop => ( <button key={prop.value} type="button" onClick={() => setBookProportion(prop.value)} className={`p-3 border-2 rounded-lg flex flex-col items-center justify-center w-28 h-28 sm:w-32 sm:h-32 transition-all focus:outline-none ${bookProportion === prop.value ? 'border-violet-500 bg-violet-100 shadow-lg ring-2 ring-violet-500' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}`}> <div className="flex items-center justify-center mb-2"> {prop.value === "square" && <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-400 border-2 border-gray-500 rounded"></div>} {prop.value === "portrait" && <div className="w-8 h-10 sm:w-10 sm:h-12 bg-gray-400 border-2 border-gray-500 rounded"></div>} {prop.value === "landscape" && <div className="w-12 h-8 sm:w-14 sm:h-10 bg-gray-400 border-2 border-gray-500 rounded"></div>} </div> <span className={`text-sm font-medium ${bookProportion === prop.value ? 'text-violet-700' : 'text-gray-600'}`}>{prop.label}</span> </button> ))} </div> </div>
                <div> <label className="font-semibold text-gray-700 block mb-2">Zdjęcie głównego bohatera</label> <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-violet-400 transition"> <PhotoIcon className="w-12 h-12 text-gray-400 mb-2"/> <span className="font-semibold text-violet-600">Kliknij, aby wybrać plik</span> <p className="text-sm text-gray-500 mt-1">lub przeciągnij i upuść</p> <input id="file-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" /> </label> {isMobile && ( <button type="button" onClick={() => (document.getElementById('camera-input') as HTMLInputElement)?.click()} className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-xl hover:bg-gray-300 transition"> <CameraIcon className="w-5 h-5"/> Zrób zdjęcie telefonem </button> )} <input id="camera-input" type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" /> {imagePreview && ( <div className="mt-4 text-center"> <p className="text-sm text-gray-600 mb-2">Podgląd:</p> <img src={imagePreview} alt="Podgląd zdjęcia" className="w-32 h-32 object-cover rounded-xl mx-auto border-4 border-white shadow-lg"/> </div> )} </div>
              </div>
            )}
            {step === 2 && (
              <div className="animate-fade-in space-y-6">
                <div> <label className="font-semibold text-gray-700 block mb-2">Wybierz gotowy pomysł lub stwórz własny</label> {Object.entries(themesByCategory).map(([category, {icon, themes}]) => ( <div key={category} className="mb-2"> <button type="button" onClick={() => setExpandedCategory(expandedCategory === category ? null : category)} className="text-lg font-semibold w-full text-left flex items-center bg-gray-100 px-4 py-3 rounded-xl shadow-sm hover:bg-gray-200 transition text-gray-800"> {icon} {category} <span className="ml-auto transform transition-transform">{expandedCategory === category ? "▾" : "▸"}</span> </button> {expandedCategory === category && ( <div className="flex flex-wrap gap-2 mt-3 p-2 animate-fade-in"> {themes.map((theme, idx) => ( <button key={idx} type="button" onClick={() => { setCustomStoryTheme(""); setStoryTheme(theme); }} className={`px-4 py-2 rounded-full border-2 shadow-sm transition-all text-sm ${storyTheme === theme ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-white text-gray-800 hover:bg-violet-50 hover:border-violet-300 border-gray-200"}`}> {theme} </button> ))} </div> )} </div> ))} </div>
                <div className="flex items-center gap-4"> <div className="flex-grow border-t border-gray-200"></div> <span className="text-gray-500 text-sm">LUB</span> <div className="flex-grow border-t border-gray-200"></div> </div>
                <div> <label className="font-semibold text-gray-700 block mb-2">Wpisz własny temat</label> <div className="relative"> <PencilIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"/> <input type="text" value={customStoryTheme} onChange={(e) => setCustomStoryTheme(e.target.value)} placeholder="np. smok, kosmos, magia" className="w-full p-4 pl-12 bg-gray-50 border-2 border-transparent rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition" /> </div> </div>
                <button type="button" onClick={handleSurpriseClick} disabled={loadingRandomTheme} className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold px-5 py-3 shadow-lg hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-70"> {loadingRandomTheme ? <><LightBulbIcon className="w-5 h-5 animate-pulse"/> Myślę...</> : <><SparklesIcon className="w-5 h-5"/> Zaskocz mnie!</> } </button>
              </div>
            )}
            {step === 3 && (
              <div className="animate-fade-in space-y-8">
                <div> <label className="font-semibold text-gray-700 block mb-2">Wybierz styl graficzny ilustracji</label> <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"> {graphicStyles.map((style) => ( <div key={style.name} onClick={() => setSelectedStyle(style.name)} className={`cursor-pointer rounded-2xl p-2 border-4 transition-all duration-200 ${selectedStyle === style.name ? 'border-violet-500 shadow-lg' : 'border-transparent hover:border-violet-200'}`}> <img src={style.imageSrc} alt={style.name} className="w-full h-24 object-cover rounded-xl shadow-md"/> <p className={`text-center text-xs sm:text-sm mt-2 font-medium ${selectedStyle === style.name ? 'text-violet-700' : 'text-gray-600'}`}>{style.name}</p> </div> ))} </div> </div>
                <div> <label className="font-semibold text-gray-700 block mb-2">Dedykacja (opcjonalnie)</label> <textarea value={dedication} onChange={(e) => setDedication(e.target.value)} placeholder="Dla Kochanej Zosi, z okazji 5. urodzin..." className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition" rows={4} /> <button type="button" onClick={handleGenerateDedication} disabled={loadingDedication} className="mt-3 flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-semibold disabled:opacity-70"> {loadingDedication ? <><LightBulbIcon className="w-5 h-5 animate-pulse"/> Tworzę dedykację...</> : <><GiftIcon className="w-5 h-5"/> Wygeneruj dla mnie dedykację</>} </button> </div>
              </div>
            )}
            {step === 4 && (
              <div className="animate-fade-in space-y-6 bg-slate-50 p-6 rounded-2xl">
                <h2 className="text-2xl font-bold text-center text-gray-800">Podsumowanie</h2>
                <div className="grid md:grid-cols-2 gap-6 text-gray-700">
                  <div className="flex flex-col items-center"> {imagePreview && <img src={imagePreview} alt="Podgląd" className="w-32 h-32 object-cover rounded-full border-4 border-white shadow-lg mb-4"/>} <p><strong>Imię:</strong> {childName}</p> <p><strong>Wiek:</strong> {age} lat</p> <p><strong>Format:</strong> {bookProportionsOptions.find(p => p.value === bookProportion)?.label || bookProportion}</p> </div>
                  <div className="space-y-2"> <p><strong>Temat:</strong> {customStoryTheme.trim() || storyTheme}</p> <p><strong>Styl graficzny:</strong> {selectedStyle}</p> {dedication && <p><strong>Dedykacja:</strong> "{dedication}"</p>} </div>
                </div>
                <p className="text-center text-sm text-gray-500 pt-4">Sprawdź, czy wszystkie informacje są poprawne.</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-6">
              {step > 1 ? ( <button type="button" onClick={prevStep} className="flex items-center gap-2 bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-300 transition-colors"> <ArrowLeftIcon className="w-5 h-5"/> Wstecz </button> ) : (<div></div>)}
              {step < steps.length ? ( 
                <button type="button" onClick={nextStep} className="flex items-center gap-2 bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"> Dalej <ArrowRightIcon className="w-5 h-5"/> </button> 
              ) : null }
            </div>
          </div>

          {step === steps.length && !loading && !response && (
            <div className="text-center pt-6 mt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">Jesteś gotowy/a, aby zobaczyć magię? Kliknij poniżej!</p>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold px-8 py-4 rounded-2xl hover:scale-105 transition-transform shadow-lg hover:shadow-xl w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    Wygeneruj Treść i Obrazki
                </button>
            </div>
          )}
          {loading && !response && (
            <div className="text-center pt-6 mt-4 font-semibold text-violet-700">Generuję treść i obrazki... To może potrwać do 2 minut...</div>
          )}
        </>
      ) : (
        <div className="mt-12 p-8 bg-slate-50 rounded-2xl shadow-inner animate-fade-in">
          <h2 className="text-3xl font-bold text-center text-violet-700 mb-4">🎉 Twoja magiczna książeczka jest gotowa! 🎉</h2>
          <p className="text-center text-xl text-gray-800 mb-2">"{response.storyTitle}"</p>
          {response.generatedImages && response.generatedImages[0] && ( <img src={response.generatedImages[0].url} alt={`Okładka książki ${response.storyTitle}`} className="w-full max-w-md mx-auto rounded-lg shadow-xl mb-8 border-4 border-white" /> )}
          <p className="text-center text-gray-600 mb-8"> Przejdź dalej, aby sfinalizować i pobrać swoje unikalne dzieło. </p>
          <div className="text-center">
            <button onClick={handleProceedToPayment} disabled={loading} className="bg-green-500 text-white font-bold px-8 py-4 rounded-2xl hover:bg-green-600 transition-transform hover:scale-105 shadow-lg text-lg"> {loading ? "Przetwarzam..." : "Sfinalizuj i Pobierz (PDF)"} </button>
            <button onClick={resetFormAndBook} className="mt-4 ml-0 sm:ml-4 text-sm text-gray-600 hover:text-violet-600 underline"> Stwórz inną książeczkę </button>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in text-gray-900">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Finalizacja Zamówienia</h3>
            <p className="text-gray-600 mb-2">Aby pobrać swoją książeczkę PDF "{response?.storyTitle}", prosimy o dokonanie płatności... żartowałem, to beta! Nie ma płatności :*.</p>
            <p className="text-gray-600 mb-4">Proszę podać adres e-mail, na który wyślemy potwierdzenie i link do pobrania:</p>
            <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="Twój adres e-mail" className="w-full p-3 mb-6 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-violet-500 text-gray-900"/>
            <div className="mb-6">
              <p className="text-center font-semibold text-lg text-gray-700 mb-1">Cena: XX PLN</p> 
              <p className="text-center text-xs text-gray-500 mb-3">(Symulacja - płatność nie zostanie pobrana)</p>
              <button onClick={() => { setPaymentStatus('success'); setShowPaymentModal(false); }}
                className="w-full bg-yellow-400 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-500 transition shadow-md">
                Zapłać z PayU (Symulacja)
              </button>
            </div>
            {paymentStatus === 'success' && (
                  <button onClick={handlePdfDownload} disabled={loading}
                    className="w-full bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-600 transition shadow-md mb-4">
                    {loading ? "Generuję PDF..." : "Pobierz PDF Książeczki"}
                  </button>
            )}
            <div className="text-center">
              <button onClick={() => { setShowPaymentModal(false); setPaymentStatus(null); }} className="text-sm text-gray-500 hover:text-gray-700"> Anuluj i wróć </button>
            </div>
          </div>
        </div>
      )}
      
        <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.5s ease-in-out forwards; }
      `}</style>
    </div> 
  );
}