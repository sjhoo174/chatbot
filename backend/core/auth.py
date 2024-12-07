
from authlib.integrations.starlette_client import OAuth
import yaml
import requests

# Load YAML config
with open("credentials.yaml", "r") as file:
    config = yaml.safe_load(file)

oauth = OAuth()


# Function to fetch Google's JWKS URI synchronously
def get_google_jwks_uri():
    response = requests.get('https://accounts.google.com/.well-known/openid-configuration')
    data = response.json()
    return data['jwks_uri']

print(get_google_jwks_uri())

# Register Google OAuth credentials
oauth.register(
    name='google',
    client_id=config['google_oauth']['client_id'],
    client_secret=config['google_oauth']['client_secret'],
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    refresh_token_url=None,
    client_kwargs={'scope': config['google_oauth']['scope']},
    jwks_uri=get_google_jwks_uri(),  # Add the fetched JWKS URI here
)
