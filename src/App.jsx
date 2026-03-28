import { useState, useRef, useEffect } from "react";

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  DONATION_LINK: "https://buy.stripe.com/YOUR_DONATION_LINK",
  DONATION_AMOUNT: "$12",
};

// ============================================================
// PROMPTS
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

const HELPER_SYS = `You are a helpful assistant in the QuitGPT Memory Kit. This free tool helps people migrate ChatGPT history into organized Claude Projects.

Process: Export ChatGPT data (ZIP with JSON files) > concatenate if multiple files > clean metadata > create Claude Project > explore topics > classify > generate files per topic > create permanent Projects > verify.

Limits: Claude max 20 files per chat. Project files max 30 MB each. Knowledge base uses RAG. Splitting by topic keeps files small (3-8 MB typically).

Common issues:
- 21+ JSON files: batch in groups of 20, merge outputs
- "Knowledge exceeds maximum": single file too big, split by topic first
- Claude misses conversations: uses RAG, give specific keywords/dates
- File too big after cleaning: the topic split in later steps solves this

Keep answers short and practical. If unclear what step they're on, ask.`;

// ============================================================
// STEP BUILDER
// ============================================================
function getSteps(a) {
  const s = [];
  s.push({ id:"export", num:"1", title:"Export from ChatGPT", sub:"Get your data out", time:"2 min",
    insts:["Open chatgpt.com and log in","Click your profile icon (bottom-left)","Go to Settings \u2192 Data controls \u2192 Export data","Confirm, wait for the email (10-30 min)","Download the ZIP and unzip it","Find the conversations.json file(s)"],
    tip:"Check how many JSON files you got and roughly how big they are.", prompt:null, check:"I have my JSON file(s) ready",
    q:{ text:"How many JSON files did you get?", opts:[{l:"Just 1 file",v:"one"},{l:"2 to 20 files",v:"few"},{l:"More than 20",v:"many"}], k:"fc" }});

  if(a.fc==="one") s.push({ id:"size", num:"2", title:"Check file size", sub:"Right-click to see the size", time:"30 sec",
    insts:["Find your conversations.json","Right-click \u2192 Properties (Win) or Get Info (Mac)","Note the file size"],
    tip:null, prompt:null, check:"I know my file size",
    q:{ text:"How big is your file?", opts:[{l:"Under 30 MB",v:"small"},{l:"30 MB or bigger",v:"big"}], k:"fs" }});

  if(a.fc==="few"||a.fc==="many") s.push({ id:"concat", num:"2A", title:"Merge files", sub:"Concatenate into one", time:"5 min",
    insts: a.fc==="many"
      ? ["Open a regular Claude chat (not a Project)","Upload the first 20 JSON files","Paste the prompt below, wait for result","Download conversations_all.json","Open a NEW Claude chat","Upload remaining files + the conversations_all.json","Run the same prompt again","Download the final merged file"]
      : ["Open a regular Claude chat (not a Project)","Upload all your JSON files","Paste the prompt below","Download conversations_all.json"],
    tip: a.fc==="many" ? "You have 21+ files. Claude handles max 20 per chat, so you'll do two rounds." : "Claude will merge everything and remove duplicates.",
    prompt:P.concat, check:"I downloaded conversations_all.json" });

  if(!(a.fc==="one"&&a.fs==="small")) s.push({ id:"clean", num:a.fc==="one"?"2":"2B", title:"Clean", sub:"Strip the bloat", time:"5 min",
    insts:["Open a NEW Claude chat",`Upload your ${a.fc==="one"?"conversations.json":"conversations_all.json"}`,"Paste the prompt below","Download conversations_clean.json"],
    tip:"Cleaning removes system messages, tool calls, DALL-E metadata, plugin outputs. Typically reduces size by 40-70%.",
    prompt:P.clean, check:"I downloaded conversations_clean.json" });

  const fn = (a.fc==="one"&&a.fs==="small") ? "conversations.json" : "conversations_clean.json";
  s.push({ id:"project", num:"3", title:"Create Processing Project", sub:"Your temporary workspace", time:"1 min",
    insts:["Go to claude.ai","Sidebar \u2192 Projects \u2192 Create Project",'Name it "ChatGPT Migration - Processing"',"Open a conversation inside it",`Upload ${fn} into the chat (drag & drop)`],
    tip:"Upload into the chat, not the knowledge base. The final topic files go into the knowledge base later.", prompt:null, check:"Project created, file uploaded" });

  s.push({ id:"explore", num:"4A", title:"Explore topics", sub:"What did you talk about?", time:"5 min",
    insts:["Paste the prompt below in your Project chat","Wait for Claude to analyze everything","Review the suggested categories","Adjust: rename, merge, or split as needed"],
    tip:"Aim for 4-6 categories that don't overlap. Always include 'Other'.", prompt:P.explore, check:"I reviewed the suggested categories" });

  s.push({ id:"lock", num:"4B", title:"Lock in categories", sub:"Set the classification rules", time:"3 min",
    insts:["Edit the prompt: replace [CATEGORY NAME] with your categories","Paste in the same conversation","Review the decision guide","Correct any rules that feel wrong"],
    tip:"This ensures consistent sorting. Clarify any boundaries between similar categories now.", prompt:P.lock, check:"Decision guide looks good" });

  s.push({ id:"classify", num:"5A", title:"Classify", sub:"Sort every conversation", time:"10 min",
    insts:["Paste the prompt (same conversation)","Review spot checks per category","Check borderline cases","Tell Claude to move misclassified items"],
    tip:"This is your quality gate. Wrong category now = wrong Project forever.", prompt:P.classify, check:"Classification approved" });

  s.push({ id:"generate", num:"5B", title:"Generate files", sub:"Create your memory files", time:"5 min",
    insts:["Paste the prompt (same conversation)","Wait for all files to generate","Download EVERY file","Check each is under 10 MB"],
    tip:"Each file becomes its own Claude Project.", prompt:P.generate, check:"All topic files downloaded" });

  s.push({ id:"setup", num:"6", title:"Set up Projects", sub:"Create permanent memory", time:"10 min",
    insts:["For each file: create a new Claude Project",'Name it (e.g. "Memory: Work", "Memory: Coding")',"Upload the file to the Project knowledge base","Paste the prompt below into Custom Instructions (edit brackets)"],
    tip:"One Project per topic. Smaller Projects give better retrieval.", prompt:P.setup, check:"All Projects created" });

  s.push({ id:"verify", num:"7", title:"Verify & celebrate", sub:"Test your new memory", time:"2 min",
    insts:["Open each new Project","Paste the verification prompt","Check Claude can find your conversations","Delete the temporary Processing Project","You're done!"],
    tip:"Try asking about something you discussed months ago.", prompt:P.verify, check:"Claude remembers my conversations!" });

  return s;
}

// ============================================================
// SMALL COMPONENTS
// ============================================================
function CopyBtn({text}){
  const[ok,setOk]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),2000);}}
    className={`cp-btn ${ok?"cp-ok":""}`}>{ok?"\u2713 Copied!":"Copy prompt"}</button>;
}

function Branch({q,onA,cur}){
  return <div className="branch"><div className="branch-label">Before you continue</div>
    <div className="branch-q">{q.text}</div>
    <div className="branch-opts">{q.opts.map(o=><button key={o.v} className={`branch-o ${cur===o.v?"branch-sel":""}`} onClick={()=>onA(q.k,o.v)}>{o.l}</button>)}</div></div>;
}

function Helper({open,onClose}){
  const[msgs,setMsgs]=useState([]);const[inp,setInp]=useState("");const[loading,setLoading]=useState(false);const end=useRef(null);
  useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send=async()=>{if(!inp.trim()||loading)return;const u=inp.trim();setInp("");setMsgs(p=>[...p,{r:"user",t:u}]);setLoading(true);
    try{const h=[...msgs,{r:"user",t:u}].map(m=>({role:m.r==="user"?"user":"assistant",content:m.t}));
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:HELPER_SYS,messages:h})});
      const d=await res.json();const reply=d.content?.map(c=>c.text||"").join("")||"Sorry, try again.";
      setMsgs(p=>[...p,{r:"a",t:reply}]);}catch{setMsgs(p=>[...p,{r:"a",t:"Connection error. Try again."}]);}setLoading(false);};
  if(!open)return null;
  return <div className="hlp"><div className="hlp-hdr"><span className="hlp-title">Migration helper</span>
    <button onClick={onClose} className="hlp-x">{"\u2715"}</button></div>
    <div className="hlp-msgs">{msgs.length===0&&<div className="hlp-empty">Ask me anything about the migration. Examples:<br/><br/>"My file is 45 MB, what do I do?"<br/>"Claude gave me an error"<br/>"What goes in knowledge base vs chat?"</div>}
      {msgs.map((m,i)=><div key={i} className={`hlp-msg ${m.r==="user"?"hlp-u":"hlp-a"}`}>{m.t}</div>)}
      {loading&&<div className="hlp-loading">Thinking...</div>}<div ref={end}/></div>
    <div className="hlp-inp"><input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask a question..."/>
      <button onClick={send} disabled={loading}>Send</button></div></div>;
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
function Landing({onStart}){
  return <div className="land">
    <nav className="nav"><div className="nav-logo">#QuitGPT <span>memory kit</span></div>
      <button className="nav-btn" onClick={onStart}>Start migrating</button></nav>

    <section className="hero">
      <div className="badge"><span className="dot"/> #QuitGPT is trending</div>
      <h1>Leave <span className="x">ChatGPT</span>.<br/>Keep <em>every memory</em>.</h1>
      <p className="hero-sub">Move your entire ChatGPT history into organized Claude Projects. No code. No scripts. Just copy-paste prompts that do the work for you.</p>
      <div className="hero-cta"><button className="btn-big" onClick={onStart}>Start migrating — it's free</button>
        <p className="sub-note">Free tool / ~30 min / zero code required</p></div>
    </section>

    <div className="ksp"><div className="ksp-inner">No terminal. No Python. No scripts.<br/>Just <span className="hl">copy-paste prompts</span> and Claude does the rest.</div></div>

    <div className="stats">
      <div className="stat"><div className="stat-n"><Counter target={295} suffix="%"/></div><div className="stat-l">ChatGPT uninstall spike</div></div>
      <div className="stat"><div className="stat-n"><Counter target={700} suffix="k"/></div><div className="stat-l">users switched to Claude</div></div>
      <div className="stat"><div className="stat-n">#1</div><div className="stat-l">Claude on App Store</div></div>
    </div>

    <section className="sec">
      <div className="sec-label">The problem</div>
      <h2 className="sec-title">Claude's memory import gets you 20%.<br/>This gets you the other 80%.</h2>
      <p className="sec-text">The built-in "Import Memory" copies your name and preferences. But your real knowledge — every project discussion, brainstorm, and solution — lives in your conversation history. That doesn't transfer.</p>
      <div className="cmp">
        <div className="cmp-col bad"><div className="cmp-label">Built-in import</div>
          <ul className="cmp-list"><li>Surface preferences only</li><li>No conversation history</li><li>No project context</li><li>Claude starts from near-zero</li></ul></div>
        <div className="cmp-col good"><div className="cmp-label">With this kit</div>
          <ul className="cmp-list"><li>Full history, cleaned and organized</li><li>Topic-based Claude Projects</li><li>Deep context preserved</li><li>Switching feels like an upgrade</li></ul></div>
      </div>
    </section>

    <section className="sec">
      <div className="sec-label">How it works</div>
      <h2 className="sec-title">A wizard guides you step by step.<br/>You just copy, paste, and follow along.</h2>
      <p className="sec-text">The wizard adapts to your situation — whether you have 1 file or 25. It shows only the steps YOU need, with copy-paste prompts and a built-in AI helper for when you get stuck.</p>
      <div className="steps">
        {[["1","Export from ChatGPT","Settings \u2192 Data \u2192 Export. Takes 2 min."],
          ["2","Clean & organize","The wizard's prompts tell Claude to strip metadata and merge files."],
          ["3","Classify by topic","Claude analyzes your history and suggests personalized categories."],
          ["4","Generate & upload","Claude creates topic files. You upload them to permanent Projects."],
          ["\u2713","Done","Ask Claude about any past project. It finds the context."]
        ].map(([n,t,d],i)=><div key={i} className="step"><div className="step-n" style={n==="\u2713"?{color:"var(--gn)"}:{}}>{n}</div><div><div className="step-t">{t}</div><div className="step-d">{d}</div></div></div>)}
      </div>
    </section>

    <section className="sec" style={{textAlign:"center"}}>
      <h2 className="sec-title">Ready to bring your brain with you?</h2>
      <p className="sec-text" style={{margin:"0 auto 32px",textAlign:"center"}}>The wizard is free. If it helps you, you can buy me a coffee at the end.</p>
      <button className="btn-big" onClick={onStart}>Open the migration wizard</button>
      <p className="sub-note" style={{marginTop:12}}>Free / No account needed / ~30 minutes</p>
    </section>

    <footer className="footer">
      <p>Built by someone who actually did this migration. Not affiliated with Anthropic or OpenAI.</p>
      <p style={{marginTop:8}}>Made by <a href="https://twitter.com/mayarivers_ai" target="_blank" rel="noopener">@mayarivers_ai</a></p>
    </footer>
  </div>;
}

// ============================================================
// WIZARD
// ============================================================
function Wizard({onHome}){
  const[cur,setCur]=useState(0);const[chk,setChk]=useState({});const[ans,setAns]=useState({});const[hlp,setHlp]=useState(false);
  const steps=getSteps(ans);const step=steps[cur]||steps[0];const prog=Object.keys(chk).filter(k=>chk[k]).length;
  const isLast=cur===steps.length-1;
  const isMid=step.id==="project";
  useEffect(()=>{if(cur>=steps.length)setCur(steps.length-1);},[steps.length,cur]);

  const donate=()=>window.open(CONFIG.DONATION_LINK,"_blank");

  return <div className="wiz">
    <div className="wz-hdr">
      <div className="nav-logo" style={{cursor:"pointer"}} onClick={onHome}>{"\u2190"} #QuitGPT <span>kit</span></div>
      <div className="wz-bar"><div className="wz-fill" style={{width:`${(prog/steps.length)*100}%`}}/></div>
      <div className="wz-pct">{prog}/{steps.length}</div>
    </div>

    <div className="wz-mob">{steps.map((s,i)=><div key={s.id} className={`wz-pill ${i===cur?"act":""} ${chk[s.id]?"dn":""}`} onClick={()=>setCur(i)}>{s.num}</div>)}</div>

    <div className="wz-lay">
      <div className="wz-side">{steps.map((s,i)=><div key={s.id} className={`wz-ni ${i===cur?"act":""} ${chk[s.id]?"dn":""}`} onClick={()=>setCur(i)}>
        <div className="wz-nn">{chk[s.id]?"\u2713":s.num}</div><div className="wz-nt">{s.title}</div></div>)}</div>

      <div className="wz-main">
        <div className="wz-snum">Step {step.num}</div>
        <h1 className="wz-stit">{step.title}</h1>
        <p className="wz-ssub">{step.sub}</p>
        <span className="wz-time">{step.time}</span>

        <div className="wz-insts">{step.insts.map((inst,i)=><div key={i} className="wz-inst"><span className="wz-inum">{i+1}.</span><span>{inst}</span></div>)}</div>

        {step.tip&&<div className="wz-tip"><div className="wz-tip-l">Tip</div>{step.tip}</div>}

        {step.prompt&&<div className="wz-psec"><div className="wz-phdr"><span className="wz-plbl">Prompt for Claude</span><CopyBtn text={step.prompt}/></div><div className="wz-pbox">{step.prompt}</div></div>}

        {step.q&&<Branch q={step.q} onA={(k,v)=>setAns(p=>({...p,[k]:v}))} cur={ans[step.q.k]}/>}

        <div className={`wz-chk ${chk[step.id]?"on":""}`} onClick={()=>setChk(p=>({...p,[step.id]:!p[step.id]}))}>
          <div className="wz-cb">{chk[step.id]?"\u2713":""}</div><span className="wz-ct">{step.check}</span></div>

        {/* MID-PROCESS donation mention (after creating Project) */}
        {isMid&&<div className="don-mid">
          <span className="don-mid-ico">&#9749;</span>
          <span className="don-mid-text">Enjoying the kit so far? This tool is free. If it's saving you time, you can <button className="don-mid-link" onClick={donate}>buy me a coffee</button> anytime.</span>
        </div>}

        {/* FINAL donation section (always visible on last step) */}
        {isLast&&<div className="donation">
          <div className="donation-emoji">&#127881;</div>
          <div className="donation-title">You made it!</div>
          <p className="donation-text">Your ChatGPT history is now organized in Claude Projects. If this tool saved you time and headaches, consider supporting the project. It helps me keep building free tools.</p>
          <button className="donation-btn" onClick={donate}>Buy me a coffee ({CONFIG.DONATION_AMOUNT})</button>
          <p className="donation-note">Totally optional. Glad it helped either way.</p>
        </div>}

        <div className="wz-btns">
          {cur>0&&<button className="wz-b wz-bb" onClick={()=>setCur(cur-1)}>Back</button>}
          {cur<steps.length-1&&<button className="wz-b wz-bn" onClick={()=>setCur(cur+1)}>Next step</button>}
        </div>
      </div>
    </div>

    {/* FIXED BOTTOM BANNER (always visible) */}
    <div className="don-bar">
      <span className="don-bar-text">This tool is free and always will be.</span>
      <button className="don-bar-btn" onClick={donate}>&#9749; Buy me a coffee</button>
    </div>

    <button className="wz-fab" onClick={()=>setHlp(!hlp)} style={{bottom:60}}>{hlp?"\u2715":"?"}</button>
    <Helper open={hlp} onClose={()=>setHlp(false)}/>
  </div>;
}

// ============================================================
// APP (router)
// ============================================================
export default function App(){
  const[page,setPage]=useState("landing");
  return <div className="app"><style>{STYLES}</style>
    {page==="landing"?<Landing onStart={()=>{setPage("wizard");window.scrollTo(0,0);}}/>:
     <Wizard onHome={()=>{setPage("landing");window.scrollTo(0,0);}}/>}
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

/* HELPER */
.hlp{position:fixed;bottom:80px;right:20px;width:350px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 120px);background:var(--bg2);border:1px solid rgba(255,255,255,0.08);border-radius:16px;display:flex;flex-direction:column;z-index:200;box-shadow:0 20px 60px rgba(0,0,0,0.5);}
.hlp-hdr{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;}
.hlp-title{font-family:var(--mn);font-size:12px;color:var(--ac);letter-spacing:1px;text-transform:uppercase;}
.hlp-x{background:none;border:none;color:var(--tx3);font-size:16px;cursor:pointer;padding:4px;}
.hlp-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
.hlp-empty{font-size:13px;color:var(--tx3);line-height:1.6;padding:8px;}
.hlp-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;}
.hlp-u{align-self:flex-end;background:var(--acg);color:var(--ac);border-bottom-right-radius:4px;}
.hlp-a{align-self:flex-start;background:var(--bg3);color:var(--tx2);border-bottom-left-radius:4px;}
.hlp-loading{font-size:12px;color:var(--tx3);font-style:italic;}
.hlp-inp{padding:10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;}
.hlp-inp input{flex:1;padding:10px 14px;background:var(--bg);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--tx);font-size:13px;font-family:var(--sn);outline:none;}
.hlp-inp button{padding:10px 16px;background:var(--ac);color:var(--bg);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--sn);}

@media(max-width:640px){.stats{gap:20px;}.stat-n{font-size:30px;}.sec{padding:64px 20px;}.hero{padding:100px 20px 60px;}}
`;
