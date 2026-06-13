/* ============================================================
   TECHNYAH — AI Support Assistant widget
   - Answers questions from a built-in company knowledge base
   - Escalates to a human: collects contact info, emails a ticket
     to info@technyah.com (CC mhadid@), generates a ticket number
   - No backend required; runs on static hosting (GitHub Pages)

   AI responses use the in-app Anthropic endpoint when available
   (api.anthropic.com /v1/messages, no key passed). If that endpoint
   is not reachable from the live site, the assistant gracefully
   falls back to keyword matching over the knowledge base, so the
   widget always works. Either way, "talk to a person" always works.
   ============================================================ */

(function () {
  // ---- Company knowledge base (edit freely) ----
  const KB = [
    { q: ["service","services","what do you do","offer","capabilities"],
      a: "TECHNYAH provides robotic arms & manipulators, custom machinery, systems integration, conveyor systems, robotics training, and control systems engineering (PLC/VFD/HMI). See the Services page for details." },
    { q: ["product","products","drone","controller","dss","st-2500"],
      a: "Our products include the DSS-2 Drone Surveillance System and the ST-2500 Multi-Purpose Flight Controller. Pricing is by quote — I can help you start a quote request." },
    { q: ["quote","pricing","price","cost","estimate","bid"],
      a: "You can request a quote on the Get a Quote page. Share your application, timeline, and any drawings or specs, and the team responds within one business day. Want me to point you there or connect you with a person?" },
    { q: ["contact","reach","phone","email","talk","support","help"],
      a: "You can reach the team through the Contact page, or I can connect you with a support member right now and create a ticket. Just say \"talk to a person.\"" },
    { q: ["career","careers","job","jobs","hiring","apply","resume","internship"],
      a: "Open positions are on the Careers page — you can view details and apply with your resume directly. Applications go straight to our HR team." },
    { q: ["location","where","based","address","lakeland","florida"],
      a: "TECHNYAH is based in Lakeland, Florida, and works with clients across industry." },
    { q: ["plc","scada","hmi","vfd","integration","automation","robot","controls"],
      a: "Yes — we design, program, and commission automation and control systems (PLC, VFD, HMI, SCADA) and integrate robotics and machine vision. Tell me about your application and I can route you to the right next step." },
    { q: ["hours","response","how long","when","timeline"],
      a: "The team responds to inquiries within one business day. For something specific, I can open a support ticket so it's tracked." }
  ];

  const FALLBACK = "I can help with questions about our services, products, quotes, careers, and how to get in touch. I can also connect you with a support team member and open a ticket. What would you like to do?";

  function kbAnswer(text) {
    const t = text.toLowerCase();
    let best = null, score = 0;
    for (const item of KB) {
      const s = item.q.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
      if (s > score) { score = s; best = item; }
    }
    return score > 0 ? best.a : FALLBACK;
  }

  // ---- Try the in-app Anthropic endpoint; fall back to KB ----
  async function aiAnswer(history) {
    const systemKB = KB.map(k => "- " + k.a).join("\n");
    const sys = "You are TECHNYAH's website support assistant. TECHNYAH is a robotics, " +
      "automation, and control-systems engineering company in Lakeland, Florida. " +
      "Answer briefly and helpfully using this knowledge:\n" + systemKB +
      "\nIf the user wants a human, pricing they don't have, or anything you're unsure of, " +
      "suggest connecting them to a support member to open a ticket. Keep replies under 80 words.";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system: sys,
          messages: history
        })
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json();
      const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return txt || kbAnswer(history[history.length - 1].content);
    } catch (e) {
      return kbAnswer(history[history.length - 1].content);
    }
  }

  function ticketId() {
    const d = new Date();
    const ymd = "" + d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "TNY-" + ymd + "-" + rand;
  }

  // ---- Build UI ----
  const style = document.createElement("style");
  style.textContent = `
    .tny-chat-btn{position:fixed;bottom:22px;right:22px;z-index:1500;background:#00B4D8;color:#fff;border:none;border-radius:999px;padding:14px 20px;font-family:"Barlow Condensed",Arial,sans-serif;font-weight:600;font-size:1.05rem;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 18px rgba(14,27,37,.25);display:flex;align-items:center;gap:8px}
    .tny-chat-btn:hover{background:#0077B6}
    .tny-chat-btn svg{width:20px;height:20px}
    .tny-panel{position:fixed;bottom:22px;right:22px;z-index:1600;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 44px);background:#fff;border:1px solid #D9E0E6;border-radius:14px;box-shadow:0 16px 44px rgba(14,27,37,.28);display:none;flex-direction:column;overflow:hidden;font-family:Barlow,Arial,sans-serif}
    .tny-panel.open{display:flex}
    .tny-head{background:#0E1B25;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
    .tny-head h4{margin:0;font-family:"Barlow Condensed",Arial,sans-serif;font-size:1.15rem;letter-spacing:.04em;text-transform:uppercase}
    .tny-head .tny-sub{font-size:.72rem;color:#9FB2C0;display:block;text-transform:none;letter-spacing:0}
    .tny-x{background:none;border:none;color:#9FB2C0;font-size:1.4rem;line-height:1;cursor:pointer}
    .tny-x:hover{color:#fff}
    .tny-body{flex:1;overflow-y:auto;padding:14px;background:#F4F6F8;display:flex;flex-direction:column;gap:10px}
    .tny-msg{max-width:84%;padding:10px 13px;border-radius:12px;font-size:.92rem;line-height:1.5;white-space:pre-wrap}
    .tny-msg.bot{background:#fff;border:1px solid #D9E0E6;align-self:flex-start;border-bottom-left-radius:4px}
    .tny-msg.user{background:#00B4D8;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
    .tny-msg.sys{background:#E8EEF2;color:#16293A;align-self:center;font-size:.82rem;text-align:center;border-radius:8px}
    .tny-typing{align-self:flex-start;color:#5E707F;font-size:.85rem;font-style:italic}
    .tny-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px;background:#F4F6F8;border-top:1px solid #E8EEF2}
    .tny-quick button{background:#fff;border:1px solid #00B4D8;color:#0077B6;border-radius:999px;padding:6px 12px;font-size:.8rem;cursor:pointer;font-family:inherit}
    .tny-quick button:hover{background:#00B4D8;color:#fff}
    .tny-input{display:flex;gap:8px;padding:12px;border-top:1px solid #D9E0E6;background:#fff}
    .tny-input input{flex:1;border:1px solid #D9E0E6;border-radius:8px;padding:10px 12px;font-family:inherit;font-size:.92rem}
    .tny-input input:focus{outline:2px solid #00B4D8;outline-offset:1px}
    .tny-input button{background:#00B4D8;color:#fff;border:none;border-radius:8px;padding:0 16px;font-family:"Barlow Condensed",Arial,sans-serif;font-weight:600;text-transform:uppercase;cursor:pointer}
    .tny-input button:hover{background:#0077B6}
    .tny-form{padding:14px;background:#fff;border-top:1px solid #D9E0E6;display:none;flex-direction:column;gap:8px}
    .tny-form.open{display:flex}
    .tny-form input,.tny-form textarea{border:1px solid #D9E0E6;border-radius:8px;padding:9px 11px;font-family:inherit;font-size:.9rem;width:100%}
    .tny-form textarea{min-height:64px;resize:vertical}
    .tny-form .tny-row{display:flex;gap:8px}
    .tny-form button{background:#00B4D8;color:#fff;border:none;border-radius:8px;padding:10px;font-family:"Barlow Condensed",Arial,sans-serif;font-weight:600;text-transform:uppercase;cursor:pointer}
    .tny-form button:hover{background:#0077B6}
    .tny-form .tny-cancel{background:#9FB2C0}
    @media (prefers-reduced-motion:reduce){.tny-panel,.tny-chat-btn{transition:none}}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "tny-chat-btn";
  btn.setAttribute("aria-label", "Open support chat");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/></svg> Ask Us';
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "tny-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "TECHNYAH support assistant");
  panel.innerHTML = `
    <div class="tny-head">
      <div><h4>TECHNYAH Assistant</h4><span class="tny-sub">Ask a question or reach a person</span></div>
      <button class="tny-x" aria-label="Close chat">&times;</button>
    </div>
    <div class="tny-body" id="tny-body"></div>
    <div class="tny-quick" id="tny-quick">
      <button data-q="What services do you offer?">Services</button>
      <button data-q="How do I get a quote?">Get a quote</button>
      <button data-q="Tell me about your products">Products</button>
      <button data-q="__human">Talk to a person</button>
    </div>
    <div class="tny-input" id="tny-input">
      <input type="text" id="tny-text" placeholder="Type your message…" aria-label="Your message">
      <button id="tny-send">Send</button>
    </div>
    <form class="tny-form" id="tny-form">
      <div class="tny-msg sys" style="margin:0 0 2px">Connect with a support member. We'll email you and follow up with your ticket number.</div>
      <div class="tny-row">
        <input type="text" id="tny-name" placeholder="Your name" required>
        <input type="email" id="tny-email" placeholder="Your email" required>
      </div>
      <textarea id="tny-detail" placeholder="How can we help?" required></textarea>
      <div class="tny-row">
        <button type="button" class="tny-cancel" id="tny-cancel">Back</button>
        <button type="submit" id="tny-submit">Create ticket</button>
      </div>
    </form>`;
  document.body.appendChild(panel);

  const body = panel.querySelector("#tny-body");
  const quick = panel.querySelector("#tny-quick");
  const inputBar = panel.querySelector("#tny-input");
  const form = panel.querySelector("#tny-form");
  const textInput = panel.querySelector("#tny-text");
  const history = [];
  let greeted = false;

  function add(role, text) {
    const m = document.createElement("div");
    m.className = "tny-msg " + role;
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
    return m;
  }

  function openPanel() {
    panel.classList.add("open");
    btn.style.display = "none";
    if (!greeted) {
      greeted = true;
      add("bot", "Hi! I'm the TECHNYAH assistant. I can answer questions about our services, products, quotes, and careers — or connect you with a support team member. What can I help with?");
    }
    textInput.focus();
  }
  function closePanel() {
    panel.classList.remove("open");
    btn.style.display = "flex";
  }

  btn.addEventListener("click", openPanel);
  panel.querySelector(".tny-x").addEventListener("click", closePanel);

  async function handle(text) {
    if (text === "__human") { showForm(); return; }
    add("user", text);
    history.push({ role: "user", content: text });
    // quick human-intent shortcut
    if (/\b(human|person|agent|representative|someone|call me|speak to|talk to)\b/i.test(text)) {
      add("bot", "Of course — let's connect you with a support member and open a ticket.");
      showForm(); return;
    }
    const typing = document.createElement("div");
    typing.className = "tny-typing"; typing.textContent = "Assistant is typing…";
    body.appendChild(typing); body.scrollTop = body.scrollHeight;
    const reply = await aiAnswer(history);
    typing.remove();
    add("bot", reply);
    history.push({ role: "assistant", content: reply });
  }

  panel.querySelector("#tny-send").addEventListener("click", () => {
    const t = textInput.value.trim();
    if (!t) return;
    textInput.value = "";
    handle(t);
  });
  textInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); panel.querySelector("#tny-send").click(); }
  });
  quick.addEventListener("click", e => {
    const q = e.target.dataset.q;
    if (q) handle(q);
  });

  function showForm() {
    inputBar.style.display = "none";
    quick.style.display = "none";
    form.classList.add("open");
    panel.querySelector("#tny-name").focus();
  }
  function hideForm() {
    form.classList.remove("open");
    inputBar.style.display = "flex";
    quick.style.display = "flex";
  }
  panel.querySelector("#tny-cancel").addEventListener("click", hideForm);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = panel.querySelector("#tny-name").value.trim();
    const email = panel.querySelector("#tny-email").value.trim();
    const detail = panel.querySelector("#tny-detail").value.trim();
    const submit = panel.querySelector("#tny-submit");
    if (!name || !email || !detail) return;
    const ticket = ticketId();
    submit.disabled = true; submit.textContent = "Sending…";

    // Conversation transcript for context
    const transcript = history.map(h => (h.role === "user" ? "Visitor: " : "Assistant: ") + h.content).join("\n");

    const payload = new FormData();
    payload.append("_subject", "Support Ticket " + ticket + " — TECHNYAH");
    payload.append("_cc", "mhadid@technyah.com");
    payload.append("_template", "table");
    payload.append("_captcha", "false");
    payload.append("Ticket", ticket);
    payload.append("name", name);
    payload.append("email", email);
    payload.append("Request", detail);
    payload.append("Chat transcript", transcript || "(none)");
    payload.append("Page", location.href);

    try {
      const res = await fetch("https://formsubmit.co/ajax/info@technyah.com", {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: payload
      });
      if (!res.ok) throw new Error("send");
      hideForm();
      add("sys", "Ticket " + ticket + " created");
      add("bot", "Thanks, " + name + ". Your ticket " + ticket + " is in — a support team member will email you at " + email + " within one business day. Anything else I can help with?");
    } catch (err) {
      submit.disabled = false; submit.textContent = "Create ticket";
      add("sys", "We couldn't send that automatically. Please email info@technyah.com and reference " + ticket + ".");
    }
  });
})();
