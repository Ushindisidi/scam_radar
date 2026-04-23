# 🛡️ ScamRadar — AI-Powered Scam Detection

> Paste anything suspicious. Get a verdict in seconds.

ScamRadar is an AI-powered scam detection tool that analyzes emails, job offers, websites, investment pitches, and any suspicious content. It searches the web across multiple sources, applies scam pattern analysis, and returns a structured verdict with a scam score, red flags, and a recommendation.

![ScamRadar Demo](./assets/demo.png)

---

## ✨ Features

- **Multi-source web search** — fires 6 targeted searches across Google, Reddit, Trustpilot, Glassdoor, and complaint forums simultaneously
- **AI-powered analysis** — uses Groq LLM (Llama 3.3 70B) with carefully engineered prompts
- **Kenya/East Africa heuristics** — detects M-Pesa payment requests, facilitation fees, WhatsApp-only recruitment, and regional scam patterns
- **Smart summarization** — automatically summarizes long emails before analysis so nothing important gets missed
- **Structured verdicts** — returns SCAM / SUSPICIOUS / LIKELY LEGIT / LEGIT with scam score, red flags, positive signals, and recommendation
- **Two endpoints** — separate analysis for text/messages and URLs
- **Light/dark mode** — clean, readable UI with live investigation stepper
- **Real-time logging** — full visibility into every step of the analysis

---

## 🧠 How It Works

```
User Input (text or URL)
        ↓
Smart Summarization (if input > 300 chars)
        ↓
6 Parallel Web Searches (Serper API)
  → "{input}" scam
  → "{input}" reviews reddit
  → "{input}" complaints
  → "{input}" legit or fraud
  → "{input}" site:trustpilot.com
  → "{input}" site:glassdoor.com
        ↓
LLM Analysis (Groq — Llama 3.3 70B)
  → Scam pattern matching
  → Kenya/East Africa heuristics
  → Hard scoring rules (fees = score ≥ 60)
        ↓
Structured JSON Verdict
  → verdict, scam_score, confidence
  → red_flags, positive_signals
  → missing_information, summary, recommendation
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.11) |
| LLM | Groq API — Llama 3.3 70B |
| Web Search | Serper API |
| Frontend | React + TypeScript (Vite) |
| Deployment | Render (backend) + Vercel (frontend) |
| Containerization | Docker |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Groq API key](https://console.groq.com)
- [Serper API key](https://serper.dev)

### Backend Setup

```bash
# Clone the repo
git clone https://github.com/Ushindisidi/scam_radar.git
cd scam_radar/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Run the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend` folder:

```env
GROQ_API_KEY=your_groq_api_key_here
SERPER_API_KEY=your_serper_api_key_here
```

---

## 📡 API Endpoints

### Analyze Text / Message / Email
```http
POST /analyze/text
Content-Type: application/json

{
  "input_text": "We are hiring! Send your CV to... documentation fee may apply."
}
```

### Analyze URL / Website
```http
POST /analyze/url
Content-Type: application/json

{
  "url": "https://suspicious-site.com"
}
```

### Response Format
```json
{
  "input": "...",
  "type": "text",
  "analysis": {
    "verdict": "SUSPICIOUS",
    "scam_score": 65,
    "confidence": "MEDIUM",
    "red_flags": ["Requests for documentation fee", "Mixed reviews online"],
    "positive_signals": ["Company has some verifiable presence"],
    "missing_information": ["No Trustpilot reviews found"],
    "summary": "The documentation fee is a common scam pattern...",
    "recommendation": "Exercise caution before proceeding."
  }
}
```

---

## 🧪 Example Verdicts

| Input | Verdict | Score |
|-------|---------|-------|
| Codveda Technologies internship + documentation fee | SUSPICIOUS | 65 |
| "Guaranteed 2% daily profit, send via M-Pesa Till" | SCAM | 89 |
| Deloitte Kenya graduate recruitment | LEGIT | 8 |
| Unknown company with no web presence | INSUFFICIENT DATA | 50 |

---

## 🗺️ Roadmap

- [ ] WebSockets for real-time investigation updates
- [ ] Browser extension
- [ ] WHOIS domain age checking
- [ ] Phone number scam detection
- [ ] Report sharing and community database
- [ ] Mobile app

---

## 👩🏾‍💻 Built By

**Ushindi Sidi Kombe** — Generative AI Engineer & Full-Stack Developer based in Nairobi, Kenya.

- LinkedIn: [linkedin.com/in/ushindi-kombe-4b1325241](https://linkedin.com/in/ushindi-kombe-4b1325241)
- GitHub: [github.com/Ushindisidi](https://github.com/Ushindisidi)

---

## 📄 License

MIT License — feel free to use, modify, and build on this.