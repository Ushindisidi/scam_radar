import os
import re
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SERPER_URL = "https://google.serper.dev/search"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


def run_search(query: str) -> list:
    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {"q": query, "num": 5}
    
    try:
        logger.info(f"Searching: {query}")
        response = requests.post(SERPER_URL, json=payload, headers=headers)
        response.raise_for_status()
        results = response.json().get("organic", [])
        logger.info(f"Found {len(results)} results for: {query}")
        return [{"title": r.get("title"), "snippet": r.get("snippet"), "link": r.get("link")} for r in results]
    except Exception as e:
        logger.error(f"Search error for '{query}': {e}")
        return []


def extract_entities(text: str) -> dict:
    # Extract URLs
    urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', text)
    
    # Extract email domains
    emails = re.findall(r'[\w.-]+@[\w.-]+\.\w+', text)
    domains = list(set([e.split('@')[1] for e in emails]))
    
    # Extract company names (look for patterns like "X Technologies", "X Inc", "X Ltd")
    companies = re.findall(r'[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:Technologies|Tech|Inc|Ltd|LLC|Solutions|Group|Services|Academy))', text)
    
    return {
        "urls": urls[:3],
        "domains": domains[:3],
        "companies": list(set(companies))[:3]
    }


def search_text(input_text: str) -> dict:
    logger.info(f"Running text search for: {input_text[:50]}...")
    all_results = {}

    # If text is long, extract entities and search those
    if len(input_text) > 100:
        entities = extract_entities(input_text)
        logger.info(f"Extracted entities: {entities}")

        # Search extracted companies
        for company in entities["companies"]:
            queries = [
                f'"{company}" scam',
                f'"{company}" reviews reddit',
                f'"{company}" complaints',
            ]
            for query in queries:
                all_results[query] = run_search(query)

        # Search extracted domains
        for domain in entities["domains"]:
            queries = [
                f'"{domain}" scam',
                f'"{domain}" fraud',
            ]
            for query in queries:
                all_results[query] = run_search(query)

        # Search extracted URLs
        for url in entities["urls"]:
            all_results[f'"{url}" scam or fraud'] = run_search(f'"{url}" scam or fraud')

        # If no entities found, fall back to first 100 chars
        if not all_results:
            logger.info("No entities found, falling back to short text search")
            short_text = input_text[:100]
            queries = [
                f'"{short_text}" scam',
                f'"{short_text}" reviews',
                f'"{short_text}" complaints',
            ]
            for query in queries:
                all_results[query] = run_search(query)

    else:
        # Short text — search directly
        queries = [
            f'"{input_text}" scam',
            f'"{input_text}" reviews reddit',
            f'"{input_text}" complaints',
            f'"{input_text}" legit or fraud',
            f'"{input_text}" site:trustpilot.com',
            f'"{input_text}" site:glassdoor.com',
        ]
        for query in queries:
            all_results[query] = run_search(query)

    return all_results


def search_url(url: str) -> dict:
    logger.info(f"Running URL search for: {url}")
    queries = [
        f'"{url}" scam',
        f'"{url}" reviews',
        f'"{url}" complaints reddit',
        f'"{url}" fraud warning',
        f'site:{url} reviews',
        f'is "{url}" legit',
    ]
    
    all_results = {}
    for query in queries:
        all_results[query] = run_search(query)
    
    return all_results