from openai import OpenAI

GPT_URL = "https://api.openai.com/v1/chat/completions"
API_KEY = ""
ORGANIZATION = ""

client = OpenAI(
    organization=ORGANIZATION,
    api_key=API_KEY
)

