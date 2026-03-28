// ai.js
document.addEventListener("DOMContentLoaded", () => {
  const onboardingModal = document.getElementById("onboarding-modal");
  const userNameInput = document.getElementById("user-name");
  const langButtons = document.querySelectorAll(".lang-btn");
  const startBtn = document.getElementById("start-btn");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");
  const clearChatBtn = document.getElementById("clear-chat");

  let userConfig = JSON.parse(localStorage.getItem("ghosty_ai_config")) || null;
  let chatHistory = JSON.parse(localStorage.getItem("ghosty_chat_history")) || [];

  // Initialize
  if (!userConfig) {
    onboardingModal.style.display = "flex";
  } else {
    onboardingModal.style.display = "none";
    loadChatHistory();
    sendGreeting();
  }

  // Language Selection
  langButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      langButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Start Button
  startBtn.addEventListener("click", () => {
    const name = userNameInput.value.trim();
    const lang = document.querySelector(".lang-btn.active").dataset.lang;

    if (!name) {
      alert("Please enter your name!");
      return;
    }

    userConfig = { name, lang };
    localStorage.setItem("ghosty_ai_config", JSON.stringify(userConfig));
    onboardingModal.style.display = "none";
    sendGreeting();
  });

  // Handle Form Submission
  chatForm.addEventListener("submit", async e => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage("user", message);
    chatInput.value = "";
    
    // API Call
    await getAIResponse(message);
  });

  // Clear Chat
  clearChatBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      chatHistory = [];
      localStorage.removeItem("ghosty_chat_history");
      chatMessages.innerHTML = "";
      sendGreeting();
    }
  });

  function addMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (role !== "system") {
      chatHistory.push({ role, content: text });
      localStorage.setItem("ghosty_chat_history", JSON.stringify(chatHistory));
    }
  }

  function loadChatHistory() {
    chatHistory.forEach(msg => {
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${msg.role}`;
      msgDiv.textContent = msg.content;
      chatMessages.appendChild(msgDiv);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function sendGreeting() {
    if (chatMessages.children.length > 0) return;
    
    const greeting = userConfig.lang === "es" 
      ? `¡Hola ${userConfig.name}! Soy Ghosty AI. ¿En qué puedo ayudarte hoy?`
      : `Hello ${userConfig.name}! I'm Ghosty AI. How can I help you today?`;
    
    addMessage("ai", greeting);
  }

  async function getAIResponse(userMessage) {
    // Add typing indicator
    const typingDiv = document.createElement("div");
    typingDiv.className = "message ai typing";
    typingDiv.textContent = userConfig.lang === "es" ? "Ghosty está pensando..." : "Ghosty is thinking...";
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      // Prepare context (last 10 messages)
      const context = chatHistory.slice(-10).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content
      }));

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: `You are Ghosty AI, a helpful and cool assistant for the Ghosty proxy platform. The user's name is ${userConfig.name}. Always respond in ${userConfig.lang === "es" ? "Spanish" : "English"}.` },
            ...context
          ]
        })
      });

      const data = await response.json();
      chatMessages.removeChild(typingDiv);

      if (data.choices && data.choices[0]) {
        const aiText = data.choices[0].message.content;
        addMessage("ai", aiText);
      } else {
        addMessage("ai", "Sorry, I'm having trouble connecting to my brain right now. 👻");
      }
    } catch (error) {
      chatMessages.removeChild(typingDiv);
      addMessage("ai", "Error: Failed to fetch response. Check server logs.");
      console.error(error);
    }
  }
});
