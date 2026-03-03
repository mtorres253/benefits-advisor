import { useState, useRef, useEffect } from "react";
import AuthModal from "./components/AuthModal.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";

// ─── Prompt builder ───────────────────────────────────────────────────────────
const buildSystemPrompt = (isVeteran) => `You are a compassionate, knowledgeable benefits counselor specializing in programs for seniors (adults 60+) in the United States. You are an autonomous agent that helps find and explain benefits available in any US geographic area.

${isVeteran
  ? `VETERAN STATUS: This person IS a veteran. Always lead with and emphasize veteran-specific benefits alongside general senior benefits.`
  : `This person has not indicated veteran status. Focus on general senior benefits, but briefly mention that veteran benefits may also be available if they served.`}

When given a location (city, county, state, or zip code), you will:

1. ALWAYS search within a 10-mile radius of the given location. Begin your response by noting: "Searching within 10 miles of [location]..."

2. Search for ALL relevant benefits including:
   - Federal programs (Medicare, Medicaid, Social Security, SSI, SNAP, LIHEAP, Extra Help/LIS, Medicare Savings Programs)
   - State-specific programs (property tax relief, pharmaceutical assistance, home care, Medicaid waivers)
   - Local/county programs within 10-mile radius (Meals on Wheels, transportation, senior centers, Area Agency on Aging)
   ${isVeteran ? `
   - VETERAN-SPECIFIC PROGRAMS (PRIORITIZE):
     * VA Healthcare (nearest VA Medical Centers and Community-Based Outpatient Clinics within 10 miles)
     * VA Pension and Survivors Benefits
     * Aid & Attendance benefit
     * Housebound benefit
     * VA Home Loan Guaranty
     * State veterans benefits and property tax exemptions
     * County Veterans Service Officers (CVSO)
     * Veterans Service Organizations (VFW, American Legion, DAV posts within 10 miles)
     * VA Caregiver Support Program
     * CHAMPVA, State Veterans Homes, burial benefits
   ` : `   - Veterans benefits (mention briefly)`}
   - Housing assistance (HUD, Section 8, USDA rural housing)
   - Legal aid, mental health, and social programs

3. For each benefit provide: program name, agency, eligibility, what it covers, how to apply (phone/website/address), deadlines.
4. Organize by category with clear headers.
5. Highlight the 2-3 most impactful benefits to pursue first.
6. Suggest next steps.

Be specific and thorough. Include actual phone numbers and websites. Format with clear markdown sections.`;

const categories = [
  { icon: "🏥", label: "Healthcare" },
  { icon: "🏠", label: "Housing" },
  { icon: "🍽️", label: "Food & Nutrition" },
  { icon: "💊", label: "Prescriptions" },
  { icon: "⚡", label: "Utilities" },
  { icon: "🚌", label: "Transportation" },
  { icon: "🎖️", label: "Veterans" },
  { icon: "💰", label: "Financial Aid" },
];

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span /><span /><span />
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const formatText = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/### (.*?)(\n|$)/g, "<h4>$1</h4>")
      .replace(/## (.*?)(\n|$)/g, "<h3>$1</h3>")
      .replace(/# (.*?)(\n|$)/g, "<h2>$1</h2>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n- /g, "<br/>• ")
      .replace(/\n\* /g, "<br/>• ")
      .replace(/\n/g, "<br/>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return (
    <div className={"message " + (isUser ? "user" : "assistant")}>
      {!isUser && <div className="avatar"><span>🌿</span></div>}
      <div className="bubble">
        {isUser
          ? <p>{message.content}</p>
          : <div dangerouslySetInnerHTML={{ __html: "<p>" + formatText(message.content) + "</p>" }} />}
      </div>
      {isUser && <div className="avatar user-avatar"><span>👤</span></div>}
    </div>
  );
}

function VeteranToggle({ isVeteran, onChange }) {
  return (
    <div className={"veteran-toggle " + (isVeteran ? "active" : "")} onClick={onChange}>
      <div className="toggle-left">
        <span className="toggle-icon">{isVeteran ? "🎖️" : "🪖"}</span>
        <div className="toggle-text">
          <span className="toggle-label">{isVeteran ? "Veteran Benefits ON" : "Are you a veteran?"}</span>
          <span className="toggle-sub">{isVeteran ? "VA & military benefits included" : "Tap to include veteran benefits"}</span>
        </div>
      </div>
      <div className={"toggle-switch " + (isVeteran ? "on" : "off")}>
        <div className="toggle-knob" />
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Auth state — restore from localStorage on mount
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sba_user")) } catch { return null }
  });
  const [showAuth, setShowAuth]       = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted]   = useState(false);
  // Veteran toggle: prefer saved profile, fall back to local state
  const [isVeteran, setIsVeteran] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sba_user"))?.isVeteran ?? false } catch { return false }
  });

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Sync veteran toggle when user logs in/out
  const handleAuth = (newUser) => {
    setUser(newUser);
    setIsVeteran(newUser.isVeteran ?? false);
  };

  const handleLogout = () => {
    setUser(null);
    setIsVeteran(false);
  };

  const handleProfileUpdate = (updated) => {
    setUser(updated);
    setIsVeteran(updated.isVeteran ?? false);
  };

  const sendMessage = async (text) => {
    const rawInput = text || input.trim();
    if (!rawInput || isLoading) return;

    setInput(""); setStarted(true);

    const displayContent = rawInput + (isVeteran ? "  🎖️" : "");
    const apiContent =
      rawInput +
      (isVeteran ? "\n\n[Context: veteran. Include all VA resources within 10 miles.]" : "") +
      "\n[Search within a 10-mile radius.]";

    const displayMessages = [...messages, { role: "user", content: displayContent }];
    setMessages(displayMessages);
    setIsLoading(true);

    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content.replace(/  🎖️$/, "") })),
      { role: "user", content: apiContent },
    ];

    try {
      const token = localStorage.getItem("sba_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: buildSystemPrompt(isVeteran),
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const assistantText =
        data.content?.map(b => b.text || "").join("") ||
        "I'm sorry, I couldn't retrieve information at this time.";
      setMessages([...displayMessages, { role: "assistant", content: assistantText }]);
    } catch {
      setMessages([...displayMessages, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickStarts = isVeteran
    ? ["VA benefits for a senior veteran in San Diego, CA", "Find VA clinics near Nashville, TN", "Veteran pension and Aid & Attendance near Atlanta, GA", "Benefits for a senior veteran near Lubbock, TX"]
    : ["What benefits are available for seniors in Miami, FL?", "Find senior programs near zip code 40601 in Kentucky", "Benefits for a 72-year-old with low income in Chicago, IL", "Senior services near downtown Phoenix, AZ"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Source+Sans+3:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body, #root { min-height: 100vh; background: #f5f0e8; font-family: 'Source Sans 3', sans-serif; }

        .app { display:flex; flex-direction:column; height:100vh; max-width:860px; margin:0 auto; background:#faf7f2; box-shadow:0 0 60px rgba(0,0,0,0.08); }

        /* Header */
        .header { background:#2d5a3d; color:white; padding:14px 20px; display:flex; align-items:center; gap:12px; border-bottom:3px solid #c8a96e; transition:background 0.4s; }
        .app.vet .header { background:linear-gradient(120deg,#2d5a3d 50%,#6b3d18); }
        .header-icon { width:42px; height:42px; background:#c8a96e; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
        .header-text { flex:1; }
        .header-text h1 { font-family:'Playfair Display',serif; font-size:19px; font-weight:600; }
        .header-text p  { font-size:12px; opacity:0.78; font-weight:300; margin-top:1px; }
        .status-dot { width:6px; height:6px; background:#7ecb8f; border-radius:50%; display:inline-block; margin-right:4px; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* Auth buttons in header */
        .header-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .user-badge {
          display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.15);
          border-radius:8px; padding:6px 10px; cursor:pointer; transition:background 0.2s;
        }
        .user-badge:hover { background:rgba(255,255,255,0.25); }
        .user-badge-name { font-size:13px; font-weight:500; }
        .user-badge-vet { font-size:11px; opacity:0.8; margin-top:1px; }
        .sign-in-btn {
          background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.4);
          color:white; border-radius:8px; padding:7px 14px;
          font-family:'Source Sans 3',sans-serif; font-size:13px; font-weight:500;
          cursor:pointer; transition:all 0.2s;
        }
        .sign-in-btn:hover { background:rgba(255,255,255,0.3); }

        .veteran-banner { background:linear-gradient(90deg,#7a4a20,#b07030); color:white; font-size:12px; font-weight:600; text-align:center; padding:5px 16px; letter-spacing:0.8px; }

        /* Controls */
        .controls-bar { background:#f0ebe0; border-bottom:1px solid #e0d8c8; padding:9px 18px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
        .veteran-toggle { display:flex; align-items:center; gap:12px; background:white; border:1.5px solid #d4c9b0; border-radius:12px; padding:7px 13px; cursor:pointer; transition:all 0.25s; user-select:none; flex:1; min-width:200px; }
        .veteran-toggle.active { border-color:#9b6030; background:#fdf3e3; }
        .toggle-left { display:flex; align-items:center; gap:10px; flex:1; }
        .toggle-icon { font-size:18px; }
        .toggle-text { display:flex; flex-direction:column; }
        .toggle-label { font-size:12.5px; font-weight:500; color:#3a2a10; }
        .veteran-toggle.active .toggle-label { color:#9b6030; }
        .toggle-sub { font-size:11px; color:#9a8a70; margin-top:1px; }
        .toggle-switch { width:38px; height:20px; border-radius:10px; background:#d4c9b0; position:relative; transition:background 0.25s; flex-shrink:0; }
        .toggle-switch.on { background:#9b6030; }
        .toggle-knob { width:14px; height:14px; border-radius:50%; background:white; position:absolute; top:3px; left:3px; transition:transform 0.25s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
        .toggle-switch.on .toggle-knob { transform:translateX(18px); }
        .radius-pill { display:flex; align-items:center; gap:5px; background:#e8f4ec; border:1px solid #b8d8c0; border-radius:20px; padding:4px 11px; font-size:11.5px; color:#2d5a3d; white-space:nowrap; }

        /* Categories */
        .categories { display:flex; gap:7px; padding:8px 18px; overflow-x:auto; background:#f5f0e8; border-bottom:1px solid #e0d8c8; scrollbar-width:none; }
        .categories::-webkit-scrollbar { display:none; }
        .category-chip { display:flex; align-items:center; gap:5px; padding:4px 10px; background:white; border:1px solid #d4c9b0; border-radius:20px; font-size:11.5px; font-weight:500; color:#5a4a30; white-space:nowrap; cursor:pointer; transition:all 0.2s; }
        .category-chip:hover { background:#2d5a3d; color:white; border-color:#2d5a3d; }
        .category-chip.vet-chip { border-color:#c8a96e; color:#8b5020; }
        .category-chip.vet-chip:hover { background:#9b6030; border-color:#9b6030; color:white; }

        /* Chat */
        .chat-area { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:18px; }
        .welcome { text-align:center; padding:24px 20px; animation:fadeUp 0.6s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .welcome-icon { font-size:48px; margin-bottom:12px; display:block; }
        .welcome h2 { font-family:'Playfair Display',serif; font-size:22px; color:#2d5a3d; margin-bottom:8px; }
        .welcome.vet h2 { color:#9b6030; }
        .welcome p { color:#7a6a50; font-size:14px; line-height:1.6; max-width:460px; margin:0 auto 20px; }
        .quick-starts { display:flex; flex-direction:column; gap:8px; max-width:500px; margin:0 auto; }
        .qs-btn { background:white; border:1.5px solid #c8a96e; border-radius:10px; padding:10px 14px; text-align:left; font-family:'Source Sans 3',sans-serif; font-size:13px; color:#4a3a20; cursor:pointer; transition:all 0.2s; line-height:1.4; }
        .qs-btn.vet { border-color:#9b6030; color:#5a2a08; }
        .qs-btn:hover { background:#2d5a3d; color:white; border-color:#2d5a3d; transform:translateX(4px); }
        .qs-btn.vet:hover { background:#9b6030; border-color:#9b6030; }
        .qs-btn::before { content:'→ '; color:#c8a96e; }

        .message { display:flex; align-items:flex-start; gap:10px; animation:fadeUp 0.3s ease; }
        .message.user { flex-direction:row-reverse; }
        .avatar { width:32px; height:32px; border-radius:8px; background:#2d5a3d; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
        .user-avatar { background:#c8a96e; }
        .bubble { max-width:78%; padding:12px 16px; border-radius:15px; font-size:14px; line-height:1.65; color:#2a2010; }
        .message.assistant .bubble { background:white; border:1px solid #e8e0d0; border-top-left-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .message.user .bubble { background:#2d5a3d; color:white; border-top-right-radius:4px; }
        .app.vet .message.user .bubble { background:#9b6030; }
        .bubble h2,.bubble h3,.bubble h4 { font-family:'Playfair Display',serif; color:#2d5a3d; margin:13px 0 4px; }
        .bubble h2{font-size:15px}.bubble h3{font-size:14.5px}.bubble h4{font-size:14px}
        .bubble strong { color:#2d5a3d; }
        .bubble a { color:#2d5a3d; font-weight:500; }
        .bubble p { margin-bottom:7px; } .bubble p:last-child { margin-bottom:0; }
        .message.user .bubble h2,.message.user .bubble h3,.message.user .bubble h4,.message.user .bubble strong { color:#d8f0e0; }

        .typing-indicator { display:flex; gap:5px; padding:12px 16px; background:white; border:1px solid #e8e0d0; border-radius:15px; border-top-left-radius:4px; width:fit-content; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .typing-indicator span { width:7px; height:7px; background:#c8a96e; border-radius:50%; animation:bounce 1.2s infinite; }
        .typing-indicator span:nth-child(2){animation-delay:.2s} .typing-indicator span:nth-child(3){animation-delay:.4s}
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        .typing-row { display:flex; align-items:flex-start; gap:10px; animation:fadeUp 0.3s ease; }

        /* Input */
        .input-area { padding:12px 18px 15px; background:#f0ebe0; border-top:1px solid #e0d8c8; }
        .input-row { display:flex; gap:9px; align-items:flex-end; }
        .input-box { flex:1; background:white; border:1.5px solid #d4c9b0; border-radius:11px; padding:10px 14px; font-family:'Source Sans 3',sans-serif; font-size:14px; color:#2a2010; resize:none; outline:none; transition:border-color 0.2s; min-height:44px; max-height:100px; }
        .input-box:focus { border-color:#2d5a3d; }
        .app.vet .input-box:focus { border-color:#9b6030; }
        .input-box::placeholder { color:#b0a080; }
        .send-btn { width:44px; height:44px; background:#2d5a3d; border:none; border-radius:11px; color:white; font-size:19px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; flex-shrink:0; }
        .app.vet .send-btn { background:#9b6030; }
        .send-btn:hover:not(:disabled) { filter:brightness(0.85); transform:scale(1.05); }
        .send-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .input-hint { font-size:11px; color:#a09070; margin-top:6px; text-align:center; }
        .disclaimer { font-size:11px; color:#a09070; text-align:center; padding:6px 24px 10px; line-height:1.5; }

        /* Saved profile notice */
        .profile-saved-notice {
          background:#e8f4ec; border:1px solid #b8d8c0; border-radius:8px;
          padding:8px 13px; font-size:12px; color:#2d5a3d;
          display:flex; align-items:center; gap:8px; margin:0 18px 0;
        }
      `}</style>

      <div className={"app " + (isVeteran ? "vet" : "")}>
        {/* ── Header ── */}
        <div className="header">
          <div className="header-icon">{isVeteran ? "🎖️" : "🌿"}</div>
          <div className="header-text">
            <h1>Senior Benefits Advisor</h1>
            <p><span className="status-dot" />Autonomous AI · All 50 states · 10-mile radius</p>
          </div>
          <div className="header-actions">
            {user ? (
              <div className="user-badge" onClick={() => setShowProfile(true)}>
                <div>
                  <div className="user-badge-name">👤 {user.firstName}</div>
                  {user.isVeteran && <div className="user-badge-vet">🎖️ Veteran</div>}
                </div>
              </div>
            ) : (
              <button className="sign-in-btn" onClick={() => setShowAuth(true)}>Sign In</button>
            )}
          </div>
        </div>

        {isVeteran && (
          <div className="veteran-banner">🎖️ VETERAN MODE ACTIVE — VA & military benefits included</div>
        )}

        {/* ── Controls ── */}
        <div className="controls-bar">
          <VeteranToggle
            isVeteran={isVeteran}
            onChange={() => {
              const next = !isVeteran;
              setIsVeteran(next);
              // If logged in, persist immediately
              if (user) {
                const token = localStorage.getItem("sba_token");
                fetch("/api/auth/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                  body: JSON.stringify({ isVeteran: next }),
                }).then(r => r.json()).then(updated => {
                  setUser(updated);
                  localStorage.setItem("sba_user", JSON.stringify(updated));
                }).catch(() => {});
              }
            }}
          />
          <div className="radius-pill">📍 <strong>10-mile</strong>&nbsp;radius</div>
        </div>

        {/* Saved profile notice */}
        {user && (
          <div className="profile-saved-notice">
            ✓ Signed in as <strong>{user.firstName} {user.lastName}</strong>
            {user.zipCode ? ` · Home ZIP: ${user.zipCode}` : ""}
            {user.isVeteran ? " · 🎖️ Veteran profile active" : ""}
          </div>
        )}

        {/* ── Categories ── */}
        <div className="categories">
          {categories.map(c => (
            <div
              key={c.label}
              className={"category-chip " + (c.label === "Veterans" ? "vet-chip" : "")}
              onClick={() => {
                const q = c.label === "Veterans"
                  ? "What veteran benefits are available for senior veterans in my area?"
                  : "What " + c.label.toLowerCase() + " benefits are available for seniors in my area?";
                setInput(q);
                inputRef.current?.focus();
              }}
            >
              {c.icon} {c.label}
            </div>
          ))}
        </div>

        {/* ── Chat ── */}
        <div className="chat-area">
          {!started && (
            <div className={"welcome " + (isVeteran ? "vet" : "")}>
              <span className="welcome-icon">{isVeteran ? "🎖️" : "🌻"}</span>
              <h2>{isVeteran ? "Senior Veteran Benefits Finder" : "Find Benefits for Any Senior in America"}</h2>
              <p>
                {isVeteran
                  ? "I'll search within 10 miles of any US location to find VA benefits, veteran-specific programs, and all other senior benefits you've earned."
                  : "I search within a 10-mile radius of any US location to find every federal, state, and local benefit program for adults 60+."}
                {!user && " Sign in to save your preferences."}
              </p>
              <div className="quick-starts">
                {quickStarts.map(qs => (
                  <button key={qs} className={"qs-btn " + (isVeteran ? "vet" : "")} onClick={() => sendMessage(qs)}>
                    {qs}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}

          {isLoading && (
            <div className="typing-row">
              <div className="avatar"><span>{isVeteran ? "🎖️" : "🌿"}</span></div>
              <TypingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div className="input-area">
          <div className="input-row">
            <textarea
              ref={inputRef}
              className="input-box"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isVeteran ? "Enter a location to find veteran & senior benefits..." : "Enter a city, county, state, or zip code..."}
              rows={1}
              disabled={isLoading}
            />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || isLoading}>↑</button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>

        <p className="disclaimer">For informational purposes only. Verify details with administering agencies. Not affiliated with any government entity.</p>
      </div>

      {/* ── Modals ── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={handleAuth} />}
      {showProfile && user && (
        <ProfilePanel
          user={user}
          onUpdate={handleProfileUpdate}
          onLogout={handleLogout}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}
