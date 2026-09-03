"""Database utilities for PostgreSQL + pgvector"""
import os
import math
import logging
import psycopg2
from psycopg2.extras import RealDictCursor, Json
import json
from typing import List, Dict, Any, Optional
from config import settings

def _safe_float(v, fallback: float = 0.0) -> float:
    """Return a JSON-safe float; replaces nan/inf with fallback."""
    try:
        f = float(v)
        return fallback if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return fallback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """
    Get PostgreSQL database connection.

    Connection strategy is selected once at startup via DB_AUTH_MODE env var:

      (not set / "neon")  → psycopg2.connect(NEON_DATABASE_URL / DATABASE_URL)
      "postgres-azure"    → Azure Postgres with username + password + SSL
      "entra" / "hybrid"  → Azure Postgres with Managed Identity Entra token + SSL
                            Token is fetched/refreshed automatically from Azure IMDS.
    """
    auth_mode = (settings.DB_AUTH_MODE or "").lower()

    try:
        if auth_mode in ("entra", "hybrid"):
            from utils.entra_token import get_entra_token
            token = get_entra_token()
            conn = psycopg2.connect(
                host=settings.DB_HOST,
                user=settings.DB_USER,
                dbname=settings.DB_NAME,
                password=token,
                port=5432,
                sslmode="require",
            )
        elif auth_mode == "postgres-azure":
            conn = psycopg2.connect(
                host=settings.DB_HOST,
                user=settings.DB_USER,
                dbname=settings.DB_NAME,
                password=settings.DB_PASSWORD,
                port=5432,
                sslmode="require",
            )
        else:
            # Default: Neon / local (unchanged behaviour)
            conn = psycopg2.connect(settings.DATABASE_URL)

        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise

def is_database_available() -> bool:
    """Check if database is available"""
    try:
        conn = get_db_connection()
        conn.close()
        return True
    except:
        return False

def sanitize_text_for_postgres(text: str) -> str:
    """Remove NUL characters and other invalid bytes that PostgreSQL can't store"""
    if not text:
        return ""
    # Remove NUL (0x00) characters which PostgreSQL text fields can't contain
    return text.replace('\x00', '')

def store_document_chunks(document_id: str, chunks: List[Dict[str, Any]]) -> List[str]:
    """
    Store document chunks in database
    Returns list of chunk IDs
    """
    conn = get_db_connection()
    cur = conn.cursor()
    chunk_ids = []
    
    try:
        for chunk in chunks:
            # Sanitize text to remove NUL characters that PostgreSQL can't store
            sanitized_text = sanitize_text_for_postgres(chunk['text'])
            
            cur.execute("""
                INSERT INTO document_chunks 
                (document_id, chunk_text, chunk_index, token_count, metadata)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                document_id,
                sanitized_text,
                chunk.get('chunk_num', 0),
                chunk.get('token_count'),
                Json(chunk.get('metadata', {}))
            ))
            chunk_id = cur.fetchone()[0]
            chunk_ids.append(chunk_id)
        
        conn.commit()
        logger.info(f"Stored {len(chunk_ids)} chunks for document {document_id}")
        return chunk_ids
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to store chunks: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def store_vector_embeddings(chunk_ids: List[str], embeddings: List[List[float]], model_name: str = None, use_azure: bool = False) -> bool:
    """
    Store vector embeddings for multiple chunks using native pgvector format.
    When use_azure=True, stores 3072-dim vectors in embedding_3072 column.
    Otherwise stores 1024-dim vectors in the standard embedding column.
    """
    # Security: validate col against allowlist before using in SQL
    _VALID_EMBEDDING_COLS = frozenset({"embedding", "embedding_3072"})
    col = "embedding_3072" if use_azure else "embedding"
    if col not in _VALID_EMBEDDING_COLS:
        raise ValueError(f"Invalid embedding column: {col!r}")
    if model_name is None:
        model_name = "text-embedding-3-large" if use_azure else "mxbai-embed-large"

    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Validate inputs
        if len(chunk_ids) != len(embeddings):
            raise ValueError(f"Mismatch: {len(chunk_ids)} chunk IDs but {len(embeddings)} embeddings")
        
        # Register pgvector type
        from psycopg2.extensions import register_adapter, AsIs
        register_adapter(list, lambda l: AsIs(f'ARRAY{l}'))
        
        # Batch insert embeddings using native vector format
        for idx, (chunk_id, embedding) in enumerate(zip(chunk_ids, embeddings)):
            # Validate embedding is a list
            if not isinstance(embedding, list):
                logger.error(f"Embedding at index {idx} is type {type(embedding)}, expected list. Value: {str(embedding)[:100]}")
                raise TypeError(f"Embedding at index {idx} is {type(embedding).__name__}, expected list")
            
            # Convert Python list to PostgreSQL vector format
            try:
                vector_str = '[' + ','.join(str(x) for x in embedding) + ']'
            except TypeError as te:
                logger.error(f"Failed to convert embedding at index {idx} to string. Type: {type(embedding)}, Value: {str(embedding)[:100]}")
                raise TypeError(f"Cannot iterate over embedding at index {idx}: {te}")
            
            from psycopg2 import sql as pgsql
            cur.execute(pgsql.SQL("""
                INSERT INTO document_embeddings 
                (chunk_id, {col}, model_name)
                VALUES (%s, %s::vector, %s)
                RETURNING id
            """).format(col=pgsql.Identifier(col)),
            (chunk_id, vector_str, model_name))
        
        conn.commit()
        logger.info(f"Stored {len(chunk_ids)} embeddings using native pgvector format")
        return True
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to store embeddings: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def search_similar_chunks(query_embedding: List[float], document_ids: Optional[List[str]] = None, top_k: int = 5, use_azure: bool = False) -> List[Dict[str, Any]]:
    """
    Search for similar chunks using native pgvector cosine similarity with HNSW index.
    When use_azure=True, searches the embedding_3072 column (3072-dim Azure vectors).
    Otherwise searches the standard embedding column (1024-dim Ollama vectors).
    """
    col = "embedding_3072" if use_azure else "embedding"

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Convert query embedding to pgvector format
        vector_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
        
        # Build optimized query using pgvector's <=> operator for cosine distance
        # The HNSW index automatically accelerates this query
        # CRITICAL: If document_ids is explicitly an empty list, return no results
        # This ensures chats without attached documents don't search ALL user documents
        if document_ids is not None and len(document_ids) == 0:
            logger.info("No document IDs provided - returning empty results (not searching all documents)")
            return []
        
        # Security: validate col against allowlist (already done above, but guard here too)
        _VALID_EMBEDDING_COLS = frozenset({"embedding", "embedding_3072"})
        if col not in _VALID_EMBEDDING_COLS:
            raise ValueError(f"Invalid embedding column: {col!r}")

        from psycopg2 import sql as pgsql

        base_parts = [pgsql.SQL("""
            SELECT 
                dc.id,
                dc.document_id,
                dc.chunk_text,
                dc.chunk_index,
                dc.metadata,
                d.name as document_name,
                1 - (de.{col} <=> %s::vector) as similarity
            FROM document_chunks dc
            JOIN document_embeddings de ON dc.id = de.chunk_id
            JOIN documents d ON dc.document_id = d.id
            WHERE de.{col} IS NOT NULL
        """).format(col=pgsql.Identifier(col))]

        params = [vector_str]

        if document_ids:
            base_parts.append(pgsql.SQL(" AND dc.document_id IN ({})").format(
                pgsql.SQL(', ').join(pgsql.Placeholder() for _ in document_ids)
            ))
            params.extend(document_ids)

        base_parts.append(pgsql.SQL("""
            ORDER BY de.{col} <=> %s::vector
            LIMIT %s
        """).format(col=pgsql.Identifier(col)))
        params.extend([vector_str, top_k])

        cur.execute(pgsql.SQL('').join(base_parts), params)
        results = cur.fetchall()
        
        # Convert to list of dicts
        return [{
            'id': row['id'],
            'document_id': row['document_id'],
            'chunk_text': row['chunk_text'],
            'chunk_index': row['chunk_index'],
            'metadata': row['metadata'],
            'document_name': row['document_name'],
            'similarity': _safe_float(row['similarity'])
        } for row in results]
        
    except Exception as e:
        logger.error(f"Failed to search chunks: {e}", exc_info=True)
        return []
    finally:
        cur.close()
        conn.close()

def get_all_chunks_for_documents(document_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Return ALL stored chunks for the given document IDs, ordered by document then chunk index.
    Used by exhaustive retrieval mode so the LLM sees every row in list/roster documents
    rather than only the top-k most similar chunks.
    """
    if not document_ids:
        return []

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        from psycopg2 import sql as pgsql
        query = pgsql.SQL("""
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_text,
                dc.chunk_index,
                dc.metadata,
                d.name AS document_name,
                1.0 AS similarity
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.document_id IN ({placeholders})
            ORDER BY dc.document_id, dc.chunk_index
        """).format(
            placeholders=pgsql.SQL(', ').join(pgsql.Placeholder() for _ in document_ids)
        )
        cur.execute(query, document_ids)
        results = cur.fetchall()
        return [{
            'id': row['id'],
            'document_id': row['document_id'],
            'chunk_text': row['chunk_text'],
            'chunk_index': row['chunk_index'],
            'metadata': row['metadata'],
            'document_name': row['document_name'],
            'similarity': 1.0
        } for row in results]
    except Exception as e:
        logger.error(f"Failed to get all chunks: {e}", exc_info=True)
        return []
    finally:
        cur.close()
        conn.close()


def update_processing_status(document_id: str, status: str, **kwargs):
    """Update document processing status"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Build dynamic UPDATE query
        fields = ['status = %s']
        values = [status]
        
        # Security: allowlisted column names only — never interpolate arbitrary kwargs keys
        _ALLOWED_UPDATE_FIELDS = frozenset({'total_chunks', 'processed_chunks', 'company_name', 'error_message'})
        for key, value in kwargs.items():
            if key in _ALLOWED_UPDATE_FIELDS:
                fields.append(f"{key} = %s")
                values.append(value)
        
        if status == 'processing' and 'started_at' not in kwargs:
            fields.append("started_at = NOW()")
        elif status in ['completed', 'failed']:
            fields.append("completed_at = NOW()")
        
        values.append(document_id)
        
        # fields list contains only whitelisted column names (validated above) and
        # literal SQL fragments (e.g. "started_at = NOW()") — safe to join.
        from psycopg2 import sql as pgsql
        query = pgsql.SQL("""
            UPDATE document_processing 
            SET {fields}
            WHERE document_id = %s
        """).format(fields=pgsql.SQL(', '.join(fields)))

        cur.execute(query, values)
        
        # If no rows updated, insert new record
        if cur.rowcount == 0:
            cur.execute("""
                INSERT INTO document_processing (document_id, status, total_chunks, processed_chunks, company_name, error_message)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                document_id,
                status,
                kwargs.get('total_chunks'),
                kwargs.get('processed_chunks'),
                kwargs.get('company_name'),
                kwargs.get('error_message')
            ))
        
        conn.commit()
        logger.info(f"Updated processing status for document {document_id}: {status}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to update processing status: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def get_processing_status(document_id: str) -> Optional[Dict[str, Any]]:
    """Get document processing status"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM document_processing 
            WHERE document_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (document_id,))
        
        result = cur.fetchone()
        return dict(result) if result else None
        
    finally:
        cur.close()
        conn.close()
