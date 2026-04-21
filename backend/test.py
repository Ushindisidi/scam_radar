import requests

email_text = """
We are thrilled to welcome you to Codveda Technologies as a Python Development Intern.
This internship is designed to empower aspiring developers.
There are no learning or participation fees involved. However, a small documentation fee
may be applicable towards the end of the internship to process your official certificate.
Contact: support@codveda.com
Website: www.codveda.com
"""

response = requests.post(
    "http://localhost:8000/analyze/text",
    json={"input_text": email_text}
)

print(response.json())