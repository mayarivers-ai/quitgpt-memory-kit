import { useState, useRef, useEffect } from "react";

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  DONATION_LINK: "https://donate.stripe.com/00w3cv5s098tctTcm604800",
  DONATION_AMOUNT: "$12",
};

// ============================================================
// PROMPTS (always English — pasted into Claude)
// ============================================================
const P = {
  concat: `I've uploaded JSON files exported from ChatGPT. These contain my full conversation history split across multiple files.

I need you to concatenate all conversations into a single file and remove duplicates.

**Steps:**
1. Read all uploaded files and combine every conversation into one list
2. Deduplicate: if two conversations have the same title AND the same create_time, keep only one
3. Count how many conversations remain after deduplication
4. Sort by date (most recent first)
5. Output a single JSON file: conversations_all.json

**Report:**
- Total conversations found across all files
- Duplicates removed
- Unique conversations remaining
- Estimated file size
- Date range (earliest to most recent)

Generate the file as a downloadable artifact.`,
  clean: `I've uploaded my consolidated ChatGPT history. I need you to clean it by removing all metadata and keeping only what matters.

**For each conversation, KEEP only:**
- title
- create_time (the original timestamp)
- messages: an array of {role, text} objects

**For messages, KEEP only:**
- role: "user" or "assistant"
- text: the actual message content

**REMOVE everything else:**
- System messages, tool_calls, plugin outputs, code interpreter blocks
- Image metadata, DALL-E generations, browsing/search results
- File attachment data, function calls, memory updates
- Any message where role is not "user" or "assistant"
- Any message with empty text after cleaning

**Additional cleaning:**
- If a message contained images or file attachments, replace content with [image] or [file: filename]
- Strip HTML tags from message text
- Remove conversations that have zero messages after cleaning
- Remove conversations with only 1 message (abandoned/incomplete chats)

**Output format — clean JSON:**
[{"title":"...","create_time":1704067200,"messages":[{"role":"user","text":"..."},{"role":"assistant","text":"..."}]}]

**Output:**
- Generate one file: conversations_clean.json
- Sort conversations by date (most recent first)

**Report:**
- Conversations before/after cleaning (how many removed, why)
- File size before vs after, % reduction

Generate the file as a downloadable artifact.`,
  explore: `I've uploaded my ChatGPT conversation history as a JSON file. Analyze it thoroughly so we can organize it into topic-based Projects.

**PART A — Overview**
- Total conversations, date range, avg messages per conversation

**PART B — Topic discovery**
Analyze titles AND first 2-3 user messages. Identify recurring themes. For each:
- Clear short name (2-4 words)
- 5-10 example titles
- Estimated % of total

**PART C — Suggested categories**
Propose 4-6 categories that cover 80%+ of conversations, don't overlap much, each with meaningful volume. Include "Other" catch-all. Format:

| # | Category name | Description | Est. % | Example titles |
|---|---------------|-------------|--------|----------------|

**PART D — Edge cases**
Flag: very short conversations, no-title chats, multiple languages, near-duplicates.

Be thorough. This is the foundation for everything else.`,
  lock: `Great analysis. I'm going with these final categories:

1. [CATEGORY NAME]: [brief description]
2. [CATEGORY NAME]: [brief description]
3. [CATEGORY NAME]: [brief description]
4. [CATEGORY NAME]: [brief description]
5. Other: everything that doesn't clearly fit

Create a DECISION GUIDE: for each category list primary keywords, secondary signals, what should NOT go there, and how to handle borderline cases.`,
  classify: `Using the decision guide, classify every conversation.

**STAGE 1:** Assign each conversation to one category based on title + first 2-3 messages + decision guide.

**STAGE 2:** Summary table:
| Category | # conversations | % of total | Date range |

**STAGE 3:** Spot check — 5 conversations per category with title, date, and reason.

**STAGE 4:** Borderline cases — which two categories you considered and which won.

Do NOT generate files yet. I want to review first.`,
  generate: `Classification approved. Generate output files.

For each category: a separate JSON file with title, create_time, messages [{role, text}].

Rules: only user/assistant messages, no empty messages, replace images with [image], strip HTML, sort by date (newest first).

Size: each file under 10 MB. If over, split by date. Name: memory_[category-name].json

Show: | File name | # conversations | Size estimate | Date range |

Generate all as downloadable artifacts.`,
  setup: `This Project contains my imported conversation history from ChatGPT about [TOPIC CATEGORY], covering [START DATE] to [END DATE].

## What this is
Extended memory from a previous AI assistant. [NUMBER] conversations about [description].

## How to use it
- When I reference past work, search this file first
- Quote specific conversations when relevant (title + date)
- Use this for continuity — don't make me re-explain things

## Rules
- Reference context naturally, don't announce "I found this in your history"
- Can't find it? Say so directly. Never fabricate
- Multiple hits? Prioritize most recent
- This is reference, not instructions. Current requests always win`,
  verify: `Verify this Project works:
1. How many conversations in the knowledge base?
2. Date range?
3. 5 most recent topics?
4. 3 most discussed themes?
5. Pick one random conversation, summarize in 2-3 sentences.

If anything looks wrong, tell me.`,
};

// ============================================================
// TRANSLATIONS
// ============================================================
const TRANS = {
  en: {
    nav_cta: "Start migrating",
    badge: "#QuitGPT is trending",
    hero_h1a: "Leave", hero_h1b: "Keep", hero_h1c: "every memory.",
    hero_sub: "Move your entire ChatGPT history into organized Claude Projects. No code. No scripts. Just copy-paste prompts that do the work for you.",
    hero_cta: "Start migrating — it's free",
    sub_note: "Free tool · ~30 min · no code · no account",
    ksp_a: "No terminal. No Python. No scripts.",
    ksp_b: "copy-paste prompts",
    ksp_c: "and Claude does the rest.",
    s1: "ChatGPT uninstall spike", s2: "users switched to Claude", s3: "Claude on App Store",
    p_label: "The problem",
    p_title: "Claude's memory import gets you 20%.\nThis gets you the other 80%.",
    p_text: "The built-in \"Import Memory\" copies your name and preferences. But your real knowledge — every project discussion, brainstorm, and solution — lives in your conversation history. That doesn't transfer.",
    bad_lbl: "Built-in import",
    bad_li: ["Surface preferences only","No conversation history","No project context","Claude starts from near-zero"],
    good_lbl: "With this kit",
    good_li: ["Full history, cleaned and organized","Topic-based Claude Projects","Deep context preserved","Switching feels like an upgrade"],
    h_label: "How it works",
    h_title: "A wizard guides you step by step.\nYou just copy, paste, and follow along.",
    h_text: "The wizard adapts to your situation — whether you have 1 file or 25. It shows only the steps YOU need, with copy-paste prompts for when you get stuck.",
    h_steps: [
      ["Export from ChatGPT","Settings → Data → Export. Takes 2 min."],
      ["Clean & organize","The wizard's prompts tell Claude to strip metadata and merge files."],
      ["Classify by topic","Claude analyzes your history and suggests personalized categories."],
      ["Generate & upload","Claude creates topic files. You upload them to permanent Projects."],
      ["Done","Ask Claude about any past project. It finds the context."],
    ],
    f_title: "Ready to bring your brain with you?",
    f_text: "The wizard is free. If it helps you, you can buy me a coffee at the end.",
    f_btn: "Open the migration wizard",
    f_note: "Free / No account needed / ~30 minutes",
    footer: "Built by someone who actually did this migration. Not affiliated with Anthropic or OpenAI.",
    step_lbl: "Step", copy: "Copy prompt", copied: "\u2713 Copied!", prompt_lbl: "Prompt for Claude",
    before: "Before you continue", back: "Back", next: "Next step",
    bar_text: "This tool is free and always will be.", bar_btn: "\u2615 Buy me a coffee",
    mid_pre: "Enjoying the kit so far? This tool is free. If it's saving you time, you can",
    mid_link: "buy me a coffee", mid_post: "anytime.",
    fin_title: "You made it!", fin_btn: "Buy me a coffee",
    fin_text: "Your ChatGPT history is now organized in Claude Projects. If this tool saved you time and headaches, consider supporting the project. It helps me keep building free tools.",
    fin_note: "Totally optional. Glad it helped either way.",
    faq_ttl: "FAQ",
    fc_q: "How many JSON files did you get?",
    fc_o1: "Just 1 file", fc_o2: "2 to 20 files", fc_o3: "More than 20",
    fs_q: "How big is your file?",
    fs_o1: "Under 30 MB", fs_o2: "30 MB or bigger",
  },
  es: {
    nav_cta: "Empezar migración",
    badge: "#QuitGPT está en tendencia",
    hero_h1a: "Deja", hero_h1b: "Conserva", hero_h1c: "cada memoria.",
    hero_sub: "Mueve todo tu historial de ChatGPT a Proyectos de Claude organizados por tema. Sin código. Sin scripts. Solo prompts de copy-paste que hacen el trabajo.",
    hero_cta: "Empezar migración — es gratis",
    sub_note: "Gratis · ~30 min · sin código · sin cuenta",
    ksp_a: "Sin terminal. Sin Python. Sin scripts.",
    ksp_b: "prompts de copy-paste",
    ksp_c: "y Claude hace el resto.",
    s1: "pico de desinstalaciones de ChatGPT", s2: "usuarios migraron a Claude", s3: "Claude en App Store",
    p_label: "El problema",
    p_title: "La importación nativa te da el 20%.\nEsto te da el otro 80%.",
    p_text: "La función 'Importar Memoria' copia tu nombre y preferencias. Pero tu conocimiento real — cada proyecto, brainstorm y solución — vive en tu historial de conversaciones. Eso no se transfiere.",
    bad_lbl: "Importación nativa",
    bad_li: ["Solo preferencias superficiales","Sin historial de conversaciones","Sin contexto de proyectos","Claude empieza casi de cero"],
    good_lbl: "Con este kit",
    good_li: ["Historial completo, limpio y organizado","Proyectos de Claude por tema","Contexto profundo preservado","El cambio parece una mejora"],
    h_label: "Cómo funciona",
    h_title: "Un asistente te guía paso a paso.\nSolo copias, pegas y sigues las instrucciones.",
    h_text: "El asistente se adapta a tu situación — tengas 1 archivo o 25. Solo muestra los pasos que TÚ necesitas, con prompts de copy-paste.",
    h_steps: [
      ["Exportar de ChatGPT","Configuración → Datos → Exportar. 2 minutos."],
      ["Limpiar y organizar","Los prompts le dicen a Claude que elimine metadatos y fusione archivos."],
      ["Clasificar por tema","Claude analiza tu historial y sugiere categorías personalizadas."],
      ["Generar y subir","Claude crea archivos por tema. Los subes a Proyectos permanentes."],
      ["Listo","Pregúntale a Claude sobre cualquier proyecto pasado. Lo encuentra."],
    ],
    f_title: "¿Listo para llevar tu memoria contigo?",
    f_text: "El asistente es gratis. Si te ayuda, puedes invitarme a un café al final.",
    f_btn: "Abrir el asistente de migración",
    f_note: "Gratis / Sin cuenta necesaria / ~30 minutos",
    footer: "Creado por alguien que hizo esta migración de verdad. No afiliado con Anthropic ni OpenAI.",
    step_lbl: "Paso", copy: "Copiar prompt", copied: "\u2713 Copiado!", prompt_lbl: "Prompt para Claude",
    before: "Antes de continuar", back: "Atrás", next: "Siguiente paso",
    bar_text: "Esta herramienta es gratuita y siempre lo será.", bar_btn: "\u2615 Invítame a un café",
    mid_pre: "¿Te está siendo útil? Es gratis. Si te ahorra tiempo, puedes",
    mid_link: "invitarme a un café", mid_post: "cuando quieras.",
    fin_title: "¡Lo conseguiste!", fin_btn: "Invítame a un café",
    fin_text: "Tu historial de ChatGPT está organizado en Proyectos de Claude. Si esta herramienta te ahorró tiempo, considera apoyar el proyecto.",
    fin_note: "Totalmente opcional. Me alegra que haya ayudado.",
    faq_ttl: "Preguntas frecuentes",
    fc_q: "¿Cuántos archivos JSON tienes?",
    fc_o1: "Solo 1 archivo", fc_o2: "2 a 20 archivos", fc_o3: "Más de 20",
    fs_q: "¿Cuánto pesa el archivo?",
    fs_o1: "Menos de 30 MB", fs_o2: "30 MB o más",
  }
};

// ============================================================
// FAQ (bilingual)
// ============================================================
const FAQS = {
  en: [
    { q: "How many JSON files can I upload at once?", a: "Claude handles max 20 files per chat. If you have more, upload in batches of 20, merge the outputs, then continue with the merged file." },
    { q: "I'm getting 'Knowledge exceeds maximum' error", a: "Your file is too big for the knowledge base (30 MB limit). Go back to the classify + generate steps — splitting by topic usually brings each file down to 3–8 MB." },
    { q: "Claude isn't finding some of my conversations", a: "The knowledge base uses RAG (retrieval). Be specific: include keywords, dates, or exact phrases from the conversation you're looking for." },
    { q: "My file is still too big after cleaning", a: "The topic split in steps 5A/5B is designed to fix this. A single 80 MB file typically becomes 4–6 files of 5–15 MB each." },
    { q: "Where do I upload the file — chat or knowledge base?", a: "During processing (steps 3–5): upload into the chat. Final topic files go into the Project knowledge base so Claude can reference them permanently." },
    { q: "Do I need to repeat the migration if I export again?", a: "Only if you want to add newer conversations. Run the same process on the new export and merge it with your existing memory files." },
    { q: "Is my data sent anywhere?", a: "No. This tool is a static webpage — no server, no storage. You upload files directly to Claude in your own browser session." },
  ],
  es: [
    { q: "¿Cuántos archivos JSON puedo subir a la vez?", a: "Claude maneja máximo 20 archivos por chat. Si tienes más, súbelos en grupos de 20, fusiona los resultados y continúa." },
    { q: "Me sale el error 'Knowledge exceeds maximum'", a: "Tu archivo es demasiado grande para la base de conocimiento (límite 30 MB). Vuelve a los pasos de clasificación — dividir por tema suele reducir cada archivo a 3-8 MB." },
    { q: "Claude no encuentra algunas de mis conversaciones", a: "La base de conocimiento usa RAG (recuperación). Sé específico: incluye palabras clave, fechas o frases exactas de la conversación que buscas." },
    { q: "Mi archivo sigue siendo demasiado grande tras limpiar", a: "La división por temas en los pasos 5A/5B está diseñada para solucionar esto. Un archivo de 80 MB suele convertirse en 4-6 archivos de 5-15 MB cada uno." },
    { q: "¿Dónde subo el archivo — al chat o a la base de conocimiento?", a: "Durante el procesamiento (pasos 3-5): súbelo al chat. Los archivos finales por tema van a la base de conocimiento del Proyecto para que Claude los consulte permanentemente." },
    { q: "¿Tengo que repetir la migración si exporto de nuevo?", a: "Solo si quieres añadir conversaciones más recientes. Sigue el mismo proceso con la nueva exportación y fusiona con tus archivos de memoria existentes." },
    { q: "¿Se envían mis datos a algún servidor?", a: "No. Esta herramienta es una página estática — sin servidor, sin almacenamiento. Subes los archivos directamente a Claude en tu propia sesión del navegador." },
  ]
};

// ============================================================
// STEP BUILDER
// ============================================================
function getSteps(a, T) {
  const es = T === TRANS.es;
  const s = [];

  s.push({ id:"export", num:"1",
    title: es ? "Exportar de ChatGPT" : "Export from ChatGPT",
    sub: es ? "Saca tus datos" : "Get your data out",
    time: es ? "2 min" : "2 min",
    insts: es
      ? ["Abre chatgpt.com e inicia sesión","Haz click en tu icono de perfil (abajo a la izquierda)","Ve a Configuración \u2192 Control de datos \u2192 Exportar datos","Confirma, espera el email (10-30 min)","Descarga el ZIP y descomprímelo","Encuentra el/los archivos conversations.json"]
      : ["Open chatgpt.com and log in","Click your profile icon (bottom-left)","Go to Settings \u2192 Data controls \u2192 Export data","Confirm, wait for the email (10-30 min)","Download the ZIP and unzip it","Find the conversations.json file(s)"],
    tip: es ? "Comprueba cuántos archivos JSON tienes y su tamaño aproximado." : "Check how many JSON files you got and roughly how big they are.",
    prompt: null,
    check: es ? "Tengo mis archivos JSON listos" : "I have my JSON file(s) ready",
    q:{ text: T.fc_q, opts:[{l:T.fc_o1,v:"one"},{l:T.fc_o2,v:"few"},{l:T.fc_o3,v:"many"}], k:"fc" }
  });

  if(a.fc==="one") s.push({ id:"size", num:"2",
    title: es ? "Comprobar tamaño" : "Check file size",
    sub: es ? "Click derecho para ver el tamaño" : "Right-click to see the size",
    time: es ? "30 seg" : "30 sec",
    insts: es
      ? ["Encuentra tu conversations.json","Click derecho \u2192 Obtener información (Mac) o Propiedades (Win)","Apunta el tamaño del archivo"]
      : ["Find your conversations.json","Right-click \u2192 Properties (Win) or Get Info (Mac)","Note the file size"],
    tip: null, prompt: null,
    check: es ? "Sé el tamaño de mi archivo" : "I know my file size",
    q:{ text: T.fs_q, opts:[{l:T.fs_o1,v:"small"},{l:T.fs_o2,v:"big"}], k:"fs" }
  });

  if(a.fc==="few"||a.fc==="many") s.push({ id:"concat", num:"2A",
    title: es ? "Fusionar archivos" : "Merge files",
    sub: es ? "Concatenar en uno solo" : "Concatenate into one",
    time: "5 min",
    insts: a.fc==="many"
      ? (es
          ? ["Abre un chat normal de Claude (no un Proyecto)","Sube los primeros 20 archivos JSON","Pega el prompt de abajo, espera el resultado","Descarga conversations_all.json","Abre un NUEVO chat de Claude","Sube los archivos restantes + conversations_all.json","Ejecuta el mismo prompt de nuevo","Descarga el archivo final fusionado"]
          : ["Open a regular Claude chat (not a Project)","Upload the first 20 JSON files","Paste the prompt below, wait for result","Download conversations_all.json","Open a NEW Claude chat","Upload remaining files + the conversations_all.json","Run the same prompt again","Download the final merged file"])
      : (es
          ? ["Abre un chat normal de Claude (no un Proyecto)","Sube todos tus archivos JSON","Pega el prompt de abajo","Descarga conversations_all.json"]
          : ["Open a regular Claude chat (not a Project)","Upload all your JSON files","Paste the prompt below","Download conversations_all.json"]),
    tip: a.fc==="many"
      ? (es ? "Tienes más de 21 archivos. Claude maneja máximo 20 por chat, así que lo harás en dos rondas." : "You have 21+ files. Claude handles max 20 per chat, so you'll do two rounds.")
      : (es ? "Claude fusionará todo y eliminará duplicados." : "Claude will merge everything and remove duplicates."),
    prompt: P.concat,
    check: es ? "He descargado conversations_all.json" : "I downloaded conversations_all.json"
  });

  if(!(a.fc==="one"&&a.fs==="small")) s.push({ id:"clean", num: a.fc==="one"?"2":"2B",
    title: es ? "Limpiar" : "Clean",
    sub: es ? "Eliminar el exceso" : "Strip the bloat",
    time: "5 min",
    insts: es
      ? ["Abre un NUEVO chat de Claude",`Sube tu ${a.fc==="one"?"conversations.json":"conversations_all.json"}`,"Pega el prompt de abajo","Descarga conversations_clean.json"]
      : ["Open a NEW Claude chat",`Upload your ${a.fc==="one"?"conversations.json":"conversations_all.json"}`,"Paste the prompt below","Download conversations_clean.json"],
    tip: es
      ? "La limpieza elimina mensajes del sistema, tool calls, metadatos de DALL-E. Suele reducir el tamaño un 40-70%."
      : "Cleaning removes system messages, tool calls, DALL-E metadata, plugin outputs. Typically reduces size by 40-70%.",
    prompt: P.clean,
    check: es ? "He descargado conversations_clean.json" : "I downloaded conversations_clean.json"
  });

  const fn = (a.fc==="one"&&a.fs==="small") ? "conversations.json" : "conversations_clean.json";
  s.push({ id:"project", num:"3",
    title: es ? "Crear Proyecto de procesamiento" : "Create Processing Project",
    sub: es ? "Tu espacio de trabajo temporal" : "Your temporary workspace",
    time: "1 min",
    insts: es
      ? ["Ve a claude.ai","Barra lateral \u2192 Proyectos \u2192 Crear Proyecto","Llámalo 'Migración ChatGPT - Procesamiento'","Abre una conversación dentro",`Sube ${fn} al chat (arrastra y suelta)`]
      : ["Go to claude.ai","Sidebar \u2192 Projects \u2192 Create Project",'Name it "ChatGPT Migration - Processing"',"Open a conversation inside it",`Upload ${fn} into the chat (drag & drop)`],
    tip: es
      ? "Sube al chat, no a la base de conocimiento. Los archivos finales por tema van a la base de conocimiento más adelante."
      : "Upload into the chat, not the knowledge base. The final topic files go into the knowledge base later.",
    prompt: null,
    check: es ? "Proyecto creado, archivo subido" : "Project created, file uploaded"
  });

  s.push({ id:"explore", num:"4A",
    title: es ? "Explorar temas" : "Explore topics",
    sub: es ? "¿De qué hablabas?" : "What did you talk about?",
    time: "5 min",
    insts: es
      ? ["Pega el prompt de abajo en tu chat del Proyecto","Espera a que Claude analice todo","Revisa las categorías sugeridas","Ajusta: renombra, fusiona o divide según necesites"]
      : ["Paste the prompt below in your Project chat","Wait for Claude to analyze everything","Review the suggested categories","Adjust: rename, merge, or split as needed"],
    tip: es ? "Apunta a 4-6 categorías que no se solapen. Incluye siempre 'Otros'." : "Aim for 4-6 categories that don't overlap. Always include 'Other'.",
    prompt: P.explore,
    check: es ? "He revisado las categorías sugeridas" : "I reviewed the suggested categories"
  });

  s.push({ id:"lock", num:"4B",
    title: es ? "Fijar categorías" : "Lock in categories",
    sub: es ? "Establecer las reglas de clasificación" : "Set the classification rules",
    time: "3 min",
    insts: es
      ? ["Edita el prompt: reemplaza [NOMBRE DE CATEGORÍA] con tus categorías","Pégalo en la misma conversación","Revisa la guía de decisión","Corrige cualquier regla que no te convenza"]
      : ["Edit the prompt: replace [CATEGORY NAME] with your categories","Paste in the same conversation","Review the decision guide","Correct any rules that feel wrong"],
    tip: es
      ? "Esto garantiza una clasificación consistente. Aclara los límites entre categorías similares ahora."
      : "This ensures consistent sorting. Clarify any boundaries between similar categories now.",
    prompt: P.lock,
    check: es ? "La guía de decisión está bien" : "Decision guide looks good"
  });

  s.push({ id:"classify", num:"5A",
    title: es ? "Clasificar" : "Classify",
    sub: es ? "Ordena cada conversación" : "Sort every conversation",
    time: "10 min",
    insts: es
      ? ["Pega el prompt (misma conversación)","Revisa los ejemplos por categoría","Comprueba los casos límite","Dile a Claude que mueva los mal clasificados"]
      : ["Paste the prompt (same conversation)","Review spot checks per category","Check borderline cases","Tell Claude to move misclassified items"],
    tip: es
      ? "Este es tu control de calidad. Una categoría errónea ahora = un Proyecto erróneo para siempre."
      : "This is your quality gate. Wrong category now = wrong Project forever.",
    prompt: P.classify,
    check: es ? "Clasificación aprobada" : "Classification approved"
  });

  s.push({ id:"generate", num:"5B",
    title: es ? "Generar archivos" : "Generate files",
    sub: es ? "Crea tus archivos de memoria" : "Create your memory files",
    time: "5 min",
    insts: es
      ? ["Pega el prompt (misma conversación)","Espera a que se generen todos los archivos","Descarga CADA archivo","Comprueba que cada uno pese menos de 10 MB"]
      : ["Paste the prompt (same conversation)","Wait for all files to generate","Download EVERY file","Check each is under 10 MB"],
    tip: es ? "Cada archivo se convierte en su propio Proyecto de Claude." : "Each file becomes its own Claude Project.",
    prompt: P.generate,
    check: es ? "Todos los archivos por tema descargados" : "All topic files downloaded"
  });

  s.push({ id:"setup", num:"6",
    title: es ? "Configurar Proyectos" : "Set up Projects",
    sub: es ? "Crear memoria permanente" : "Create permanent memory",
    time: "10 min",
    insts: es
      ? ["Para cada archivo: crea un nuevo Proyecto de Claude","Ponle nombre (ej. 'Memoria: Trabajo', 'Memoria: Código')","Sube el archivo a la base de conocimiento del Proyecto","Pega el prompt de abajo en las Instrucciones personalizadas (edita los corchetes)"]
      : ["For each file: create a new Claude Project",'Name it (e.g. "Memory: Work", "Memory: Coding")',"Upload the file to the Project knowledge base","Paste the prompt below into Custom Instructions (edit brackets)"],
    tip: es
      ? "Un Proyecto por tema. Los Proyectos más pequeños dan mejor recuperación."
      : "One Project per topic. Smaller Projects give better retrieval.",
    prompt: P.setup,
    check: es ? "Todos los Proyectos creados" : "All Projects created"
  });

  s.push({ id:"verify", num:"7",
    title: es ? "Verificar y celebrar" : "Verify & celebrate",
    sub: es ? "Prueba tu nueva memoria" : "Test your new memory",
    time: "2 min",
    insts: es
      ? ["Abre cada nuevo Proyecto","Pega el prompt de verificación","Comprueba que Claude puede encontrar tus conversaciones","Elimina el Proyecto temporal de procesamiento","¡Ya está!"]
      : ["Open each new Project","Paste the verification prompt","Check Claude can find your conversations","Delete the temporary Processing Project","You're done!"],
    tip: es ? "Prueba preguntando sobre algo que discutiste hace meses." : "Try asking about something you discussed months ago.",
    prompt: P.verify,
    check: es ? "¡Claude recuerda mis conversaciones!" : "Claude remembers my conversations!"
  });

  return s;
}

// ============================================================
// SMALL COMPONENTS
// ============================================================
function CopyBtn({text, T}){
  const[ok,setOk]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),2000);}}
    className={`cp-btn ${ok?"cp-ok":""}`}>{ok ? T.copied : T.copy}</button>;
}

function Branch({q, onA, cur, T}){
  return <div className="branch"><div className="branch-label">{T.before}</div>
    <div className="branch-q">{q.text}</div>
    <div className="branch-opts">{q.opts.map(o=><button key={o.v} className={`branch-o ${cur===o.v?"branch-sel":""}`} onClick={()=>onA(q.k,o.v)}>{o.l}</button>)}</div></div>;
}

function FAQ({open, onClose, T, lang}){
  const[exp,setExp]=useState(null);
  if(!open)return null;
  const faqs = FAQS[lang] || FAQS.en;
  return <div className="hlp"><div className="hlp-hdr"><span className="hlp-title">{T.faq_ttl}</span>
    <button onClick={onClose} className="hlp-x">{"\u2715"}</button></div>
    <div className="hlp-msgs" style={{padding:"12px 0"}}>
      {faqs.map((f,i)=><div key={i} className="faq-item" onClick={()=>setExp(exp===i?null:i)}>
        <div className="faq-q"><span>{f.q}</span><span className="faq-arrow">{exp===i?"\u25b2":"\u25bc"}</span></div>
        {exp===i&&<div className="faq-a">{f.a}</div>}
      </div>)}
    </div></div>;
}

function Counter({target,suffix="",dur=2000}){
  const[v,setV]=useState(0);const ref=useRef(null);const ran=useRef(false);
  useEffect(()=>{const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting&&!ran.current){ran.current=true;const t0=Date.now();
    const tick=()=>{const p=Math.min((Date.now()-t0)/dur,1);setV(Math.floor((1-Math.pow(1-p,3))*target));if(p<1)requestAnimationFrame(tick);};tick();}},{threshold:0.4});
    if(ref.current)obs.observe(ref.current);return()=>obs.disconnect();},[target,dur]);
  return <span ref={ref}>{v.toLocaleString()}{suffix}</span>;
}

// ============================================================
// LANDING PAGE
// ============================================================
function Landing({onStart, lang, setLang}){
  const T = TRANS[lang];
  return <div className="land">
    <nav className="nav">
      <div className="nav-logo">#QuitGPT <span>memory kit</span></div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <button className="lang-toggle" onClick={()=>setLang(lang==="en"?"es":"en")}>{lang==="en"?"ES":"EN"}</button>
        <button className="nav-btn" onClick={onStart}>{T.nav_cta}</button>
      </div>
    </nav>

    <section className="hero">
      <div className="badge"><span className="dot"/> {T.badge}</div>
      <h1>{T.hero_h1a} <span className="x">ChatGPT</span>.<br/>{T.hero_h1b} <em>{T.hero_h1c}</em></h1>
      <p className="hero-sub">{T.hero_sub}</p>
      <div className="hero-cta"><button className="btn-big" onClick={onStart}>{T.hero_cta}</button>
        <p className="sub-note">{T.sub_note}</p></div>
    </section>

    <div className="ksp"><div className="ksp-inner">{T.ksp_a}<br/>Just <span className="hl">{T.ksp_b}</span> {T.ksp_c}</div></div>

    <div className="stats">
      <div className="stat"><div className="stat-n"><Counter target={295} suffix="%"/></div><div className="stat-l">{T.s1}</div></div>
      <div className="stat"><div className="stat-n"><Counter target={700} suffix="k"/></div><div className="stat-l">{T.s2}</div></div>
      <div className="stat"><div className="stat-n">#1</div><div className="stat-l">{T.s3}</div></div>
    </div>

    <section className="sec">
      <div className="sec-label">{T.p_label}</div>
      <h2 className="sec-title">{T.p_title.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</h2>
      <p className="sec-text">{T.p_text}</p>
      <div className="cmp">
        <div className="cmp-col bad"><div className="cmp-label">{T.bad_lbl}</div>
          <ul className="cmp-list">{T.bad_li.map((l,i)=><li key={i}>{l}</li>)}</ul></div>
        <div className="cmp-col good"><div className="cmp-label">{T.good_lbl}</div>
          <ul className="cmp-list">{T.good_li.map((l,i)=><li key={i}>{l}</li>)}</ul></div>
      </div>
    </section>

    <section className="sec">
      <div className="sec-label">{T.h_label}</div>
      <h2 className="sec-title">{T.h_title.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</h2>
      <p className="sec-text">{T.h_text}</p>
      <div className="steps">
        {T.h_steps.map(([n,t,d],i)=><div key={i} className="step">
          <div className="step-n" style={i===4?{color:"var(--gn)"}:{}}>{i===4?"\u2713":(i+1)}</div>
          <div><div className="step-t">{t}</div><div className="step-d">{d}</div></div>
        </div>)}
      </div>
    </section>

    <section className="sec" style={{textAlign:"center"}}>
      <h2 className="sec-title">{T.f_title}</h2>
      <p className="sec-text" style={{margin:"0 auto 32px",textAlign:"center"}}>{T.f_text}</p>
      <button className="btn-big" onClick={onStart}>{T.f_btn}</button>
      <p className="sub-note" style={{marginTop:12}}>{T.f_note}</p>
    </section>

    <footer className="footer">
      <p>{T.footer}</p>
      <p style={{marginTop:8}}>Made by <a href="https://twitter.com/mayarivers_ai" target="_blank" rel="noopener">@mayarivers_ai</a></p>
    </footer>
  </div>;
}

// ============================================================
// WIZARD
// ============================================================
function Wizard({onHome, lang, setLang}){
  const T = TRANS[lang];
  const[cur,setCur]=useState(0);const[chk,setChk]=useState({});const[ans,setAns]=useState({});const[hlp,setHlp]=useState(false);
  const steps=getSteps(ans, T);const step=steps[cur]||steps[0];const prog=Object.keys(chk).filter(k=>chk[k]).length;
  const isLast=cur===steps.length-1;
  const isMid=step.id==="project";
  useEffect(()=>{if(cur>=steps.length)setCur(steps.length-1);},[steps.length,cur]);

  const donate=()=>window.open(CONFIG.DONATION_LINK,"_blank");

  return <div className="wiz">
    <div className="wz-hdr">
      <div className="nav-logo" style={{cursor:"pointer"}} onClick={onHome}>{"\u2190"} #QuitGPT <span>kit</span></div>
      <div className="wz-bar"><div className="wz-fill" style={{width:`${(prog/steps.length)*100}%`}}/></div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <div className="wz-pct">{prog}/{steps.length}</div>
        <button className="lang-toggle" onClick={()=>setLang(lang==="en"?"es":"en")}>{lang==="en"?"ES":"EN"}</button>
      </div>
    </div>

    <div className="wz-mob">{steps.map((s,i)=><div key={s.id} className={`wz-pill ${i===cur?"act":""} ${chk[s.id]?"dn":""}`} onClick={()=>setCur(i)}>{s.num}</div>)}</div>

    <div className="wz-lay">
      <div className="wz-side">{steps.map((s,i)=><div key={s.id} className={`wz-ni ${i===cur?"act":""} ${chk[s.id]?"dn":""}`} onClick={()=>setCur(i)}>
        <div className="wz-nn">{chk[s.id]?"\u2713":s.num}</div><div className="wz-nt">{s.title}</div></div>)}</div>

      <div className="wz-main">
        <div className="wz-snum">{T.step_lbl} {step.num}</div>
        <h1 className="wz-stit">{step.title}</h1>
        <p className="wz-ssub">{step.sub}</p>
        <span className="wz-time">{step.time}</span>

        <div className="wz-insts">{step.insts.map((inst,i)=><div key={i} className="wz-inst"><span className="wz-inum">{i+1}.</span><span>{inst}</span></div>)}</div>

        {step.tip&&<div className="wz-tip"><div className="wz-tip-l">Tip</div>{step.tip}</div>}

        {step.prompt&&<div className="wz-psec"><div className="wz-phdr"><span className="wz-plbl">{T.prompt_lbl}</span><CopyBtn text={step.prompt} T={T}/></div><div className="wz-pbox">{step.prompt}</div></div>}

        {step.q&&<Branch q={step.q} onA={(k,v)=>setAns(p=>({...p,[k]:v}))} cur={ans[step.q.k]} T={T}/>}

        <div className={`wz-chk ${chk[step.id]?"on":""}`} onClick={()=>setChk(p=>({...p,[step.id]:!p[step.id]}))}>
          <div className="wz-cb">{chk[step.id]?"\u2713":""}</div><span className="wz-ct">{step.check}</span></div>

        {isMid&&<div className="don-mid">
          <span className="don-mid-ico">&#9749;</span>
          <span className="don-mid-text">{T.mid_pre} <button className="don-mid-link" onClick={donate}>{T.mid_link}</button> {T.mid_post}</span>
        </div>}

        {isLast&&<div className="donation">
          <div className="donation-emoji">&#127881;</div>
          <div className="donation-title">{T.fin_title}</div>
          <p className="donation-text">{T.fin_text}</p>
          <button className="donation-btn" onClick={donate}>{T.fin_btn} ({CONFIG.DONATION_AMOUNT})</button>
          <p className="donation-note">{T.fin_note}</p>
        </div>}

        <div className="wz-btns">
          {cur>0&&<button className="wz-b wz-bb" onClick={()=>setCur(cur-1)}>{T.back}</button>}
          {cur<steps.length-1&&<button className="wz-b wz-bn" onClick={()=>setCur(cur+1)}>{T.next}</button>}
        </div>
      </div>
    </div>

    <div className="don-bar">
      <span className="don-bar-text">{T.bar_text}</span>
      <button className="don-bar-btn" onClick={donate}>{T.bar_btn}</button>
    </div>

    <button className="wz-fab" onClick={()=>setHlp(!hlp)} style={{bottom:60}}>{hlp?"\u2715":"?"}</button>
    <FAQ open={hlp} onClose={()=>setHlp(false)} T={T} lang={lang}/>
  </div>;
}

// ============================================================
// STYLES
// ============================================================
const STYLES=`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--bg:#08090a;--bg2:#0f1012;--bg3:#171819;--tx:#e4e0db;--tx2:#908b83;--tx3:#5c5850;--ac:#ff6b35;--ac2:#ff8f66;--acg:rgba(255,107,53,0.12);--gn:#4ade80;--gng:rgba(74,222,128,0.1);--rd:#ef4444;--sf:'Instrument Serif',Georgia,serif;--sn:'DM Sans',system-ui,sans-serif;--mn:'JetBrains Mono',monospace;--r:12px;--rs:8px;}
*{margin:0;padding:0;box-sizing:border-box;}
.app{min-height:100vh;background:var(--bg);color:var(--tx);font-family:var(--sn);-webkit-font-smoothing:antialiased;}

/* NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(20px);background:rgba(8,9,10,0.85);border-bottom:1px solid rgba(255,255,255,0.04);}
.nav-logo{font-family:var(--mn);font-size:13px;font-weight:500;color:var(--ac);letter-spacing:2px;text-transform:uppercase;}
.nav-logo span{color:var(--tx2);font-weight:400;}
.nav-btn{padding:8px 20px;background:var(--ac);color:var(--bg);border:none;border-radius:100px;font-family:var(--sn);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;}
.nav-btn:hover{background:var(--ac2);transform:translateY(-1px);box-shadow:0 4px 20px var(--acg);}
.lang-toggle{padding:6px 12px;background:transparent;color:var(--tx2);border:1px solid rgba(255,255,255,0.1);border-radius:100px;font-family:var(--mn);font-size:11px;font-weight:500;cursor:pointer;letter-spacing:1px;transition:all .2s;}
.lang-toggle:hover{color:var(--tx);border-color:rgba(255,255,255,0.2);}

/* HERO */
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:120px 24px 80px;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;top:-250px;left:50%;transform:translateX(-50%);width:900px;height:900px;background:radial-gradient(ellipse,var(--acg) 0%,transparent 65%);pointer-events:none;opacity:.6;}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(255,107,53,0.07);border:1px solid rgba(255,107,53,0.18);border-radius:100px;font-family:var(--mn);font-size:11px;color:var(--ac);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:32px;animation:fiu .6s ease both;}
.dot{width:6px;height:6px;background:var(--ac);border-radius:50%;animation:pulse 2s ease infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.6)}}
.hero h1{font-family:var(--sf);font-size:clamp(44px,8vw,88px);font-weight:400;line-height:1.05;max-width:860px;margin-bottom:24px;animation:fiu .6s ease .1s both;position:relative;z-index:1;}
.hero h1 em{font-style:italic;color:var(--ac);}
.hero h1 .x{text-decoration:line-through;color:var(--tx3);text-decoration-color:var(--rd);text-decoration-thickness:3px;}
.hero-sub{font-size:clamp(16px,2vw,19px);color:var(--tx2);max-width:540px;line-height:1.65;margin-bottom:40px;animation:fiu .6s ease .2s both;position:relative;z-index:1;}
.hero-cta{animation:fiu .6s ease .3s both;position:relative;z-index:1;text-align:center;}
.btn-big{padding:16px 48px;background:var(--ac);color:var(--bg);border:none;border-radius:100px;font-family:var(--sn);font-size:17px;font-weight:600;cursor:pointer;transition:all .25s;}
.btn-big:hover{background:var(--ac2);transform:translateY(-2px);box-shadow:0 8px 40px var(--acg);}
.sub-note{font-size:13px;color:var(--tx3);font-family:var(--mn);margin-top:12px;}
.sub-note strong{color:var(--tx2);}
@keyframes fiu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

/* KSP */
.ksp{padding:48px 24px;text-align:center;background:linear-gradient(180deg,transparent,rgba(255,107,53,0.03),transparent);border-top:1px solid rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.03);}
.ksp-inner{max-width:680px;margin:0 auto;font-family:var(--sf);font-size:clamp(22px,3.5vw,30px);font-style:italic;line-height:1.5;}
.ksp-inner .hl{color:var(--ac);font-style:normal;}

/* STATS */
.stats{display:flex;justify-content:center;gap:48px;padding:48px 24px;border-bottom:1px solid rgba(255,255,255,0.03);flex-wrap:wrap;}
.stat{text-align:center;}
.stat-n{font-family:var(--sf);font-size:40px;color:var(--ac);line-height:1;margin-bottom:4px;}
.stat-l{font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:2px;font-family:var(--mn);}

/* SECTIONS */
.sec{padding:96px 24px;max-width:880px;margin:0 auto;position:relative;z-index:1;}
.sec-label{font-family:var(--mn);font-size:11px;color:var(--ac);text-transform:uppercase;letter-spacing:3px;margin-bottom:14px;}
.sec-title{font-family:var(--sf);font-size:clamp(30px,5vw,44px);font-weight:400;line-height:1.15;margin-bottom:20px;}
.sec-text{font-size:16px;color:var(--tx2);line-height:1.7;max-width:620px;}

/* COMPARISON */
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:44px;}
@media(max-width:640px){.cmp{grid-template-columns:1fr;}}
.cmp-col{padding:28px;border-radius:var(--r);border:1px solid rgba(255,255,255,0.04);}
.cmp-col.bad{background:linear-gradient(135deg,rgba(239,68,68,0.04),transparent);border-color:rgba(239,68,68,0.12);}
.cmp-col.good{background:linear-gradient(135deg,rgba(74,222,128,0.04),transparent);border-color:rgba(74,222,128,0.12);}
.cmp-label{font-family:var(--mn);font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:18px;}
.cmp-col.bad .cmp-label{color:var(--rd);}
.cmp-col.good .cmp-label{color:var(--gn);}
.cmp-list{list-style:none;display:flex;flex-direction:column;gap:10px;}
.cmp-list li{font-size:14px;color:var(--tx2);padding-left:24px;position:relative;line-height:1.5;}
.cmp-list li::before{position:absolute;left:0;font-size:13px;}
.cmp-col.bad .cmp-list li::before{content:'\\2715';color:var(--rd);}
.cmp-col.good .cmp-list li::before{content:'\\2713';color:var(--gn);}

/* STEPS */
.steps{margin-top:44px;display:flex;flex-direction:column;gap:2px;}
.step{display:flex;gap:20px;padding:20px;background:var(--bg2);border:1px solid rgba(255,255,255,0.03);transition:all .2s;}
.step:first-child{border-radius:var(--r) var(--r) 2px 2px;}
.step:last-child{border-radius:2px 2px var(--r) var(--r);}
.step:hover{background:var(--bg3);transform:translateX(4px);}
.step-n{font-family:var(--sf);font-size:32px;color:var(--ac);line-height:1;flex-shrink:0;width:34px;}
.step-t{font-size:15px;font-weight:600;margin-bottom:4px;}
.step-d{font-size:13px;color:var(--tx2);line-height:1.5;}

/* FOOTER */
.footer{padding:44px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.03);font-size:12px;color:var(--tx3);line-height:1.6;}
.footer a{color:var(--tx2);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.08);}
.footer a:hover{color:var(--ac);border-color:var(--ac);}

/* ===== WIZARD ===== */
.wz-hdr{padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:10;backdrop-filter:blur(16px);background:rgba(8,9,10,0.85);}
.wz-bar{flex:1;max-width:260px;height:4px;background:var(--bg3);border-radius:4px;overflow:hidden;}
.wz-fill{height:100%;background:var(--ac);border-radius:4px;transition:width 0.4s;}
.wz-pct{font-family:var(--mn);font-size:11px;color:var(--tx3);}
.wz-lay{display:flex;min-height:calc(100vh - 56px);}
.wz-side{width:220px;padding:14px 10px;border-right:1px solid rgba(255,255,255,0.04);overflow-y:auto;flex-shrink:0;}
@media(max-width:800px){.wz-side{display:none;}}
.wz-ni{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:all .15s;margin-bottom:2px;border:1px solid transparent;}
.wz-ni:hover{background:var(--bg2);}
.wz-ni.act{background:var(--bg3);border-color:rgba(255,107,53,0.15);}
.wz-ni.dn .wz-nn{background:var(--gng);color:var(--gn);}
.wz-nn{font-family:var(--mn);font-size:11px;color:var(--tx3);width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:var(--bg2);flex-shrink:0;}
.wz-ni.act .wz-nn{background:var(--acg);color:var(--ac);}
.wz-nt{font-size:12px;color:var(--tx2);line-height:1.3;}
.wz-ni.act .wz-nt{color:var(--tx);font-weight:500;}
.wz-main{flex:1;padding:28px 28px 120px;max-width:660px;overflow-y:auto;}
@media(max-width:800px){.wz-main{padding:20px 16px 120px;}}
.wz-mob{display:none;padding:10px 16px;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,0.04);gap:4px;}
@media(max-width:800px){.wz-mob{display:flex;}}
.wz-pill{padding:5px 10px;border-radius:100px;font-family:var(--mn);font-size:11px;color:var(--tx3);cursor:pointer;flex-shrink:0;background:var(--bg2);white-space:nowrap;}
.wz-pill.act{background:var(--acg);color:var(--ac);}.wz-pill.dn{background:var(--gng);color:var(--gn);}
.wz-snum{font-family:var(--mn);font-size:12px;color:var(--ac);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;}
.wz-stit{font-family:var(--sf);font-size:clamp(24px,4vw,32px);font-weight:400;line-height:1.15;margin-bottom:4px;}
.wz-ssub{font-size:14px;color:var(--tx2);}
.wz-time{font-family:var(--mn);font-size:11px;color:var(--tx3);margin-top:8px;padding:4px 10px;background:var(--bg2);border-radius:100px;display:inline-block;}
.wz-insts{margin:20px 0;display:flex;flex-direction:column;gap:5px;}
.wz-inst{display:flex;gap:12px;padding:10px 14px;background:var(--bg2);border-radius:8px;border:1px solid rgba(255,255,255,0.03);font-size:14px;color:var(--tx2);line-height:1.5;}
.wz-inum{font-family:var(--mn);font-size:12px;color:var(--ac);flex-shrink:0;width:20px;text-align:right;padding-top:1px;}
.wz-tip{margin:16px 0;padding:14px;background:rgba(255,107,53,0.04);border:1px solid rgba(255,107,53,0.12);border-radius:8px;font-size:13px;color:var(--tx2);line-height:1.6;}
.wz-tip-l{font-family:var(--mn);font-size:11px;color:var(--ac);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
.wz-psec{margin:20px 0;}.wz-phdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.wz-plbl{font-family:var(--mn);font-size:12px;color:var(--tx2);text-transform:uppercase;letter-spacing:1px;}
.wz-pbox{background:var(--bg2);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;font-family:var(--mn);font-size:12px;color:var(--tx3);line-height:1.7;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow-y:auto;}
.wz-pbox::-webkit-scrollbar{width:4px;}.wz-pbox::-webkit-scrollbar-thumb{background:var(--tx3);border-radius:2px;}
.wz-chk{margin:24px 0;display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg2);border-radius:8px;border:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:all .2s;user-select:none;}
.wz-chk:hover{border-color:rgba(255,255,255,0.08);}
.wz-chk.on{background:rgba(74,222,128,0.04);border-color:rgba(74,222,128,0.15);}
.wz-cb{width:22px;height:22px;border:2px solid var(--tx3);border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;transition:all .2s;}
.wz-chk.on .wz-cb{border-color:var(--gn);background:rgba(74,222,128,0.15);color:var(--gn);}
.wz-ct{font-size:14px;color:var(--tx2);}.wz-chk.on .wz-ct{color:var(--gn);}
.wz-btns{display:flex;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.04);}
.wz-b{padding:10px 22px;border-radius:8px;font-family:var(--sn);font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;border:none;}
.wz-bb{background:var(--bg2);color:var(--tx2);border:1px solid rgba(255,255,255,0.06);}.wz-bb:hover{background:var(--bg3);color:var(--tx);}
.wz-bn{background:var(--ac);color:var(--bg);font-weight:600;}.wz-bn:hover{background:var(--ac2);transform:translateY(-1px);}

/* COPY BUTTON */
.cp-btn{padding:8px 16px;background:var(--acg);color:var(--ac);border:1px solid rgba(255,107,53,0.25);border-radius:8px;font-family:var(--mn);font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;letter-spacing:.5px;}
.cp-btn.cp-ok{background:rgba(74,222,128,0.15);color:var(--gn);border-color:rgba(74,222,128,0.3);}

/* BRANCH */
.branch{margin:20px 0;padding:20px;background:var(--bg2);border:1px solid rgba(255,107,53,0.15);border-radius:var(--r);}
.branch-label{font-family:var(--mn);font-size:11px;color:var(--ac);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;}
.branch-q{font-size:15px;font-weight:500;margin-bottom:14px;}
.branch-opts{display:flex;gap:8px;flex-wrap:wrap;}
.branch-o{padding:10px 20px;background:var(--bg3);color:var(--tx2);border:1px solid rgba(255,255,255,0.06);border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:all .15s;font-family:var(--sn);}
.branch-o:hover{border-color:rgba(255,255,255,0.12);color:var(--tx);}
.branch-sel{background:var(--acg);color:var(--ac);border-color:rgba(255,107,53,0.3);}

/* DONATION - fixed bottom bar */
.don-bar{position:fixed;bottom:0;left:0;right:0;z-index:90;padding:10px 24px;background:rgba(15,16,18,0.95);backdrop-filter:blur(12px);border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;gap:16px;}
.don-bar-text{font-size:12px;color:var(--tx3);font-family:var(--mn);}
.don-bar-btn{padding:6px 16px;background:rgba(255,107,53,0.1);color:var(--ac);border:1px solid rgba(255,107,53,0.2);border-radius:100px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;font-family:var(--sn);white-space:nowrap;}
.don-bar-btn:hover{background:rgba(255,107,53,0.2);border-color:rgba(255,107,53,0.35);}

/* DONATION - mid-process mention */
.don-mid{margin:20px 0;padding:14px 16px;background:rgba(255,107,53,0.03);border:1px solid rgba(255,107,53,0.08);border-radius:8px;display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--tx2);line-height:1.6;}
.don-mid-ico{font-size:16px;flex-shrink:0;padding-top:1px;}
.don-mid-text{flex:1;}
.don-mid-link{background:none;border:none;color:var(--ac);font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-family:var(--sn);padding:0;}
.don-mid-link:hover{color:var(--ac2);}

/* DONATION - final section */
.donation{margin:28px 0;padding:32px;background:linear-gradient(135deg,rgba(74,222,128,0.04),rgba(255,107,53,0.04));border:1px solid rgba(74,222,128,0.15);border-radius:16px;text-align:center;}
.donation-emoji{font-size:32px;margin-bottom:8px;}
.donation-title{font-family:var(--sf);font-size:24px;margin-bottom:8px;color:var(--gn);}
.donation-text{font-size:14px;color:var(--tx2);line-height:1.6;margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;}
.donation-btn{padding:14px 32px;background:var(--ac);color:var(--bg);border:none;border-radius:100px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;font-family:var(--sn);}
.donation-btn:hover{background:var(--ac2);transform:translateY(-1px);box-shadow:0 6px 24px var(--acg);}
.donation-note{font-size:12px;color:var(--tx3);font-family:var(--mn);margin-top:12px;}

/* FAB */
.wz-fab{position:fixed;bottom:20px;right:20px;width:50px;height:50px;background:var(--ac);color:var(--bg);border:none;border-radius:50%;font-size:20px;cursor:pointer;z-index:100;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(255,107,53,0.3);transition:all .2s;font-weight:700;}
.wz-fab:hover{transform:scale(1.08);}

/* FAQ */
.hlp{position:fixed;bottom:80px;right:20px;width:350px;max-width:calc(100vw - 40px);max-height:calc(100vh - 120px);background:var(--bg2);border:1px solid rgba(255,255,255,0.08);border-radius:16px;display:flex;flex-direction:column;z-index:200;box-shadow:0 20px 60px rgba(0,0,0,0.5);}
.hlp-hdr{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;}
.hlp-title{font-family:var(--mn);font-size:12px;color:var(--ac);letter-spacing:1px;text-transform:uppercase;}
.hlp-x{background:none;border:none;color:var(--tx3);font-size:16px;cursor:pointer;padding:4px;}
.hlp-msgs{flex:1;overflow-y:auto;}
.faq-item{border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;}
.faq-q{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;gap:12px;font-size:13px;color:var(--tx);line-height:1.4;}
.faq-arrow{font-size:9px;color:var(--tx3);flex-shrink:0;}
.faq-a{padding:0 16px 14px;font-size:13px;color:var(--tx2);line-height:1.6;}

@media(max-width:640px){.stats{gap:20px;}.stat-n{font-size:30px;}.sec{padding:64px 20px;}.hero{padding:100px 20px 60px;}}
`;

// ============================================================
// APP
// ============================================================
export default function App(){
  const[view,setView]=useState("land");
  const[lang,setLang]=useState("en");
  useEffect(()=>{const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);return()=>s.remove();},[]);
  return <div className="app">
    {view==="land"
      ? <Landing onStart={()=>setView("wiz")} lang={lang} setLang={setLang}/>
      : <Wizard onHome={()=>setView("land")} lang={lang} setLang={setLang}/>}
  </div>;
}
