import bootstrap  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.search import search_text, search_url
from services.analyzer import analyze_for_scam
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ScamRadar API",
    description="Detect scams, fraudulent websites, fake jobs, and suspicious activity",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "https://scam-radar-xi.vercel.app/" 
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class TextRequest(BaseModel):
    input_text: str

class UrlRequest(BaseModel):
    url: str

@app.get("/")
def root():
    return {"message": "ScamRadar API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/analyze/text")
async def analyze_text(request: TextRequest):
    if not request.input_text or len(request.input_text.strip()) < 3:
        raise HTTPException(status_code=400, detail="Input too short")
    if len(request.input_text) > 3000:
        raise HTTPException(status_code=400, detail="Input too long, max 3000 characters")
    
    logger.info(f"Text analysis request: {request.input_text[:50]}...")
    
    try:
        search_results = search_text(request.input_text)
        analysis = analyze_for_scam(request.input_text, search_results)
        return {"input": request.input_text, "type": "text", "analysis": analysis}
    except Exception as e:
        logger.error(f"Error analyzing text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/url")
async def analyze_url(request: UrlRequest):
    if not request.url or len(request.url.strip()) < 5:
        raise HTTPException(status_code=400, detail="URL too short")
    if not request.url.startswith("http"):
        raise HTTPException(status_code=400, detail="Please include http:// or https:// in your URL")
    if len(request.url) > 3000:
        raise HTTPException(status_code=400, detail="URL too long, max 3000 characters")
    
    logger.info(f"URL analysis request: {request.url}")
    
    try:
        search_results = search_url(request.url)
        analysis = analyze_for_scam(request.url, search_results)
        return {"input": request.url, "type": "url", "analysis": analysis}
    except Exception as e:
        logger.error(f"Error analyzing URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))