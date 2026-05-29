import hashlib
import math
import numpy as np


def vector_to_literal(vector):
    return '[' + ','.join(f'{x:.6f}' for x in vector) + ']'


def literal_to_vector(literal):
    raw = literal.strip().lstrip('[').rstrip(']')
    if not raw:
        return []
    return [float(x) for x in raw.split(',')]


def deterministic_embedding(text, dim=384):
    text = text or ''
    values = []
    for i in range(dim):
        seed = f'{text}-{i}'.encode('utf-8')
        digest = hashlib.sha256(seed).hexdigest()
        number = int(digest[:8], 16)
        values.append((number % 10000) / 10000.0)
    return values


# Load model once at module level to avoid expensive re-initialization
_MODEL = None


def get_model():
    global _MODEL
    if _MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer

            # Loading model once. This might take a few seconds on first call.
            _MODEL = SentenceTransformer('all-MiniLM-L6-v2')
        except Exception:
            # Fallback to False to indicate failure and avoid repeated imports
            _MODEL = False
    return _MODEL


def generate_embedding(text):
    model = get_model()
    if model:
        try:
            return model.encode(text or '', normalize_embeddings=True).tolist()
        except Exception:
            return deterministic_embedding(text)
    return deterministic_embedding(text)


def cosine_similarity(v1, v2):
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    
    vec1 = np.array(v1)
    vec2 = np.array(v2)
    
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(np.dot(vec1, vec2) / (norm1 * norm2))
