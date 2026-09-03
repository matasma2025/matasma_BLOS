"""
RAG (Retrieval-Augmented Generation) API routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import sys
import math
import logging

def _safe_float(v, fallback: float = 0.0) -> float:
    """Return a JSON-safe float; replaces nan/inf with fallback."""
    try:
        f = float(v)
        return fallback if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return fallback

def _sanitize_chunks(chunks: list) -> list:
    """Recursively replace nan/inf floats in chunk dicts before JSON serialisation."""
    sanitized = []
    for chunk in chunks:
        clean = {}
        for k, v in chunk.items():
            if isinstance(v, float):
                clean[k] = _safe_float(v)
            elif isinstance(v, dict):
                clean[k] = {ck: (_safe_float(cv) if isinstance(cv, float) else cv) for ck, cv in v.items()}
            else:
                clean[k] = v
        sanitized.append(clean)
    return sanitized

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../attached_assets'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

# Import schema context builder for domain-aware RAG
try:
    from python_backend.services.schema_context_builder import schema_context_builder
    SCHEMA_CONTEXT_AVAILABLE = True
except ImportError:
    SCHEMA_CONTEXT_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Exhaustive retrieval ──────────────────────────────────────────────────────
# When the user's question asks for a complete enumeration, return ALL chunks
# for the attached documents instead of the top-k most similar ones.
# Cap at EXHAUSTIVE_CHUNK_CAP chunks so we never overflow the LLM context window.
EXHAUSTIVE_CHUNK_CAP = 100

_EXHAUSTIVE_KEYWORDS = {
    "all ", "every ", "all students", "all records", "all entries", "all rows",
    "list all", "list every", "give me all", "give me every", "give me the complete",
    "complete list", "full list", "entire list", "how many total", "how many students",
    "total students", "all emails", "all names", "all contacts",
}

def _is_exhaustive_query(query: str) -> bool:
    """Return True when the query is asking for a complete enumeration of records."""
    q = query.lower()
    return any(kw in q for kw in _EXHAUSTIVE_KEYWORDS)

class RAGRequest(BaseModel):
    query: str
    user_id: str
    document_ids: Optional[List[str]] = None
    chat_history: Optional[List[dict]] = None
    use_web_search: bool = True
    company_ids: Optional[List[str]] = None
    cube_ids: Optional[List[str]] = None
    cube_metadata: Optional[Dict[str, dict]] = None  # Cube metadata for query enhancement (entities, metrics, periods)
    ai_config: Optional[Dict] = None  # Domain-specific AI provider config (Azure OpenAI or None for Ollama)

def get_enterprise_chunks(query_embedding, request: RAGRequest, cursor, top_k: int = 5):
    """
    Helper function to retrieve enterprise document chunks with properly deserialized metadata.
    Uses company_ids AND cube_ids for filtering.
    When request.ai_config has provider='azure_openai', searches the embedding_3072 column
    (3072-dim Azure vectors). Otherwise searches the standard embedding column (1024-dim Ollama).
    """
    import json
    from psycopg2.extras import RealDictCursor
    
    enterprise_chunks = []
    
    company_ids = request.company_ids
    cube_ids = request.cube_ids
    ai_config = request.ai_config or {}

    # Determine which embedding column to use
    use_azure = (
        ai_config.get("provider") == "azure_openai"
        and ai_config.get("embedding_model")
    )
    embedding_col = "embedding_3072" if use_azure else "embedding"
    expected_dims = 3072 if use_azure else 1024

    logger.info(f"get_enterprise_chunks called with company_ids: {company_ids}, cube_ids: {cube_ids}, user_id: {request.user_id}, embedding_col: {embedding_col}")
    
    # Log cube metadata if provided (for future query enhancement)
    if request.cube_metadata:
        total_entities = sum(len(m.get('entities', [])) for m in request.cube_metadata.values())
        total_metrics = sum(len(m.get('metrics', [])) for m in request.cube_metadata.values())
        total_periods = sum(len(m.get('periods', [])) for m in request.cube_metadata.values())
        logger.info(f"📊 Cube metadata available: {total_entities} entities, {total_metrics} metrics, {total_periods} periods across {len(request.cube_metadata)} cubes")
    
    if not company_ids:
        logger.info(f"Enterprise data disabled - no company_ids provided for user {request.user_id}")
        return enterprise_chunks
    
    # Validate embedding dimensions match what we expect
    if len(query_embedding) != expected_dims:
        logger.error(f"Query embedding dimension mismatch: got {len(query_embedding)}, expected {expected_dims} for column {embedding_col}")
        return enterprise_chunks

    vector_str = '[' + ','.join(str(x) for x in query_embedding) + ']'
    
    dict_cursor = cursor.connection.cursor(cursor_factory=RealDictCursor)
    
    # SECURITY: Cube isolation is mandatory for enterprise data
    # Users must have explicit cube access to query enterprise documents
    # If no cube_ids provided, return zero rows to enforce data isolation
    if not cube_ids or len(cube_ids) == 0:
        logger.info(f"🔒 Cube isolation ENFORCED - user has no cube access, returning zero enterprise chunks")
        dict_cursor.close()
        return enterprise_chunks  # Return empty list
    
    logger.info(f"🔒 Cube filtering ENABLED - querying only from {len(cube_ids)} accessible cubes via {embedding_col}")
    # Security: validate embedding_col against allowlist before interpolating
    # into SQL — prevents SQL injection if the value were ever externally influenced.
    _VALID_EMBEDDING_COLS = frozenset({"embedding", "embedding_3072"})
    if embedding_col not in _VALID_EMBEDDING_COLS:
        raise ValueError(f"Invalid embedding column: {embedding_col!r}")

    from psycopg2 import sql as pgsql
    dict_cursor.execute(pgsql.SQL("""
        SELECT 
            ee.chunk_id,
            ec.chunk_text,
            ec.chunk_index,
            ec.metadata,
            ed.name as document_name,
            ed.id as document_id,
            ed.company_id,
            ed.cube_id,
            ee.{col} <=> %s::vector as distance
        FROM enterprise_document_embeddings ee
        JOIN enterprise_document_chunks ec ON ee.chunk_id = ec.id
        JOIN enterprise_documents ed ON ec.document_id = ed.id
        LEFT JOIN enterprise_document_processing edp ON ed.id = edp.document_id
        WHERE ed.company_id = ANY(%s) 
          AND ed.cube_id = ANY(%s)
          AND ee.{col} IS NOT NULL
          AND (edp.status = 'completed' OR edp.status IS NULL)
        ORDER BY ee.{col} <=> %s::vector
        LIMIT %s
    """).format(col=pgsql.Identifier(embedding_col)),
    (vector_str, company_ids, cube_ids, vector_str, top_k))
    
    for row in dict_cursor.fetchall():
        # RealDictCursor automatically deserializes JSON columns
        # but we ensure metadata is a dict for safety
        metadata = row['metadata']
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}
        
        enterprise_chunks.append({
            'chunk_id': row['chunk_id'],
            'chunk_text': row['chunk_text'],
            'chunk_index': row['chunk_index'],
            'metadata': metadata or {},  # Ensure dict, never None
            'document_name': f"[Enterprise] {row['document_name']}",
            'document_id': row['document_id'],
            'company_id': row['company_id'],
            'distance': _safe_float(row['distance']),
            'similarity': _safe_float(1.0 - _safe_float(row['distance']))
        })
    
    dict_cursor.close()
    
    logger.info(f"get_enterprise_chunks returning {len(enterprise_chunks)} chunks for company_ids: {company_ids}")
    
    return enterprise_chunks

@router.post("/analyze")
async def rag_analyze(request: RAGRequest):
    """
    Perform RAG-enhanced analysis using documents and optional web search
    """
    try:
        from services.vector_store import get_embeddings
        from services.rag_engine import synthesize_web_and_document_results, perform_web_search, should_search_web
        from config import settings
        import requests
        
        # Helper for LLM completion
        def get_ai_completion(prompt: str, system_prompt: str = None):
            base_url = settings.OLLAMA_BASE_URL.replace("/v1", "").rstrip("/")
            full_prompt = f"system: {system_prompt}\nuser: {prompt}\nassistant:" if system_prompt else prompt
            # OLLAMA_VERIFY_TLS=false must be set explicitly when the Ollama
            # endpoint uses a self-signed certificate (e.g. internal dev proxy).
            _verify_tls = os.environ.get("OLLAMA_VERIFY_TLS", "true").lower() != "false"
            resp = requests.post(
                f"{base_url}/generate",
                json={
                    "model": settings.OLLAMA_CHAT_MODEL,
                    "prompt": full_prompt,
                    "stream": False
                },
                headers={
                    "x-api-key": settings.OLLAMA_API_KEY
                },
                verify=_verify_tls,
            )
            resp.raise_for_status()
            return resp.json().get("response", "")

        from database import search_similar_chunks, get_db_connection, get_all_chunks_for_documents
        
        # Generate query embedding
        query_embedding, _ = get_embeddings([request.query])
        query_embedding = query_embedding[0]
        
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Search personal document chunks — use exhaustive mode for list/roster queries
        if _is_exhaustive_query(request.query) and request.document_ids:
            personal_chunks = get_all_chunks_for_documents(request.document_ids)
            if len(personal_chunks) > EXHAUSTIVE_CHUNK_CAP:
                # Document too large for exhaustive mode — fall back to high top_k
                logger.info(f"Exhaustive mode: {len(personal_chunks)} chunks exceeds cap, using top_k={EXHAUSTIVE_CHUNK_CAP}")
                personal_chunks = search_similar_chunks(
                    query_embedding, document_ids=request.document_ids, top_k=EXHAUSTIVE_CHUNK_CAP
                )
            else:
                logger.info(f"Exhaustive mode: returning all {len(personal_chunks)} chunks for list query")
        else:
            personal_chunks = search_similar_chunks(
                query_embedding,
                document_ids=request.document_ids,
                top_k=5
            )

        # FIX: Increase top_k to 40 for enterprise chunks to ensure all entities (Korea, Japan, Taiwan, etc.) 
        # are included in context for large Excel files - more chunks needed with 20 rows/chunk setting
        enterprise_chunks = get_enterprise_chunks(query_embedding, request, cursor, top_k=40)
        
        cursor.close()
        conn.close()
        
        # Merge and sort by distance (or similarity)
        chunks = sorted(
            personal_chunks + enterprise_chunks,
            key=lambda x: x.get('distance', 1.0 - x.get('similarity', 0))
        )[:30]
        
        context_parts = []
        metadata_summary = {
            'all_scenarios': set(),
            'all_metrics': set(),
            'all_sheets': set(),
            'has_fiscal_data': False
        }
        
        for chunk in chunks:
            chunk_metadata = chunk.get('metadata', {}) or {}
            
            if chunk_metadata.get('detected_scenarios'):
                metadata_summary['all_scenarios'].update(chunk_metadata['detected_scenarios'])
            if chunk_metadata.get('detected_metrics'):
                metadata_summary['all_metrics'].update(chunk_metadata['detected_metrics'])
            if chunk_metadata.get('sheet_name'):
                metadata_summary['all_sheets'].add(chunk_metadata['sheet_name'])
            if chunk_metadata.get('fiscal_calendar'):
                metadata_summary['has_fiscal_data'] = True
            
            context_part = f"From document '{chunk.get('document_name', 'Unknown')}'"
            if chunk_metadata.get('sheet_name'):
                context_part += f" (Sheet: {chunk_metadata['sheet_name']})"
            
            meta_info = []
            if chunk_metadata.get('entities_in_chunk'):
                entities = chunk_metadata['entities_in_chunk'][:5]
                meta_info.append(f"Entities: {', '.join(entities)}")
            if chunk_metadata.get('columns'):
                cols = chunk_metadata['columns'][:5]
                meta_info.append(f"Columns: {', '.join([str(c) for c in cols])}")
            if chunk_metadata.get('row_range'):
                meta_info.append(f"Rows: {chunk_metadata['row_range']}")
            
            if meta_info:
                context_part += f"\n[{' | '.join(meta_info)}]"
            
            context_part += f"\n\n{chunk.get('chunk_text', '')}"
            context_parts.append(context_part)
        
        summary_header = "## DATA STRUCTURE OVERVIEW\n"
        if metadata_summary['all_scenarios']:
            summary_header += f"Available Entities/Scenarios: {', '.join(list(metadata_summary['all_scenarios'])[:10])}\n"
        if metadata_summary['all_metrics']:
            summary_header += f"Available Metrics: {', '.join(list(metadata_summary['all_metrics'])[:10])}\n"
        if metadata_summary['all_sheets']:
            summary_header += f"Data Sources: {', '.join(metadata_summary['all_sheets'])}\n"
        summary_header += "\n## RELEVANT DATA:\n\n"
        
        context = summary_header + "\n\n---\n\n".join(context_parts) if context_parts else ""
        
        schema_context_section = ""
        if SCHEMA_CONTEXT_AVAILABLE and request.cube_ids:
            try:
                primary_cube_id = request.cube_ids[0]
                rag_context = schema_context_builder.build_rag_context(primary_cube_id, None)
                if rag_context:
                    schema_context_section = f"\n\n{rag_context}\n"
            except Exception as e:
                logger.warning(f"Could not build schema context: {e}")
        
        system_prompt = f"""You are LedgerLM, an expert financial analysis assistant. 
        Analyze the provided financial documents and answer questions with precision and depth.
        {schema_context_section}"""
        
        document_answer = get_ai_completion(f"Context from documents:\n{context}\n\nQuestion: {request.query}", system_prompt=system_prompt)
        
        final_answer = document_answer
        web_results = []
        if request.use_web_search and should_search_web(request.query, document_answer):
            web_results = perform_web_search(request.query, num_results=3)
            if web_results:
                final_answer = synthesize_web_and_document_results(request.query, document_answer, web_results)
        
        return {
            "success": True,
            "query": request.query,
            "answer": final_answer,
            "sources": {
                "document_chunks": len(chunks),
                "web_results": len(web_results)
            },
            "chunks": _sanitize_chunks(chunks[:3]),
            "web_enhanced": len(web_results) > 0
        }
    except Exception as e:
        logger.error(f"RAG analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def rag_query(request: RAGRequest):
    """
    Query documents and return relevant context
    Used by chat interface to retrieve document chunks
    """
    try:
        from services.vector_store import get_embeddings
        from database import search_similar_chunks, get_db_connection, get_all_chunks_for_documents
        
        # Use domain AI config to embed the query (Azure 3072-dim or Ollama 1024-dim)
        query_embeddings, _ = get_embeddings([request.query], ai_config=request.ai_config)
        query_embedding = query_embeddings[0]
        logger.info(f"Query embedded: {len(query_embedding)}-dim vector (provider: {request.ai_config.get('provider', 'ollama') if request.ai_config else 'ollama'})")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        # Personal docs use the same embedding provider as the configured ai_config.
        # If Azure is active, new docs are stored in embedding_3072; search that column.
        # If no Azure config, fall back to Ollama 1024-dim embedding column.
        use_azure_personal = bool(
            request.ai_config
            and request.ai_config.get("provider") == "azure_openai"
            and request.ai_config.get("embedding_model")
        )
        if _is_exhaustive_query(request.query) and request.document_ids:
            personal_chunks = get_all_chunks_for_documents(request.document_ids)
            if len(personal_chunks) > EXHAUSTIVE_CHUNK_CAP:
                logger.info(f"Exhaustive mode: {len(personal_chunks)} chunks exceeds cap, using top_k={EXHAUSTIVE_CHUNK_CAP}")
                personal_chunks = search_similar_chunks(
                    query_embedding, document_ids=request.document_ids,
                    top_k=EXHAUSTIVE_CHUNK_CAP, use_azure=use_azure_personal,
                )
            else:
                logger.info(f"Exhaustive mode: returning all {len(personal_chunks)} chunks for list query")
        else:
            personal_chunks = search_similar_chunks(
                query_embedding,
                document_ids=request.document_ids,
                top_k=5,
                use_azure=use_azure_personal,
            )
        enterprise_chunks = get_enterprise_chunks(query_embedding, request, cursor, top_k=40)
        cursor.close()
        conn.close()

        # For exhaustive personal queries don't slice — keep all personal chunks;
        # for mixed queries keep the sorted top-30 as before.
        if _is_exhaustive_query(request.query) and request.document_ids and not request.cube_ids:
            chunks = personal_chunks  # enterprise is empty anyway (no cube_ids)
        else:
            chunks = sorted(personal_chunks + enterprise_chunks, key=lambda x: x.get('distance', 1.0 - x.get('similarity', 0)))[:30]
        
        if not chunks:
            return {"success": True, "context": "", "chunks": [], "found_chunks": 0}
        
        context_parts = []
        metadata_summary = {'all_scenarios': set(), 'all_metrics': set(), 'all_sheets': set(), 'has_fiscal_data': False}
        
        for chunk in chunks:
            chunk_metadata = chunk.get('metadata', {})
            if chunk_metadata.get('detected_scenarios'): metadata_summary['all_scenarios'].update(chunk_metadata['detected_scenarios'])
            if chunk_metadata.get('detected_metrics'): metadata_summary['all_metrics'].update(chunk_metadata['detected_metrics'])
            if chunk_metadata.get('sheet_name'): metadata_summary['all_sheets'].add(chunk_metadata['sheet_name'])
            
            context_part = f"From document '{chunk['document_name']}'"
            if chunk_metadata.get('sheet_name'): context_part += f" (Sheet: {chunk_metadata['sheet_name']})"
            
            meta_info = []
            if chunk_metadata.get('entities_in_chunk'): meta_info.append(f"Entities: {', '.join(chunk_metadata['entities_in_chunk'][:5])}")
            if meta_info: context_part += f"\n[{' | '.join(meta_info)}]"
            
            context_part += f"\n\n{chunk['chunk_text']}"
            context_parts.append(context_part)
        
        summary_header = "## DATA STRUCTURE OVERVIEW\n"
        if metadata_summary['all_scenarios']: summary_header += f"Available Entities: {', '.join(list(metadata_summary['all_scenarios'])[:10])}\n"
        
        context = summary_header + "\n\n---\n\n".join(context_parts)
        return {"success": True, "context": context, "chunks": _sanitize_chunks(chunks), "found_chunks": len(chunks)}
    except Exception as e:
        logger.error(f"RAG query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def rag_chat(request: RAGRequest):
    """
    Chat interface with RAG support
    """
    try:
        return await rag_analyze(request)
    except Exception as e:
        logger.error(f"RAG chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
