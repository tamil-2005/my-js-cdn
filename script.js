document.addEventListener("DOMContentLoaded", () => {


  const BASE_URL = "https://telivy-backend.azurewebsites.net";
  // const BASE_URL = "http://localhost:3000";
  /* ================= CONFIGURATION ================= */
  const CONFIG = {
    API_URL: BASE_URL+"/api/chat",
    RESULT_URL: BASE_URL+"/api/result",
    POLL_INTERVAL: 5000,      // 5 seconds
    POLL_MAX_DURATION: 180000, // 3 minutes
    LOADER_DELAY: 600,
    TOOLTIP_RADIUS: 12
  };

  /* ================= SESSION MANAGEMENT ================= */
  // Each browser tab gets its own chatbot session
  const SESSION_ID = "session_" + crypto.randomUUID();
  console.log("Chat Session ID:", SESSION_ID);


  /* ================= CHAT SYSTEM ================= */
  const chat = {
    thread: document.getElementById("thread"),
    input: document.getElementById("chatInput_inner"),
    sendBtn: document.getElementById("sendBtn"),
    chatBody: document.getElementById("chatBody"),
    chatInput: document.getElementById("chatInput"),
    chatBod: document.querySelector(".chat_bod"),

    addMessage(text, from = "user") {
      const row = document.createElement("div");
      row.className = "msg";

      const avatar = document.createElement("div");

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = text;

      if (from === "user") {
        row.style.justifyContent = "flex-end";
        row.append(bubble, avatar);
      } else {
        row.append(avatar, bubble);
      }

      this.thread.appendChild(row);
      this.thread.scrollTop = this.thread.scrollHeight;
    },

    appendChatMessage(text, sender) {
      const msg = document.createElement("div");
      msg.className = `message ${sender}`;

      const avatar = document.createElement("div");
      avatar.className = "avatar";

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = text;

      if (sender === "user") {
        msg.appendChild(bubble);
        msg.appendChild(avatar);
      } else {
        msg.appendChild(avatar);
        msg.appendChild(bubble);
      }

      this.chatBody.appendChild(msg);
      this.chatBody.scrollTop = this.chatBody.scrollHeight;
    },

    showTypingIndicator() {
      const div = document.createElement("div");
      div.className = "message bot typing";
      div.id = "typing";
      this.chatBody.appendChild(div);
      this.chatBody.scrollTop = this.chatBody.scrollHeight;
    },

    hideTypingIndicator() {
      const typing = document.getElementById("typing");
      if (typing) typing.remove();
    },

    // ✅ FIX: sendToAPI now uses the shared SESSION_ID correctly
    async sendToAPI(text) {
      try {
        const res = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: SESSION_ID,
            message: text
          })
        });

        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }

        const data = await res.json();
        this.addMessage(data.reply || "No response", "bot");

      } catch (error) {
        console.error("Send API Error:", error);
        this.addMessage("⚠ Server not reachable.", "bot");
      }
    },

    sendMessage() {
      const text = this.input.value.trim();
      if (!text) return;
      this.addMessage(text, "user");
      this.input.value = "";
      this.sendToAPI(text);
    }
  };

  const SendBtn = document.getElementById("handleSendMessage");
  SendBtn.addEventListener("click", () => {
    handleSendMessages();
  });

  // Handle initial center input
  const SendBtnInitial = document.getElementById("handleSendMessageInitial");
  const chatInputInitial = document.getElementById("chatInputInitial");

  if (SendBtnInitial) {
    SendBtnInitial.addEventListener("click", () => {
      const message = chatInputInitial.value.trim();
      if (message) {
        chat.chatInput.value = message;
        chatInputInitial.value = "";
        handleSendMessages();
      }
    });
  }

  if (chatInputInitial) {
    chatInputInitial.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const message = chatInputInitial.value.trim();
        if (message) {
          chat.chatInput.value = message;
          chatInputInitial.value = "";
          handleSendMessages();
        }
      }
    });
  }

  /* ================= API UTILITIES ================= */
  const api = {
    async getDataFromApi(baseUrl, sessionId) {
      try {
        if (!sessionId) {
          throw new Error("Session ID is required");
        }

        const finalUrl = `${baseUrl}/${sessionId}`;
        const response = await fetch(finalUrl);

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();

        return {
          success: true,
          status: response.status,
          data
        };
      } catch (err) {
        console.error("❌ GET failed:", err.message);
        return {
          success: false,
          error: err.message
        };
      }
    },

    async pollForResult(sessionId) {
      const startTime = Date.now();

      while (Date.now() - startTime < CONFIG.POLL_MAX_DURATION) {
        try {
          const apiResult = await this.getDataFromApi(CONFIG.RESULT_URL, sessionId);

          if (!apiResult.success) {
            console.warn("API request failed:", apiResult.error);
          } else if (apiResult.data && apiResult.data.result !== null && apiResult.data.result !== undefined) {
            return apiResult.data;
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL));
      }

      return null;
    }
  };

  /* ================= RADAR SYSTEM ================= */
  const radar = {
    canvas: document.getElementById("radar"),
    ctx: null,
    tooltip: document.getElementById("tooltip"),

    labels: [
      "Social Engineering",
      "Network Security",
      "Application Security",
      "DNS Health",
      "IP Reputation",
      "Internal Vulnerabilities"
    ],

    scanTypeMap: {
      socialEngineering: "Social Engineering",
      networkSecurity: "Network Security",
      applicationSecurity: "Application Security",
      dnsHealth: "DNS Health",
      ipReputation: "IP Reputation",
      externalVulnerabilities: "Internal Vulnerabilities"
    },

    cfg: null,
    data: [],
    radarPoints: [],
    randomTimer: null,
    easingFrame: null,

    init() {
      this.ctx = this.canvas.getContext("2d");

      this.cfg = {
        cx: this.canvas.width / 2,
        cy: this.canvas.height / 2,
        radius: 140,
        rings: 5,
        grid: "rgba(255,255,255,.12)",
        axis: "rgba(255,255,255,.18)",
        fill: "rgba(34,230,200,.18)",
        stroke: "#22e6c8",
        point: "#49ffd7",
        label: "#9fb0cc",
        font: "12px system-ui"
      };

      this.setupHoverTooltip();
    },

    polar(angle, radius) {
      return [
        this.cfg.cx + radius * Math.cos(angle),
        this.cfg.cy + radius * Math.sin(angle)
      ];
    },

    scoreFromGrade(grade) {
      const gradeMap = {
        "A": 90,
        "B": 75,
        "C": 60,
        "D": 40
      };
      return gradeMap[grade] || 100;
    },

    startRandomLoading() {
      this.data = this.labels.map(label => ({
        label,
        score: Math.random() * 100,
        target: null,
        total: 0,
        grade: "N/A"
      }));

      this.drawRadar();

      this.randomTimer = setInterval(() => {
        this.data.forEach(d => {
          d.score += Math.random() * 10 - 5;
          d.score = Math.max(20, Math.min(100, d.score));
        });
        this.drawRadar();
      }, 800);
    },

    applyAPIResult(apiData) {
      clearInterval(this.randomTimer);

      if (!apiData || !apiData.result || !Array.isArray(apiData.result)) {
        console.error("Invalid API response", apiData);
        return;
      }

      const map = {};

      apiData.result.forEach(item => {
        const label = this.scanTypeMap[item.scanType];
        if (!label) return;

        map[label] = {
          score: this.scoreFromGrade(item.grade),
          total: item.totalCount ?? 0,
          grade: item.grade ?? "N/A"
        };
      });

      this.data.forEach(d => {
        if (map[d.label]) {
          d.target = map[d.label].score;
          d.total = map[d.label].total;
          d.grade = map[d.label].grade;
        } else {
          d.target = 100;
          d.total = 0;
          d.grade = "N/A";
        }
      });

      this.easeToTarget();
    },

    easeToTarget() {
      cancelAnimationFrame(this.easingFrame);
      const ease = 0.08;

      const animate = () => {
        let done = true;
        this.data.forEach(d => {
          const diff = d.target - d.score;
          if (Math.abs(diff) > 0.2) {
            d.score += diff * ease;
            done = false;
          } else {
            d.score = d.target;
          }
        });

        this.drawRadar();
        if (!done) this.easingFrame = requestAnimationFrame(animate);
      };
      animate();
    },

    drawRadar() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.radarPoints = [];

      const step = (Math.PI * 2) / this.labels.length;
      const start = -Math.PI / 2;

      // Draw grid rings
      for (let k = 1; k <= this.cfg.rings; k++) {
        this.ctx.beginPath();
        const r = this.cfg.radius * (k / this.cfg.rings);
        this.labels.forEach((_, i) => {
          const [x, y] = this.polar(start + i * step, r);
          i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y);
        });
        this.ctx.closePath();
        this.ctx.strokeStyle = this.cfg.grid;
        this.ctx.stroke();
      }

      // Draw axes and labels
      this.ctx.font = this.cfg.font;
      this.labels.forEach((label, i) => {
        const angle = start + i * step;
        const [x, y] = this.polar(angle, this.cfg.radius);

        this.ctx.beginPath();
        this.ctx.moveTo(this.cfg.cx, this.cfg.cy);
        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = this.cfg.axis;
        this.ctx.stroke();

        const [lx, ly] = this.polar(angle, this.cfg.radius + 18);
        this.ctx.fillStyle = this.cfg.label;
        this.ctx.textAlign = Math.cos(angle) > 0.3 ? "left" :
          Math.cos(angle) < -0.3 ? "right" : "center";
        this.ctx.textBaseline = Math.sin(angle) > 0.3 ? "top" :
          Math.sin(angle) < -0.3 ? "bottom" : "middle";
        this.ctx.fillText(label, lx, ly);
      });

      // Draw data polygon
      this.ctx.beginPath();
      this.data.forEach((d, i) => {
        const angle = start + i * step;
        const r = this.cfg.radius * (d.score / 100);
        const [x, y] = this.polar(angle, r);

        this.radarPoints.push({
          x,
          y,
          label: d.label,
          grade: d.grade,
          total: d.total
        });

        i ? this.ctx.lineTo(x, y) : this.ctx.moveTo(x, y);
      });
      this.ctx.closePath();
      this.ctx.fillStyle = this.cfg.fill;
      this.ctx.strokeStyle = this.cfg.stroke;
      this.ctx.fill();
      this.ctx.stroke();

      // Draw points
      this.radarPoints.forEach(p => {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = this.cfg.point;
        this.ctx.fill();
      });
    },

    setupHoverTooltip() {
      this.canvas.addEventListener("mousemove", (e) => {
        if (!this.radarPoints.length) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let found = null;
        const hitRadius = CONFIG.TOOLTIP_RADIUS * CONFIG.TOOLTIP_RADIUS;

        for (const p of this.radarPoints) {
          const dx = x - p.x;
          const dy = y - p.y;

          if (dx * dx + dy * dy <= hitRadius) {
            found = p;
            break;
          }
        }

        this.tooltip.style.display = found ? "block" : "none";
        if (found) {
          this.tooltip.style.left = e.clientX + 12 + "px";
          this.tooltip.style.top = e.clientY + 12 + "px";
          this.tooltip.innerHTML = `
            <b>${found.label}</b><br>
            Grade: <b>${found.grade}</b><br>
          `;
        }
      });
    }
  };

  /* ================= FINDINGS DISPLAY ================= */
  const findings = {
    descriptions: {
      socialEngineering: "",
      networkSecurity: "",
      applicationSecurity: "",
      dnsHealth: "",
      ipReputation: "",
      externalVulnerabilities: ""
    },

    displayOrder: [
      "socialEngineering",
      "networkSecurity",
      "applicationSecurity",
      "dnsHealth",
      "ipReputation",
      "externalVulnerabilities"
    ],

    render(apiResult) {
      if (!apiResult || !apiResult.result || !Array.isArray(apiResult.result)) {
        console.error("Invalid findings data:", apiResult);
        return;
      }

      const scanMap = {};
      apiResult.result.forEach(item => {
        scanMap[item.scanType] = item;
      });

      const rows = document.getElementById("findingsRows");
      if (!rows) {
        console.error("findingsRows element not found");
        return;
      }

      rows.innerHTML = "";

      const totalSeverities = { high: 0, medium: 0, low: 0, info: 0 };

      for (let i = 0; i < this.displayOrder.length; i += 2) {
        const row = document.createElement("div");
        row.className = "finding-row";

        [this.displayOrder[i], this.displayOrder[i + 1]].forEach(key => {
          if (!key || !scanMap[key]) return;

          const scan = scanMap[key];
          const grade = scan.grade || "N/A";

          const severities = scan.severities || {
            high: 0,
            medium: 0,
            low: 0,
            info: 0
          };

          totalSeverities.high   += Number(severities.high   ?? 0);
          totalSeverities.medium += Number(severities.medium ?? 0);
          totalSeverities.low    += Number(severities.low    ?? 0);
          totalSeverities.info   += Number(severities.info   ?? 0);

          const high   = Number(severities.high   ?? 0);
          const medium = Number(severities.medium ?? 0);
          const low    = Number(severities.low    ?? 0);
          const info   = Number(severities.info   ?? 0);

          let severityType = "safe";
          let severityCount = 0;

          if (high > 0) {
            severityType = "high";
            severityCount = high;
          } else if (medium > 0) {
            severityType = "medium";
            severityCount = medium;
          } else if (low > 0) {
            severityType = "low";
            severityCount = low;
          } else if (info > 0) {
            severityType = "safe";
            severityCount = info;
          }

          const findingDiv = document.createElement("div");
          findingDiv.className = `finding severity-${severityType}`;

          const issueText = severityCount === 1 ? "issue" : "issues";

          findingDiv.innerHTML = `
            <div class="grade-span-box">
              <div class="grade">${grade}</div>
              <span class="grade-span-${severityType}">${severityType.toUpperCase()}</span>
            </div>
            <div class="findings_box">
              <div class="finding-title">${key}</div>
              <div class="finding-desc">${this.descriptions[key] ?? ""}</div>
            </div>
            <div class="finding-count">
              ${
                severityCount > 0
                  ? `<span class="count-${severityType}">${severityCount} ${issueText}</span>`
                  : `<span class="no-issue">0 issues</span>`
              }
            </div>
          `;

          row.appendChild(findingDiv);
        });

        rows.appendChild(row);
      }

      updateRiskBar(totalSeverities);

      const findingsContainer = document.getElementById("findings_out");
      if (findingsContainer) {
        findingsContainer.classList.add("show");
      }
    }
  };

  /* ================= RISK BAR ================= */
  function updateRiskBar(severities) {
    const high   = Number(severities?.high   ?? 0);
    const medium = Number(severities?.medium ?? 0);
    const low    = Number(severities?.low    ?? 0);

    const total = high + medium + low;

    const highPercent   = total ? (high   / total) * 100 : 0;
    const mediumPercent = total ? (medium / total) * 100 : 0;
    const lowPercent    = total ? (low    / total) * 100 : 0;

    const highEl   = document.querySelector(".risk-high");
    const mediumEl = document.querySelector(".risk-medium");
    const lowEl    = document.querySelector(".risk-low");

    if (highEl)   highEl.style.width   = highPercent   + "%";
    if (mediumEl) mediumEl.style.width = mediumPercent + "%";
    if (lowEl)    lowEl.style.width    = lowPercent    + "%";
  }

  /* ================= UTILITIES ================= */
  function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const year = date.getFullYear();

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = months[date.getMonth()];

    function getDaySuffix(d) {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    }

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${day}${getDaySuffix(day)} ${month} ${year} ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  }

  /* ================= POLLING HELPERS ================= */
  const REQUIRED_SCAN_TYPES = [
    "socialEngineering",
    "externalVulnerabilities",
    "networkSecurity",
    "applicationSecurity",
    "dnsHealth",
    "ipReputation"
  ];

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isResultComplete(result) {
    if (!Array.isArray(result)) return false;
    return REQUIRED_SCAN_TYPES.every(type => {
      const scan = result.find(r => r.scanType === type);
      if (!scan) return false;
      return scan.grade !== null;
    });
  }

  async function pollUntilAllDataReady(sessionId, delay = 4000, maxRetries = 100) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`⏳ Polling attempt ${attempt}/${maxRetries}...`);

      const apiData = await api.pollForResult(sessionId);

      if (!apiData) {
        console.log("⚠️ No data returned, continuing to poll...");
        await sleep(delay);
        continue;
      }

      if (isResultComplete(apiData.result)) {
        console.log("✅ All scan data received and complete!");
        return apiData;
      }

      console.log(`📊 Data incomplete. Found ${apiData.result?.length || 0} scan types.`);
      await sleep(delay);
    }

    throw new Error("❌ Scan data not fully ready after max retries");
  }

  /* ================= MAIN MESSAGE HANDLER ================= */
  async function handleSendMessages() {
    const message = chat.chatInput.value.trim();
    if (!message) return;

    chat.chatBod.classList.add("chat-started");
    chat.appendChatMessage(message, "user");
    chat.chatInput.value = "";
    chat.showTypingIndicator();


    try {
      // ✅ FIX: Single fetch using shared SESSION_ID — no duplicate requests,
      // backend correctly maps session_id → chatbot instance per tab
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: SESSION_ID,
          message: message
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const emailData = await res.json();
      console.log("📧 Email Data:", emailData);

      chat.hideTypingIndicator();

      let sessionId = null;

      if (emailData.webhook?.session_id) {
        sessionId = emailData.webhook.session_id;
      } else if (Array.isArray(emailData.results)) {
        const firstValid = emailData.results.find(r => r.session_id);
        if (firstValid) sessionId = firstValid.session_id;
      }

      if (sessionId) {
        const chatBody   = document.querySelector(".chat_bod");
        const resultBody = document.querySelector(".result_body");

        if (emailData.email) {
          const rawName = emailData.email.split("@")[0];
          const userNameEl = document.getElementById("userName");

          if (userNameEl) {
            const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            userNameEl.innerHTML = `
              <img
                src="https://cdn.prod.website-files.com/66636f54c09293dc190a7ebe/67ef853662a31513d9233d02_Favicon.svg"
                alt="INFINITESOL Logo"
                style="height:18px; vertical-align:middle; margin-left:6px; margin-right:6px;"
              />
              Hi ${displayName}, Welcome to INFINITESOL !
            `;
          }
        }

        setTimeout(() => {
          if (chatBody) {
            chatBody.classList.add("fade-out");
            chatBody.style.display = "none";
          }
          if (resultBody) {
            resultBody.style.display = "block";
            resultBody.classList.add("show");
            initChatAnimation();
          }
        }, 300);

        try {
          const apiResult = await pollUntilAllDataReady(sessionId);
          console.log("✅ Complete API Result:", apiResult);

          radar.applyAPIResult(apiResult);
          findings.render(apiResult);

          if (apiResult.created_at) {
            const createDate = formatDate(apiResult.created_at);
            const scanInfo = document.getElementById("scanInfo");
            if (scanInfo) {
              scanInfo.textContent = "Last scanned on " + createDate;
            }
          }
        } catch (error) {
          console.error("❌ Polling error:", error);
          chat.appendChatMessage("Unable to retrieve complete scan results. Please try again.", "bot");
        }
      }

      const reply = emailData.reply || emailData.message || "No response";
      chat.appendChatMessage(reply, "bot");

    } catch (err) {
      chat.hideTypingIndicator();
      chat.appendChatMessage("❌ Server error. Try again.", "bot");
      console.error("Handle message error:", err);
    }
  }

  /* ================= EVENT LISTENERS ================= */
  if (chat.sendBtn) {
    chat.sendBtn.addEventListener("click", () => chat.sendMessage());
  }
  if (chat.input) {
    chat.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        chat.sendMessage();
      }
    });
  }
  if (chat.chatInput) {
    chat.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSendMessages();
      }
    });
  }

  /* ================= ANIMATED PLACEHOLDER ================= */
  const animatePlaceholder = () => {
    const placeholders = [
      "F","Fr","Fre","Free","Free ","Free t","Free th","Free thr","Free thre",
      "Free threa","Free threat","Free threat ","Free threat s","Free threat sc",
      "Free threat sca","Free threat scan","Free threat scan ","Free threat scan r",
      "Free threat scan re","Free threat scan rep","Free threat scan repo",
      "Free threat scan repor","Free threat scan report","Free threat scan report ",
      "Free threat scan report b","Free threat scan report by","Free threat scan report by ",
      "Free threat scan report by e","Free threat scan report by em",
      "Free threat scan report by ema","Free threat scan report by emai",
      "Free threat scan report by email","Free threat scan report by emai",
      "Free threat scan report by ema","Free threat scan report by em",
      "Free threat scan report by e","Free threat scan report by ",
      "Free threat scan report b","Free threat scan report ",
      "Free threat scan report","Free threat scan repor","Free threat scan repo",
      "Free threat scan rep","Free threat scan re","Free threat scan r",
      "Free threat scan ","Free threat scan","Free threat sca","Free threat sc",
      "Free threat s","Free threat ","Free threat","Free threa","Free thre",
      "Free thr","Free th","Free t","Free ","Free","Fre","Fr","F",""
    ];

    let index = 0;
    const initialInput = document.getElementById("chatInputInitial");
    const bottomInput  = document.getElementById("chatInput");

    if (initialInput || bottomInput) {
      setInterval(() => {
        const text = placeholders[index];
        if (initialInput && !chat.chatBod.classList.contains("chat-started")) {
          initialInput.placeholder = text;
        }
        if (bottomInput && chat.chatBod.classList.contains("chat-started")) {
          bottomInput.placeholder = text;
        }
        index = (index + 1) % placeholders.length;
      }, 200);
    }
  };

  animatePlaceholder();

  radar.init();
  radar.startRandomLoading();

  setTimeout(() => {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "none";
    if (radar.canvas) radar.canvas.style.display = "block";
  }, CONFIG.LOADER_DELAY);

  window.addEventListener("load", () => {
    const payload = { cryptoUID: crypto.randomUUID() };
    navigator.sendBeacon("https://telivy-backend.azurewebsites.net//api/refresh", JSON.stringify(payload));
  });

});

/* ================= CHAT ANIMATION (result view) ================= */
function initChatAnimation() {
  const CONFIG = {
    initialDelay: 290,
    headerDelay: 300,
    wordDelay: 230,
    scanItemDelay: 300
  };

  const chat = document.getElementById("chat");
  const headerText = "Thank you for providing your email address. Your domain dark web report is currently being generated. The results will be based on the following categories.";
  const scanItems = [
    "Social Engineering",
    "Network Security",
    "Application Security",
    "DNS Health",
    "IP Reputation",
    "Internal Vulnerabilities"
  ];

  function createChatBubble() {
    const bubble   = document.createElement("div");
    bubble.className = "chat-bubble";

    const header   = document.createElement("div");
    header.className = "bubble-text";

    const scanList = document.createElement("div");
    scanList.className = "scan-list";

    bubble.appendChild(header);
    bubble.appendChild(scanList);

    return { bubble, header, scanList };
  }

  function animateText(element, text, wordDelay) {
    return new Promise((resolve) => {
      const words = text.split(" ");
      let currentIndex = 0;

      const interval = setInterval(() => {
        element.textContent += (currentIndex === 0 ? "" : " ") + words[currentIndex];
        currentIndex++;
        if (currentIndex === words.length) {
          clearInterval(interval);
          resolve();
        }
      }, wordDelay);
    });
  }

  function animateScanItems(list, items, itemDelay) {
    return new Promise((resolve) => {
      items.forEach((itemText, index) => {
        setTimeout(() => {
          const item = document.createElement("div");
          item.className = "scan-item";
          item.textContent = itemText;
          list.appendChild(item);

          if (index === items.length - 1) {
            setTimeout(resolve, 400);
          }
        }, index * itemDelay);
      });
    });
  }

  function showFinalMessage() {
    const finalBubble = document.createElement("div");
    finalBubble.className = "final-message";
    finalBubble.textContent = "Now you can chat with us";
    chat.appendChild(finalBubble);
  }

  function disableInput() {
    const inputBar   = document.querySelector(".input-bar input");
    const sendButton = document.querySelector(".send");

    if (inputBar) {
      inputBar.disabled = true;
      inputBar.placeholder = "Loading...";
      inputBar.style.opacity = "0.5";
      inputBar.style.cursor  = "not-allowed";
    }
    if (sendButton) {
      sendButton.disabled = true;
      sendButton.style.opacity = "0.5";
      sendButton.style.cursor  = "not-allowed";
    }
  }

  function enableInput() {
    const inputBar   = document.querySelector(".input-bar input");
    const sendButton = document.querySelector(".send");

    if (inputBar) {
      inputBar.disabled = false;
      inputBar.placeholder = "chat with me...";
      inputBar.style.opacity = "1";
      inputBar.style.cursor  = "text";
    }
    if (sendButton) {
      sendButton.disabled = false;
      sendButton.style.opacity = "1";
      sendButton.style.cursor  = "pointer";
    }
  }

  async function initChat() {
    disableInput();

    await new Promise(resolve => setTimeout(resolve, CONFIG.initialDelay));

    const { bubble, header, scanList } = createChatBubble();
    chat.appendChild(bubble);

    await new Promise(resolve => setTimeout(resolve, CONFIG.headerDelay));
    await animateText(header, headerText, CONFIG.wordDelay);
    await animateScanItems(scanList, scanItems, CONFIG.scanItemDelay);

    showFinalMessage();

    await new Promise(resolve => setTimeout(resolve, 800));
    enableInput();
  }

  initChat();
}

