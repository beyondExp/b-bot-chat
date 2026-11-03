(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var agentId = String(script.dataset.agent || "").trim();
  if (!agentId) {
    console.error("[Beyond-Bot] Missing data-agent on embed script.");
    return;
  }

  var baseUrl;
  try {
    baseUrl = new URL(script.src).origin;
  } catch (_) {
    baseUrl = "https://swiss-chat.ch";
  }

  var instanceId =
    String(script.dataset.embedId || "").trim() ||
    "bbot-" + Math.random().toString(36).slice(2, 10);
  var style = script.dataset.style === "inline" || script.dataset.style === "blank"
    ? "inline"
    : "bubble";
  var color = String(script.dataset.color || "#2563eb").trim();
  var height = String(script.dataset.height || "600").replace(/[^\d]/g, "") || "600";
  var headerIcon = String(script.dataset.headerIcon || "").trim();
  var bubbleIcon = String(script.dataset.bubbleIcon || "").trim();
  var dark = script.dataset.dark === "true" || script.dataset.dark === "1";
  var discoveryEnabled = script.dataset.agentDiscovery !== "false";

  function embedUrl() {
    var url = new URL("/embed", baseUrl);
    url.searchParams.set("agent", agentId);
    url.searchParams.set("embedId", instanceId);
    url.searchParams.set("color", color);
    if (style === "bubble") url.searchParams.set("bubble", "true");
    if (dark) url.searchParams.set("dark", "true");
    if (headerIcon) url.searchParams.set("headerIcon", headerIcon);
    if (bubbleIcon) url.searchParams.set("bubbleIcon", bubbleIcon);
    return url.toString();
  }

  function createFrame() {
    var frame = document.createElement("iframe");
    frame.src = embedUrl();
    frame.title = script.dataset.title || "Beyond-Bot Chat";
    frame.setAttribute("allow", "clipboard-write");
    frame.setAttribute("loading", "lazy");
    frame.style.border = "0";
    frame.style.background = "transparent";
    return frame;
  }

  function renderInline() {
    var frame = createFrame();
    frame.id = instanceId;
    frame.style.width = String(script.dataset.width || "100%");
    frame.style.height = height + "px";
    frame.style.display = "block";
    script.insertAdjacentElement("afterend", frame);
  }

  function renderBubble() {
    var panel = document.createElement("div");
    panel.id = instanceId;
    panel.style.cssText =
      "position:fixed;right:24px;bottom:24px;width:min(420px,calc(100vw - 32px));" +
      "height:min(720px,calc(100vh - 48px));z-index:2147483646;display:none;" +
      "flex-direction:column;overflow:hidden;border-radius:16px;background:" +
      (dark ? "#09090b" : "#fff") + ";box-shadow:0 16px 48px rgba(0,0,0,.24)";

    var topBar = document.createElement("div");
    topBar.style.cssText =
      "display:flex;align-items:center;justify-content:flex-end;padding:6px 10px;" +
      "border-bottom:1px solid " + (dark ? "#27272a" : "#e5e7eb") + ";background:" +
      (dark ? "#09090b" : "#fff") + ";flex-shrink:0";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    closeBtn.style.cssText =
      "width:28px;height:28px;border:0;border-radius:9999px;display:flex;" +
      "align-items:center;justify-content:center;cursor:pointer;background:transparent;" +
      "color:" + (dark ? "#a1a1aa" : "#6b7280");
    closeBtn.innerHTML =
      '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">' +
      '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    topBar.appendChild(closeBtn);
    panel.appendChild(topBar);

    var frame = createFrame();
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.flex = "1";
    frame.style.minHeight = "0";
    panel.appendChild(frame);

    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", script.dataset.label || "Open chat");
    button.setAttribute("aria-expanded", "false");
    button.style.cssText =
      "position:fixed;right:24px;bottom:24px;width:64px;height:64px;border:0;" +
      "border-radius:50%;z-index:2147483647;display:flex;align-items:center;" +
      "justify-content:center;cursor:pointer;background:" + color +
      ";color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.24)";

    if (bubbleIcon) {
      var image = document.createElement("img");
      image.src = bubbleIcon;
      image.alt = "";
      image.style.cssText = "width:36px;height:36px;border-radius:50%;object-fit:cover";
      button.appendChild(image);
    } else {
      button.innerHTML =
        '<svg width="32" height="32" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M2 21l1.65-4.77C2.6 14.54 2 13.32 2 12c0-4.42 4.48-8 10-8s10 3.58 10 8-4.48 8-10 8c-1.13 0-2.22-.13-3.24-.36L2 21z"/></svg>';
    }

    function openBubble() {
      panel.style.display = "flex";
      button.style.display = "none";
      button.setAttribute("aria-expanded", "true");
    }

    function closeBubble() {
      panel.style.display = "none";
      button.style.display = "flex";
      button.setAttribute("aria-expanded", "false");
    }

    button.addEventListener("click", openBubble);
    closeBtn.addEventListener("click", closeBubble);

    window.addEventListener("message", function (event) {
      if (!event || !event.data || typeof event.data !== "object") return;
      if (event.data.embedId && event.data.embedId !== instanceId) return;
      if (event.data.type === "bbot-embed-ready" && event.data.hasHeaderClose) {
        topBar.style.display = "none";
      } else if (event.data.type === "bbot-embed-close") {
        closeBubble();
      }
    });

    document.body.appendChild(panel);
    document.body.appendChild(button);
  }

  function sessionToken() {
    var key = "bbot.agent-query.session.v1." + agentId;
    try {
      var existing = sessionStorage.getItem(key);
      if (existing && existing.length >= 32) return existing;
      var bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      var token = Array.from(bytes, function (value) {
        return value.toString(16).padStart(2, "0");
      }).join("");
      sessionStorage.setItem(key, token);
      return token;
    } catch (_) {
      return instanceId + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    }
  }

  function publishDiscoveryMetadata() {
    if (!discoveryEnabled || !document.head) return;
    var cardUrl =
      baseUrl + "/api/a2a/agents/" + encodeURIComponent(agentId) + "/agent-card.json";
    var existingCards = document.head.querySelectorAll("link[data-bbot-agent-card]");
    var hasCard = Array.prototype.some.call(existingCards, function (candidate) {
      return candidate.getAttribute("data-bbot-agent-card") === agentId;
    });
    if (!hasCard) {
      var link = document.createElement("link");
      link.rel = "alternate";
      link.type = "application/a2a+json";
      link.href = cardUrl;
      link.dataset.bbotAgentCard = agentId;
      document.head.appendChild(link);
    }

    if (!document.head.querySelector('meta[name="ai-agent-endpoint"]')) {
      var endpoint = document.createElement("meta");
      endpoint.name = "ai-agent-endpoint";
      endpoint.content = baseUrl + "/api/a2a/agents/" + encodeURIComponent(agentId);
      document.head.appendChild(endpoint);

      var protocol = document.createElement("meta");
      protocol.name = "ai-agent-protocol";
      protocol.content = "A2A/1.0";
      document.head.appendChild(protocol);

      var card = document.createElement("meta");
      card.name = "ai-agent-card";
      card.content = cardUrl;
      document.head.appendChild(card);
    }
  }

  function registerSiteTool() {
    if (!discoveryEnabled || typeof document.modelContext?.registerTool !== "function") return;

    var requestedName = String(script.dataset.toolName || "ask_website_expert");
    var toolName = requestedName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

    var registration = document.modelContext.registerTool({
      name: toolName,
      description:
        script.dataset.toolDescription ||
        "Ask this website's official Beyond-Bot expert for public, source-grounded information.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to answer using the website expert's approved knowledge.",
          },
          language: {
            type: "string",
            description: "Preferred BCP 47 response language, for example de-CH or en.",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        var response = await fetch(baseUrl + "/api/agent-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: agentId,
            question: input.question,
            language: input.language || document.documentElement.lang || navigator.language,
            pageUrl: location.href,
            pageTitle: document.title,
            sessionToken: sessionToken(),
          }),
        });
        var result = await response.json().catch(function () {
          return { error: "invalid_response" };
        });
        if (!response.ok) {
          throw new Error(result.message || result.error || "Beyond-Bot query failed");
        }
        return result;
      },
    });
    if (registration && typeof registration.catch === "function") {
      registration.catch(function (error) {
        console.warn("[Beyond-Bot] Site tool registration failed.", error);
      });
    }
  }

  if (style === "inline") renderInline();
  else if (document.body) renderBubble();
  else document.addEventListener("DOMContentLoaded", renderBubble, { once: true });

  publishDiscoveryMetadata();
  registerSiteTool();
})();
