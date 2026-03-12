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

function updateStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
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
