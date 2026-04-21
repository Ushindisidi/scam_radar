import os
import logging
import json
import certifi
from groq import Groq
from dotenv import load_dotenv

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

_client: Groq | None = None

def get_groq_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        _client = Groq(api_key=api_key)
    return _client


def summarize_input(input_text: str) -> str:
    if len(input_text) <= 300:
        return input_text

    logger.info("Input is long, summarizing first...")

    try:
        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{
                "role": "user",
                "content": f"""Extract only the key facts from this text that would help determine if it is a scam.
Include: company name, website, email addresses, any mention of fees or payments, job/opportunity details, contact methods, promises made, urgent language.
Keep it under 300 words. Return plain text only, no formatting.

Text:
{input_text[:3000]}"""
            }],
            temperature=0.1
        )

        summary = response.choices[0].message.content.strip()
        logger.info(f"Summarized to: {summary[:100]}...")
        return summary

    except Exception as e:
        logger.error(f"Summarization error: {e}")
        return input_text[:300]


def analyze_for_scam(input_text: str, search_results: dict) -> dict:
    logger.info(f"Starting analysis for: {input_text[:50]}...")

    if len(input_text) > 300:
        input_text = summarize_input(input_text)

    formatted_results = ""
    for query, results in search_results.items():
        formatted_results += f"\nSearch: {query}\n"
        if results:
            for r in results:
                formatted_results += f"- {r['title']}: {r['snippet']}\n"
        else:
            formatted_results += "- No results found\n"

    prompt = f"""
You are ScamRadar, an expert scam detection AI. Your job is to analyze evidence and determine whether something is a scam.

The user submitted this for analysis:
---
{input_text}
---

Here is what was found across the internet about this:
{formatted_results}

Analyze the evidence carefully and look for red flags across ALL scam categories, including regional patterns common in Kenya and East Africa.

Job / Internship scams:
- Requests for payment, certificate fees, onboarding fees, or documentation fees
- Claims of "training fees", "placement fees", or "activation fees"
- Vague job descriptions with unrealistic pay or guaranteed placement
- Unsolicited job or internship offers via WhatsApp, Telegram, or email
- Requests for personal identification early in the process
- Claims of affiliation with well-known companies without verifiable proof

Website / Online scams:
- Very new or recently registered domains with little or no history
- No verifiable company registration
- Fake reviews or suspiciously perfect ratings
- Requests for payment upfront before services are delivered

Investment / Crypto scams:
- Guaranteed daily, weekly, or monthly returns
- Claims of "AI trading", "bot trading", or "risk-free crypto"
- Pressure to invest quickly or reinvest earnings
- Unregulated platforms or apps not listed on major exchanges
- Fake celebrity, influencer, or pastor endorsements
- Requests to send funds via crypto, mobile money, or personal wallets

Product / Shopping scams:
- Prices far below market value
- No clear return, refund, or contact policy
- Fake, duplicated, or AI-generated reviews
- Copied website designs or impersonation of known brands
- Requests to pay outside official platforms

Romance / Social scams:
- Requests for money, gifts, or financial help from someone not met in person
- Rapid emotional attachment or declarations of love
- Stories involving emergencies, medical issues, or blocked accounts
- Attempts to move conversations off-platform quickly

Kenya / Regional-specific scam heuristics:
- Requests for payments via M-Pesa, Airtel Money, or personal Paybill/Till numbers
- Use of phrases like "facilitation fee", "processing fee", or "clearance fee"
- Claims that opportunities are "government-backed" without official verification
- Use of urgency such as "limited slots", "last batch", or "apply today"
- Recruitment conducted entirely through WhatsApp or Telegram groups
- Claims of guaranteed overseas jobs, scholarships, or visas requiring upfront fees
- Fake use of logos or names of Kenyan institutions, universities, or NGOs

General red flags:
- Poor grammar or unprofessional communication
- Reports or warnings on Reddit, LinkedIn, Trustpilot, or Glassdoor
- No verifiable physical address or real-world presence
- Urgency, pressure tactics, or threats of loss
- Requests for sensitive personal or financial information

Important rules:
- Base your verdict strictly on the evidence provided above.
- Do NOT assume intent without evidence.
- Every red flag listed MUST be directly supported by either the user input or the internet findings.
- If there is not enough information to make a reliable determination, use "INSUFFICIENT DATA".

Score guidance:
0–20  → LEGIT
21–40 → LIKELY LEGIT
41–60 → SUSPICIOUS
61–100 → SCAM

Hard scoring rules (non-negotiable):
- If the input explicitly mentions any fees, charges, payments, certificates, onboarding costs, or documentation fees required from the user, the scam_score MUST be at least 60, regardless of other signals.
- If such fees appear in the context of a job, internship, investment, or opportunity, the verdict MUST be either "SUSPICIOUS" or "SCAM".
- If guaranteed profits or "risk-free returns" are claimed, scam_score MUST be at least 70.

Return your response in the following JSON format ONLY, with no extra text:

{{
  "verdict": "SCAM" | "SUSPICIOUS" | "LIKELY LEGIT" | "LEGIT" | "INSUFFICIENT DATA",
  "scam_score": <number from 0 to 100>,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "red_flags": [<specific red flags supported by evidence>],
  "positive_signals": [<specific signals suggesting legitimacy>],
  "missing_information": [<what additional evidence would help confirm the verdict>],
  "summary": "<2–3 sentence plain-English explanation of the verdict>",
  "recommendation": "<one clear action the user should take>"
}}

Be precise, cautious, and evidence-driven.
"""

    try:
        logger.info("Sending results to Groq LLM for analysis")

        client = get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )

        raw = response.choices[0].message.content.strip()
        logger.info(f"Raw LLM response: {raw[:200]}")
        raw = raw.replace("```json", "").replace("```", "").strip()

        result = json.loads(raw)
        logger.info(
            f"Analysis complete. Verdict: {result.get('verdict')} | "
            f"Score: {result.get('scam_score')}"
        )
        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {
            "verdict": "UNKNOWN",
            "scam_score": 50,
            "confidence": "LOW",
            "red_flags": ["Could not parse analysis results"],
            "positive_signals": [],
            "missing_information": [],
            "summary": "Analysis could not be completed. Please try again.",
            "recommendation": "Try again or research manually."
        }

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return {
            "verdict": "ERROR",
            "scam_score": 0,
            "confidence": "LOW",
            "red_flags": [str(e)],
            "positive_signals": [],
            "missing_information": [],
            "summary": "An error occurred during analysis.",
            "recommendation": "Please try again."
        }