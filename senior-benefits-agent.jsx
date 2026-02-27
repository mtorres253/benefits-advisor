import { useState, useRef, useEffect } from "react";

const buildSystemPrompt = (isVeteran) => `You are a compassionate, knowledgeable benefits counselor specializing in programs for seniors (adults 60+) in the United States. You are an autonomous agent that helps find and explain benefits available in any US geographic area.

${isVeteran ? `⭐ VETERAN STATUS: This person IS a veteran. Always lead with and emphasize veteran-specific benefits alongside general senior benefits.` : `This person has not indicated veteran status. Focus on general senior benefits, but briefly mention that veteran benefits may also be available if they served.`}

When given a location (city, county, state, or zip code), you will:

1. **ALWAYS search within a 10-mile radius** of the given location. This means you should include:
   - Programs based in the exact city/zip provided
   - Programs in neighboring cities, towns, or counties within ~10 miles
   - Regional programs that serve the broader area
   - Begin your response by noting: "Searching within 10 miles of [location]..."

2. Search your knowledge for ALL relevant benefits programs including:
   - Federal programs (Medicare, Medicaid, Social Security, SSI, SNAP, LIHEAP, Extra Help/LIS, Medicare Savings Programs)
   - State-specific programs (property tax relief, pharmaceutical assistance, home care, Medicaid waivers, state senior services)
   - Local/county programs within 10-mile radius (Meals on Wheels, transportation, senior centers, local utility assistance, Area Agency on Aging)
   ${isVeteran ? `
   - **VETERAN-SPECIFIC PROGRAMS (PRIORITIZE THESE)**:
     * VA Healthcare (nearest VA Medical Centers and Community-Based Outpatient Clinics within 10 miles)
     * VA Pension and Survivors Benefits
     * Aid & Attendance benefit (for veterans needing in-home care)
     * Housebound benefit
     * VA Home Loan Guaranty
     * State veterans benefits and property tax exemptions
     * County Veterans Service Officers (CVSO) - find the nearest one
     * Vet Centers for counseling
     * Veterans Service Organizations (VFW, American Legion, DAV posts within 10 miles)
     * VA Caregiver Support Program
     * CHAMPVA for eligible dependents
     * State Veterans Homes for long-term care
     * Burial and memorial benefits
   ` : `   - Veterans benefits (mention briefly if applicable)`}
   - Housing assistance programs (HUD, Section 8, USDA rural housing)
   - Legal aid services for seniors
   - Mental health and social programs

3. For each benefit, provide:
   - Program name and administering agency
   - Who qualifies (eligibility requirements including income/asset limits, service requirements for veterans)
   - What it covers
   - How to apply (phone number, website, physical address if within 10-mile radius)
   - Any important deadlines or enrollment periods

4. Organize benefits by category with clear headers
5. Note any programs with upcoming enrollment periods
6. Highlight the 2-3 MOST IMPACTFUL benefits to pursue first
7. Suggest next steps

Be specific, actionable, and thorough. Include actual phone numbers and websites. Format your response with clear sections using markdown. Always mention the geographic scope (10-mile radius) in your response.`;

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
      <span></span><span></span><span></span>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  
  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/### (.*?)(\n|$)/g, '<h4>$1</h4>')
      .replace(/## (.*?)(\n|$)/g, '<h3>$1</h3>')
      .replace(/# (.*?)(\n|$)/g, '<h2>$1</h2>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n- /g, '<br/>• ')
      .replace(/\n\* /g, '<br/>• ')
      .replace(/\n/g, '<br/>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  };

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="avatar"><span>🌿</span></div>
      )}
      <div className="bubble">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: `<p>${formatText(message.content)}</p>` }} />
        )}
      </div>
      {isUser && (
        <div className="avatar user-avatar"><span>👤</span></div>
      )}
    </div>
  );
}

function VeteranToggle({ isVeteran, onChange }) {
  return (
    <div className={`veteran-toggle ${isVeteran ? 'active' : ''}`} onClick={onChange}>
      <div className="toggle-left">
        <span className="toggle-icon">{isVeteran ? '🎖️' : '🪖'}</span>
        <div className="toggle-text">
          <span className="toggle-label">{isVeteran ? 'Veteran Benefits ON' : 'Are you a veteran?'}</span>
          <span className="toggle-sub">{isVeteran ? 'VA & military benefits included' : 'Tap to include veteran benefits'}</span>
        </div>
      </div>
      <div className={`toggle-switch ${isVeteran ? 'on' : 'off'}`}>
        <div className="toggle-knob"></div>
      </div>
    </div>
  );
}

export default function SeniorBenefitsAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [isVeteran, setIsVeteran] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text) => {
    const rawInput = text || input.trim();
    if (!rawInput || isLoading) return;

    setInput("");
    setStarted(true);

    const displayContent = rawInput + (isVeteran ? "  🎖️" : "");
    const apiContent = rawInput
      + (isVeteran ? "\n\n[Context: This person is a US military veteran. Please include all applicable veteran-specific benefits and VA resources within 10 miles.]" : "")
      + "\n[Please search within a 10-mile radius of the provided location.]";

    const displayMessages = [...messages, { role: "user", content: displayContent }];
    setMessages(displayMessages);
    setIsLoading(true);

    // Build clean api messages (strip display badges)
    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content.replace(/  🎖️$/, "") })),
      { role: "user", content: apiContent }
    ];

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: buildSystemPrompt(isVeteran),
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const assistantText = data.content?.map(b => b.text || "").join("") || "I'm sorry, I couldn't retrieve information at this time. Please try again.";
      setMessages([...displayMessages, { role: "assistant", content: assistantText }]);
    } catch (err) {
      setMessages([...displayMessages, { role: "assistant", content: "I encountered an error. Please check your connection and try again." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickStarts = isVeteran ? [
    "VA benefits for a senior veteran in San Diego, CA",
    "Find VA clinics and veteran programs near Nashville, TN",
    "Veteran pension and Aid & Attendance near Atlanta, GA 30301",
    "Benefits for a senior veteran in rural Texas near Lubbock",
  ] : [
    "What benefits are available for seniors in Miami, FL?",
    "Find senior programs near zip code 40601 in Kentucky",
    "Benefits for a 72-year-old with low income in Chicago, IL",
    "Senior services near downtown Phoenix, AZ",
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Source+Sans+3:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, #root { min-height: 100vh; background: #f5f0e8; font-family: 'Source Sans 3', sans-serif; }

        .app {
          display: flex; flex-direction: column; height: 100vh;
          max-width: 860px; margin: 0 auto;
          background: #faf7f2; box-shadow: 0 0 60px rgba(0,0,0,0.08);
          transition: all 0.3s;
        }

        .header {
          background: #2d5a3d; color: white;
          padding: 18px 28px 14px;
          display: flex; align-items: center; gap: 16px;
          border-bottom: 3px solid #c8a96e;
          transition: background 0.4s;
        }
        .app.vet .header { background: linear-gradient(120deg, #2d5a3d 50%, #6b3d18); }

        .header-icon {
          width: 46px; height: 46px; background: #c8a96e;
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; font-size: 22px; flex-shrink: 0;
        }
        .header-text h1 { font-family: 'Playfair Display', serif; font-size: 21px; font-weight: 600; }
        .header-text p { font-size: 12.5px; opacity: 0.8; font-weight: 300; margin-top: 2px; }
        .status-dot {
          width: 7px; height: 7px; background: #7ecb8f;
          border-radius: 50%; display: inline-block; margin-right: 5px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .veteran-banner {
          background: linear-gradient(90deg, #7a4a20, #b07030);
          color: white; font-size: 12px; font-weight: 600;
          text-align: center; padding: 6px 16px;
          letter-spacing: 0.8px; animation: fadeUp 0.3s ease;
        }

        .controls-bar {
          background: #f0ebe0; border-bottom: 1px solid #e0d8c8;
          padding: 10px 18px; display: flex; align-items: center;
          gap: 12px; flex-wrap: wrap;
        }

        .veteran-toggle {
          display: flex; align-items: center; gap: 12px;
          background: white; border: 1.5px solid #d4c9b0;
          border-radius: 12px; padding: 8px 14px;
          cursor: pointer; transition: all 0.25s;
          user-select: none; flex: 1; min-width: 210px;
        }
        .veteran-toggle.active { border-color: #9b6030; background: #fdf3e3; }
        .toggle-left { display: flex; align-items: center; gap: 10px; flex: 1; }
        .toggle-icon { font-size: 20px; }
        .toggle-text { display: flex; flex-direction: column; }
        .toggle-label { font-size: 13px; font-weight: 500; color: #3a2a10; }
        .veteran-toggle.active .toggle-label { color: #9b6030; }
        .toggle-sub { font-size: 11px; color: #9a8a70; margin-top: 1px; }
        .toggle-switch {
          width: 40px; height: 22px; border-radius: 11px;
          background: #d4c9b0; position: relative;
          transition: background 0.25s; flex-shrink: 0;
        }
        .toggle-switch.on { background: #9b6030; }
        .toggle-knob {
          width: 16px; height: 16px; border-radius: 50%;
          background: white; position: absolute; top: 3px; left: 3px;
          transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .toggle-switch.on .toggle-knob { transform: translateX(18px); }

        .radius-pill {
          display: flex; align-items: center; gap: 5px;
          background: #e8f4ec; border: 1px solid #b8d8c0;
          border-radius: 20px; padding: 5px 12px;
          font-size: 12px; color: #2d5a3d; white-space: nowrap;
        }

        .categories {
          display: flex; gap: 7px; padding: 9px 18px;
          overflow-x: auto; background: #f5f0e8;
          border-bottom: 1px solid #e0d8c8; scrollbar-width: none;
        }
        .categories::-webkit-scrollbar { display: none; }
        .category-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 11px; background: white;
          border: 1px solid #d4c9b0; border-radius: 20px;
          font-size: 12px; font-weight: 500; color: #5a4a30;
          white-space: nowrap; cursor: pointer; transition: all 0.2s;
        }
        .category-chip:hover { background: #2d5a3d; color: white; border-color: #2d5a3d; }
        .category-chip.vet-chip { border-color: #c8a96e; color: #8b5020; }
        .category-chip.vet-chip:hover { background: #9b6030; border-color: #9b6030; color: white; }

        .chat-area {
          flex: 1; overflow-y: auto; padding: 22px;
          display: flex; flex-direction: column; gap: 20px;
        }

        .welcome { text-align: center; padding: 28px 20px; animation: fadeUp 0.6s ease; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .welcome-icon { font-size: 50px; margin-bottom: 14px; display: block; }
        .welcome h2 { font-family: 'Playfair Display', serif; font-size: 23px; color: #2d5a3d; margin-bottom: 10px; }
        .welcome.vet h2 { color: #9b6030; }
        .welcome p { color: #7a6a50; font-size: 14px; line-height: 1.6; max-width: 480px; margin: 0 auto 22px; }
        .quick-starts { display: flex; flex-direction: column; gap: 9px; max-width: 520px; margin: 0 auto; }
        .qs-btn {
          background: white; border: 1.5px solid #c8a96e;
          border-radius: 10px; padding: 11px 15px;
          text-align: left; font-family: 'Source Sans 3', sans-serif;
          font-size: 13.5px; color: #4a3a20; cursor: pointer;
          transition: all 0.2s; line-height: 1.4;
        }
        .qs-btn.vet { border-color: #9b6030; color: #5a2a08; }
        .qs-btn:hover { background: #2d5a3d; color: white; border-color: #2d5a3d; transform: translateX(4px); }
        .qs-btn.vet:hover { background: #9b6030; border-color: #9b6030; }
        .qs-btn::before { content: '→ '; color: #c8a96e; }

        .message { display: flex; align-items: flex-start; gap: 12px; animation: fadeUp 0.3s ease; }
        .message.user { flex-direction: row-reverse; }
        .avatar {
          width: 34px; height: 34px; border-radius: 9px;
          background: #2d5a3d; display: flex; align-items: center;
          justify-content: center; font-size: 17px; flex-shrink: 0;
        }
        .user-avatar { background: #c8a96e; }

        .bubble {
          max-width: 78%; padding: 13px 17px; border-radius: 16px;
          font-size: 14px; line-height: 1.65; color: #2a2010;
        }
        .message.assistant .bubble {
          background: white; border: 1px solid #e8e0d0;
          border-top-left-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .message.user .bubble { background: #2d5a3d; color: white; border-top-right-radius: 4px; }
        .app.vet .message.user .bubble { background: #9b6030; }
        .bubble h2, .bubble h3, .bubble h4 { font-family: 'Playfair Display', serif; color: #2d5a3d; margin: 14px 0 5px; }
        .bubble h2 { font-size: 16px; } .bubble h3 { font-size: 15px; } .bubble h4 { font-size: 14px; }
        .bubble strong { color: #2d5a3d; }
        .bubble a { color: #2d5a3d; font-weight: 500; }
        .bubble p { margin-bottom: 8px; } .bubble p:last-child { margin-bottom: 0; }
        .message.user .bubble h2, .message.user .bubble h3, .message.user .bubble h4,
        .message.user .bubble strong { color: #d8f0e0; }

        .typing-indicator {
          display: flex; gap: 5px; padding: 13px 17px;
          background: white; border: 1px solid #e8e0d0;
          border-radius: 16px; border-top-left-radius: 4px;
          width: fit-content; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .typing-indicator span { width: 7px; height: 7px; background: #c8a96e; border-radius: 50%; animation: bounce 1.2s infinite; }
        .typing-indicator span:nth-child(2){animation-delay:.2s} .typing-indicator span:nth-child(3){animation-delay:.4s}
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        .typing-row { display: flex; align-items: flex-start; gap: 12px; animation: fadeUp 0.3s ease; }

        .input-area { padding: 13px 20px 16px; background: #f0ebe0; border-top: 1px solid #e0d8c8; }
        .input-row { display: flex; gap: 10px; align-items: flex-end; }
        .input-box {
          flex: 1; background: white; border: 1.5px solid #d4c9b0;
          border-radius: 12px; padding: 11px 15px;
          font-family: 'Source Sans 3', sans-serif; font-size: 14px;
          color: #2a2010; resize: none; outline: none;
          transition: border-color 0.2s; min-height: 46px; max-height: 110px;
        }
        .input-box:focus { border-color: #2d5a3d; }
        .app.vet .input-box:focus { border-color: #9b6030; }
        .input-box::placeholder { color: #b0a080; }
        .send-btn {
          width: 46px; height: 46px; background: #2d5a3d;
          border: none; border-radius: 12px; color: white;
          font-size: 20px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
        }
        .app.vet .send-btn { background: #9b6030; }
        .send-btn:hover:not(:disabled) { filter: brightness(0.85); transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .input-hint { font-size: 11px; color: #a09070; margin-top: 7px; text-align: center; }
        .disclaimer { font-size: 11px; color: #a09070; text-align: center; padding: 7px 24px 10px; line-height: 1.5; }
      `}</style>

      <div className={`app ${isVeteran ? 'vet' : ''}`}>
        <div className="header">
          <div className="header-icon">{isVeteran ? '🎖️' : '🌿'}</div>
          <div className="header-text">
            <h1>Senior Benefits Advisor</h1>
            <p><span className="status-dot"></span>Autonomous AI agent · All 50 states · 10-mile radius search</p>
          </div>
        </div>

        {isVeteran && (
          <div className="veteran-banner">🎖️ VETERAN MODE ACTIVE — VA & military benefits included in all searches</div>
        )}

        <div className="controls-bar">
          <VeteranToggle isVeteran={isVeteran} onChange={() => setIsVeteran(v => !v)} />
          <div className="radius-pill">📍 <strong>10-mile</strong>&nbsp;radius search</div>
        </div>

        <div className="categories">
          {categories.map(c => (
            <div
              key={c.label}
              className={`category-chip ${c.label === 'Veterans' ? 'vet-chip' : ''}`}
              onClick={() => {
                const q = c.label === 'Veterans'
                  ? "What veteran benefits are available for senior veterans in my area?"
                  : `What ${c.label.toLowerCase()} benefits are available for seniors in my area?`;
                setInput(q);
                inputRef.current?.focus();
              }}
            >
              {c.icon} {c.label}
            </div>
          ))}
        </div>

        <div className="chat-area">
          {!started && (
            <div className={`welcome ${isVeteran ? 'vet' : ''}`}>
              <span className="welcome-icon">{isVeteran ? '🎖️' : '🌻'}</span>
              <h2>{isVeteran ? 'Senior Veteran Benefits Finder' : 'Find Benefits for Any Senior in America'}</h2>
              <p>
                {isVeteran
                  ? "I'll search within 10 miles of any US location to find VA benefits, veteran-specific programs, and all other senior benefits you've earned."
                  : "I search within a 10-mile radius of any US location to find every federal, state, and local benefit program for adults 60+. Toggle veteran mode above to include VA benefits."}
              </p>
              <div className="quick-starts">
                {quickStarts.map(qs => (
                  <button key={qs} className={`qs-btn ${isVeteran ? 'vet' : ''}`} onClick={() => sendMessage(qs)}>
                    {qs}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isLoading && (
            <div className="typing-row">
              <div className="avatar"><span>{isVeteran ? '🎖️' : '🌿'}</span></div>
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="input-row">
            <textarea
              ref={inputRef}
              className="input-box"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isVeteran ? "Enter a city, state, or zip code to find veteran & senior benefits..." : "Enter a city, county, state, or zip code..."}
              rows={1}
              disabled={isLoading}
            />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || isLoading}>↑</button>
          </div>
          <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
        </div>

        <p className="disclaimer">
          For informational purposes only. Verify eligibility and details with administering agencies. Not affiliated with any government entity.
        </p>
      </div>
    </>
  );
}
