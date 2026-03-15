const sectionLinks = document.querySelectorAll("[data-section-link]");
const sections = document.querySelectorAll(".content-section");
const toolsButton = document.querySelector(".nav-button");
const navDropdown = document.querySelector(".nav-dropdown");

const fileInput = document.getElementById("cvFile");
const keywordsInput = document.getElementById("keywords");
const analyzeButton = document.getElementById("analyzeButton");
const statusMessage = document.getElementById("statusMessage");
const resultsSection = document.getElementById("results");

const matchRate = document.getElementById("matchRate");
const foundCount = document.getElementById("foundCount");
const keywordCount = document.getElementById("keywordCount");
const mentionCount = document.getElementById("mentionCount");
const foundSummary = document.getElementById("foundSummary");
const missingSummary = document.getElementById("missingSummary");
const foundKeywords = document.getElementById("foundKeywords");
const missingKeywords = document.getElementById("missingKeywords");
const documentFacts = document.getElementById("documentFacts");

const jobProposalInput = document.getElementById("jobProposal");
const analyzeJobButton = document.getElementById("analyzeJobButton");
const jobStatusMessage = document.getElementById("jobStatusMessage");
const jobResults = document.getElementById("jobResults");
const jobSummary = document.getElementById("jobSummary");
const jobKeywords = document.getElementById("jobKeywords");

const themeSwitch = document.getElementById("themeSwitch");
const THEME_STORAGE_KEY = "ats-theme";
const MAX_JOB_KEYWORDS = 15;

initializeTheme();
initializeNavigation();
initializeToolsMenuAccessibility();

if (themeSwitch) {
  themeSwitch.addEventListener("change", () => {
    const isDarkMode = themeSwitch.checked;
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
  });
}

function initializeTheme() {
  if (!themeSwitch) {
    return;
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDarkMode = savedTheme ? savedTheme === "dark" : prefersDarkMode;

  themeSwitch.checked = shouldUseDarkMode;
  document.body.classList.toggle("dark-mode", shouldUseDarkMode);
}

function initializeNavigation() {
  const initialSection = window.location.hash.replace("#", "") || "home";
  showSection(initialSection);

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.dataset.sectionLink;
      showSection(target);
      window.history.replaceState(null, "", `#${target}`);
    });
  });
}

function showSection(sectionId) {
  let sectionExists = false;

  sections.forEach((section) => {
    const isActive = section.id === sectionId;
    section.classList.toggle("active", isActive);
    if (isActive) {
      sectionExists = true;
    }
  });

  const fallbackSection = sectionExists ? sectionId : "home";

  if (!sectionExists) {
    sections.forEach((section) => {
      section.classList.toggle("active", section.id === fallbackSection);
    });
  }

  sectionLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.sectionLink === fallbackSection);
  });
}

function initializeToolsMenuAccessibility() {
  if (!toolsButton || !navDropdown) {
    return;
  }

  navDropdown.addEventListener("mouseenter", () => {
    toolsButton.setAttribute("aria-expanded", "true");
  });

  navDropdown.addEventListener("mouseleave", () => {
    toolsButton.setAttribute("aria-expanded", "false");
  });

  navDropdown.addEventListener("focusin", () => {
    toolsButton.setAttribute("aria-expanded", "true");
  });

  navDropdown.addEventListener("focusout", (event) => {
    if (!navDropdown.contains(event.relatedTarget)) {
      toolsButton.setAttribute("aria-expanded", "false");
    }
  });
}

const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
} else {
  updateStatus("PDF.js could not be loaded. Check your internet connection and reload the page.", true);
  analyzeButton.disabled = true;
}

analyzeButton.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  const keywords = parseKeywords(keywordsInput.value);

  if (!file) {
    updateStatus("Select a PDF CV before running the analysis.", true);
    return;
  }

  if (file.type !== "application/pdf") {
    updateStatus("The selected file is not a PDF.", true);
    return;
  }

  if (keywords.length === 0) {
    updateStatus("Add at least one keyword or phrase to search for.", true);
    return;
  }

  toggleBusyState(true);
  updateStatus("Reading the PDF and scanning your keywords...");

  try {
    const pdfData = await extractPdfText(file);
    const analysis = analyzeKeywords(pdfData.text, keywords);
    renderResults({
      ...analysis,
      pageCount: pdfData.pageCount,
      extractedCharacters: pdfData.text.length,
      fileName: file.name,
    });
    updateStatus(`Analysis complete for ${file.name}.`);
  } catch (error) {
    console.error(error);
    updateStatus("The PDF could not be analyzed. Try another PDF with selectable text.", true);
  } finally {
    toggleBusyState(false);
  }
});

analyzeJobButton.addEventListener("click", () => {
  const rawText = jobProposalInput.value.trim();

  if (!rawText) {
    updateJobStatus("Paste a job proposal before running the analyzer.", true);
    return;
  }

  const rankedWords = extractRelevantJobWords(rawText, MAX_JOB_KEYWORDS);

  if (rankedWords.length === 0) {
    updateJobStatus("No relevant keywords were detected. Try a longer description.", true);
    jobResults.classList.add("hidden");
    return;
  }

  renderJobResults(rankedWords);
  updateJobStatus("Analysis complete. Use these words to tailor your CV.");
});

function updateStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function updateJobStatus(message, isError = false) {
  jobStatusMessage.textContent = message;
  jobStatusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function toggleBusyState(isBusy) {
  analyzeButton.disabled = isBusy;
  analyzeButton.textContent = isBusy ? "Analyzing..." : "Analyze CV";
}

function parseKeywords(rawValue) {
  const unique = new Set();

  return rawValue
    .split(/[\n,;]+/g)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .filter((keyword) => {
      const normalized = normalizeText(keyword);
      if (!normalized || unique.has(normalized)) {
        return false;
      }

      unique.add(normalized);
      return true;
    });
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text, keyword) {
  const expression = new RegExp(`(^|\\s)${escapeRegExp(keyword)}(?=\\s|$)`, "g");
  const matches = text.match(expression);
  return matches ? matches.length : 0;
}

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }

  return {
    pageCount: pdf.numPages,
    text: pages.join(" \n "),
  };
}

function analyzeKeywords(rawText, keywords) {
  const normalizedText = ` ${normalizeText(rawText)} `;
  const found = [];
  const missing = [];
  let totalMentions = 0;

  keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    const mentions = countOccurrences(normalizedText, normalizedKeyword);

    if (mentions > 0) {
      found.push({ keyword, mentions });
      totalMentions += mentions;
    } else {
      missing.push(keyword);
    }
  });

  const matchPercentage = keywords.length === 0
    ? 0
    : Math.round((found.length / keywords.length) * 100);

  return {
    totalKeywords: keywords.length,
    found,
    missing,
    totalMentions,
    matchPercentage,
  };
}

function renderResults(data) {
  resultsSection.classList.remove("hidden");

  matchRate.textContent = `${data.matchPercentage}%`;
  foundCount.textContent = String(data.found.length);
  keywordCount.textContent = String(data.totalKeywords);
  mentionCount.textContent = String(data.totalMentions);

  foundSummary.textContent = data.found.length > 0
    ? `${data.found.length} of ${data.totalKeywords} keywords were found in the CV.`
    : "No requested keywords were found in the CV text.";

  missingSummary.textContent = data.missing.length > 0
    ? `${data.missing.length} keywords or phrases were not detected.`
    : "Nothing is missing from the list you entered.";

  renderKeywordChips(foundKeywords, data.found, "found");
  renderKeywordChips(missingKeywords, data.missing, "missing");
  renderFacts([
    ["File analyzed", data.fileName],
    ["Pages scanned", String(data.pageCount)],
    ["Characters extracted", data.extractedCharacters.toLocaleString()],
    ["Total keyword mentions", String(data.totalMentions)],
  ]);
}

function renderKeywordChips(container, items, type) {
  container.innerHTML = "";

  if (items.length === 0) {
    const emptyState = document.createElement("span");
    emptyState.className = `chip ${type}`;
    emptyState.textContent = type === "found" ? "No matches" : "No missing keywords";
    container.appendChild(emptyState);
    return;
  }

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = `chip ${type}`;

    if (type === "found") {
      chip.textContent = item.keyword;
      const mentions = document.createElement("small");
      mentions.textContent = `${item.mentions} mention${item.mentions === 1 ? "" : "s"}`;
      chip.appendChild(mentions);
    } else {
      chip.textContent = item;
    }

    container.appendChild(chip);
  });
}

function renderFacts(facts) {
  documentFacts.innerHTML = "";

  facts.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "fact-item";

    const labelNode = document.createElement("span");
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.textContent = value;

    item.append(labelNode, valueNode);
    documentFacts.appendChild(item);
  });
}

function extractRelevantJobWords(rawText, maxWords) {
  const normalized = normalizeText(rawText);
  const words = normalized.split(" ").filter(Boolean);
  const frequencies = new Map();

  words.forEach((word) => {
    if (word.length < 3 || JOB_STOPWORDS.has(word)) {
      return;
    }

    const currentCount = frequencies.get(word) || 0;
    frequencies.set(word, currentCount + 1);
  });

  return [...frequencies.entries()]
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }

      return b[1] - a[1];
    })
    .slice(0, maxWords)
    .map(([word, count]) => ({ word, count }));
}

function renderJobResults(items) {
  jobResults.classList.remove("hidden");
  jobSummary.textContent = `Top ${items.length} relevant words detected from the job proposal.`;
  jobKeywords.innerHTML = "";

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "chip found";
    chip.textContent = item.word;

    const mentions = document.createElement("small");
    mentions.textContent = `${item.count} hit${item.count === 1 ? "" : "s"}`;
    chip.appendChild(mentions);

    jobKeywords.appendChild(chip);
  });
}

const JOB_STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "algo", "algun", "algunas", "algunos", "all", "also", "and", "any", "are", "around", "asa", "asi", "at", "based", "been", "being", "below", "between", "both", "but", "cada", "como", "con", "consider", "consigo", "could", "cuando", "de", "del", "desde", "details", "did", "does", "doing", "don", "during", "each", "either", "el", "ella", "ellas", "ellos", "empleo", "en", "entre", "era", "eres", "es", "esa", "esas", "eso", "esos", "esta", "estado", "estamos", "estan", "estar", "estas", "este", "esto", "estos", "experience", "for", "from", "further", "get", "had", "has", "have", "having", "her", "here", "hers", "herself", "him", "himself", "his", "how", "into", "its", "itself", "job", "la", "las", "le", "les", "lo", "los", "mas", "me", "mi", "mis", "more", "most", "muy", "must", "need", "nuestra", "nuestro", "o", "of", "on", "or", "otra", "other", "our", "out", "para", "pero", "por", "porque", "position", "puesto", "que", "quien", "required", "requirements", "role", "se", "sea", "ser", "si", "sin", "sobre", "some", "su", "sus", "take", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "tu", "tus", "un", "una", "under", "until", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "with", "you", "your", "yours", "yourself", "yourselves"
]);
