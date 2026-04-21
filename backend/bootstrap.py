import os
import certifi

# Force a valid CA bundle no matter the shell (PowerShell, Git Bash, Linux, CI)
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()