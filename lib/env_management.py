from dotenv import load_dotenv
import os


def load_env(env_path='.env'):
    load_dotenv(env_path)


def decrypt_env(enc_path):
    """Placeholder for encrypted env. Falls back to .env file."""
    plain_path = enc_path.replace('.enc', '')
    if os.path.exists(plain_path):
        load_dotenv(plain_path)
    elif os.path.exists('.env'):
        load_dotenv('.env')
