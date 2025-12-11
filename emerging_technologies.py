"""
Emerging Technologies Analysis Service with Vertex AI Integration.

This service provides AI-powered emerging technologies analysis using Vertex AI
and saves results to Google Cloud Storage, following the same pattern as patent.py.
"""

import os
import json
import asyncio
import threading
from datetime import datetime, timedelta
from queue import Queue, Empty
from threading import Thread
from typing import Optional, Dict, Any, Union, List

from fastapi import HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.utils.vertexai_utils import get_vertexai_client
import vertexai
from vertexai import agent_engines
from google.adk.sessions import VertexAiSessionService
from google.cloud import storage
from .gcs_service import gcs_service
from app.utils.storage import get_storage_client
from dotenv import load_dotenv
from app.utils.session_utils import generate_session_user_id
from app.utils.json_utils import extract_json_from_response, extract_json_with_key, get_json_value_by_key
import logging

# Module logger
logger = logging.getLogger(__name__)
if not logging.getLogger().handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

def extract_results_from_json(full_json: dict) -> Union[dict, list]:
    """
    Extract only the results portion from the full Emerging Technologies JSON response.
    
    Args:
        full_json: Complete Emerging Technologies JSON
        
    Returns:
        dict: Only the results section
    """
    if isinstance(full_json, dict) and "results" in full_json:
        return full_json["results"]
    return {}

def extract_results_from_response(text: str) -> Union[dict, list]:
    """
    Extract results directly from AI response text.
    
    Args:
        text: The full response text from the AI agent
        
    Returns:
        dict: Only the results section if found, empty dict otherwise
    """
    results = get_json_value_by_key(text, "results")
    return results if results else {}

from app.database.database import get_db
from app.auth.auth import get_current_user
from app.models.models import User, Innovation, Company, ProblemStandardization, AnalysisStatus, EmergingTechnologies

load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
BUCKET_NAME = "triz_bucket"

class EmergingTechnologiesRequest(BaseModel):
    companyId: str
    innovationId: str

class EmergingTechnologiesResponse(BaseModel):
    message: str
    gcs_url: str
    json_response: Optional[Dict[str, Any]] = None
    json_gcs_url: Optional[str] = None
    results_response: Optional[Union[Dict[str, Any], List[Any]]] = None
    results_gcs_url: Optional[str] = None
    innovationId: str
    companyId: str

class EmergingTechnologiesStreamer:
    def __init__(self):
        # Initialize Vertex AI using centralized client
        get_vertexai_client()
        
        # Original bucket logic restored
        self.project_id = PROJECT_ID
        self.location = LOCATION
        self.bucket_name = BUCKET_NAME
        self.resource_id = "8849775577922535424"  # Emerging Technologies Analysis Agent

    def initialize_vertex_ai(self):
        # VertexAI already initialized via centralized client
        pass

    async def create_session(self, user_id: str):
        service = VertexAiSessionService(self.project_id, self.location)
        # Generate unique user ID to prevent concurrent session conflicts
        unique_user_id = generate_session_user_id(user_id, prefix="emerging_technologies_user")
        session = await service.create_session(app_name=self.resource_id, user_id=unique_user_id)
        return service, session, unique_user_id

    def get_agent(self):
        return agent_engines.get(self.resource_id)

    def _stream_to_queue(self, agent, session_id: str, user_id: str, query: str, queue: Queue):
        try:
            for event in agent.stream_query(user_id=user_id, session_id=session_id, message=query):
                if "content" in event and "parts" in event["content"]:
                    for part in event["content"]["parts"]:
                        if "text" in part:
                            queue.put(part["text"])
        except Exception as e:
            queue.put(f"\n❌ Error: {e}\n")
        finally:
            queue.put(None)

    def _upload_to_gcs(self, text: str, innovation_id: str, company_id: str) -> tuple[str, str]:
        return gcs_service.upload_text_to_gcs(
            text=text,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="emerging_technologies",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )

    def _save_json_to_gcs(self, json_data: dict, innovation_id: str, company_id: str) -> tuple[str, str]:
        return gcs_service.save_json_to_gcs(
            json_data=json_data,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="emerging_technologies",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )
    
    def _save_results_to_gcs(self, results_data: Union[dict, list], innovation_id: str, company_id: str) -> tuple[str, str]:
        """Save only the results portion to GCS separately."""
        return gcs_service.save_json_to_gcs(
            json_data=results_data,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="emerging_technologies_results",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )

    async def stream_response(self, context_data: dict, user_id: str, innovation_id: str, company_id: str):
        self.initialize_vertex_ai()
        service, session, unique_user_id = await self.create_session(f"user_{user_id}")
        agent = self.get_agent()
        queue = Queue()
        full_response = []

        # Convert context data to the expected format for the agent
        query = json.dumps(context_data, indent=2)

        Thread(target=self._stream_to_queue, args=(agent, session.id, unique_user_id, query, queue)).start()

        async def generator():
            while True:
                try:
                    chunk = queue.get(timeout=0.2)
                    if chunk is None:
                        break
                    full_response.append(chunk)
                    yield chunk
                except Empty:
                    await asyncio.sleep(0.1)
            await service.delete_session(app_name=self.resource_id, user_id=unique_user_id, session_id=session.id)

        return generator, full_response

def format_innovation_for_emerging_technologies(innovation: Innovation, company: Company, db: Session, cached_data: dict = None) -> dict:
    """
    Format innovation data for the Emerging Technologies Analysis Agent by fetching problem standardization results.
    
    Args:
        innovation: Innovation database object
        company: Company database object
        db: Database session
        cached_data: Pre-fetched problem standardization data (optional)
        
    Returns:
        Problem standardization JSON data
        
    Raises:
        HTTPException: If problem standardization is not completed
    """
    # Use cached data if provided to avoid repeated GCS downloads
    if cached_data:
        logger.info("✅ Using pre-fetched problem standardization data for emerging technologies analysis")
        cached_data["region"] = "all"
        return cached_data
    # Check if problem standardization is completed
    problem_standardization = db.query(ProblemStandardization).filter(
        ProblemStandardization.innovation_id == innovation.id,
        ProblemStandardization.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not problem_standardization:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Problem standardization must be completed before generating emerging technologies analysis. Please run problem standardization analysis first."
        )
    
    if not problem_standardization.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Problem standardization JSON results not found. Please re-run problem standardization analysis."
        )
    
    try:
        client = get_storage_client()
        # Extract blob path from gs:// URL
        json_gcs_path = problem_standardization.json_gcs_url.replace("gs://triz_bucket/", "")
        blob = client.bucket("triz_bucket").blob(json_gcs_path)
        
        # Download and parse JSON content
        json_content = blob.download_as_text()
        problem_standardization_data = json.loads(json_content)
        
        # Add region field for emerging technologies analysis
        problem_standardization_data["region"] = "all"
        
        return problem_standardization_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch problem standardization results: {str(e)}"
        )


# Import check_user_access_to_innovation from problem_standardisation
from app.services.problem_standardisation import check_user_access_to_innovation

streamer = EmergingTechnologiesStreamer()

async def generate_emerging_technologies_analysis(
    req: EmergingTechnologiesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate emerging technologies analysis using Vertex AI with proper access control.
    
    Args:
        req: Request containing company_id and innovation_id
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        Emerging technologies analysis response with GCS URLs
        
    Raises:
        HTTPException: If user lacks access or innovation not found
    """
    try:
        # Verify user has access to the innovation
        innovation = check_user_access_to_innovation(
            db, 
            str(current_user.id), 
            req.companyId, 
            req.innovationId
        )
        
        if not innovation:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User does not have access to this innovation or innovation not found"
            )
        
        # Get company details
        company = db.query(Company).filter(Company.id == req.companyId).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        # Get or create emerging technologies record
        emerging_tech = db.query(EmergingTechnologies).filter(
            EmergingTechnologies.innovation_id == innovation.id
        ).first()
        
        if not emerging_tech:
            emerging_tech = EmergingTechnologies(
                innovation_id=innovation.id,
                status=AnalysisStatus.NOT_STARTED
            )
            db.add(emerging_tech)
            db.flush()  # Get the ID
        
        # Reset existing emerging technologies analysis to start fresh each time
        if emerging_tech.status == AnalysisStatus.COMPLETED:
            logger.info("🔄 Emerging technologies analysis already exists for innovation %s, resetting to start fresh", req.innovationId)
            emerging_tech.status = AnalysisStatus.NOT_STARTED
            emerging_tech.gcs_url = None
            emerging_tech.json_gcs_url = None
            emerging_tech.error = None
            emerging_tech.updated_at = datetime.now()
            db.commit()
            logger.info("✅ Emerging technologies analysis reset completed")
        
        # Check prerequisites BEFORE updating status to IN_PROGRESS
        try:
            # Format data for AI emerging technologies analysis (this will check prerequisites)
            context_data = format_innovation_for_emerging_technologies(innovation, company, db)
        except HTTPException as e:
            # Set status to FAILED and store error message
            emerging_tech.status = AnalysisStatus.FAILED
            emerging_tech.error = e.detail
            emerging_tech.updated_at = datetime.now()
            db.commit()
            raise  # Re-raise the HTTPException
        
        # Only set to IN_PROGRESS after prerequisites are validated
        emerging_tech.status = AnalysisStatus.IN_PROGRESS
        emerging_tech.error = None
        emerging_tech.updated_at = datetime.now()
        db.commit()
        
        # Process with Vertex AI
        generator_func, response_buffer = await streamer.stream_response(
            context_data, 
            str(current_user.id),
            req.innovationId,
            req.companyId
        )

        # Collect full response
        full_response_text = ""
        final_json_string = ""
        async for chunk in generator_func():
            final_json_string=chunk
            full_response_text += chunk

        logger.info("🔄 Emerging technologies analysis completed, response length: %d", len(full_response_text))

        # Save full response to GCS
        gcs_path, gcs_url = streamer._upload_to_gcs(
            full_response_text, 
            req.innovationId, 
            req.companyId
        )
        
        parsed_json = json.loads(final_json_string.replace("```json", "").replace("```", ""))
        
        if parsed_json:
            logger.info("✅ JSON extraction successful, keys: %s", list(parsed_json.keys()))
        else:
            logger.warning("❌ JSON extraction failed - will save text response only")
            
        json_gcs_path = None
        json_gcs_url = None
        results_gcs_path = None
        results_gcs_url = None
        
        # Save full JSON and results separately if extracted successfully
        if parsed_json:
            json_gcs_path, json_gcs_url = streamer._save_json_to_gcs(
                parsed_json, 
                req.innovationId, 
                req.companyId
            )
            
            results_gcs_path, results_gcs_url = streamer._save_results_to_gcs(
                parsed_json,
                req.innovationId,
                req.companyId
            )
        
        # Update emerging technologies record with completion status and GCS paths (not signed URLs)
        emerging_tech.status = AnalysisStatus.COMPLETED
        emerging_tech.gcs_url = gcs_path
        emerging_tech.json_gcs_url = json_gcs_path
        emerging_tech.updated_at = datetime.now()
        db.commit()

        return EmergingTechnologiesResponse(
            message="Emerging technologies analysis completed successfully",
            gcs_url=gcs_url,
            json_response=parsed_json,
            json_gcs_url=json_gcs_url,
            results_response=parsed_json,
            results_gcs_url=results_gcs_url,
            innovationId=req.innovationId,
            companyId=req.companyId
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Set status to FAILED if generation fails and store error message
        error_message = str(e)
        try:
            # Get or create emerging technologies record for error tracking
            emerging_tech = db.query(EmergingTechnologies).filter(
                EmergingTechnologies.innovation_id == req.innovationId
            ).first()
            
            if emerging_tech:
                emerging_tech.status = AnalysisStatus.FAILED
                emerging_tech.error = error_message
                emerging_tech.updated_at = datetime.now()
                db.commit()
        except:
            pass  # Don't fail the main error if database update fails
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Emerging technologies analysis failed: {error_message}"
        )

async def generate_emerging_technologies_analysis_stream(
    req: EmergingTechnologiesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream emerging technologies analysis results in real-time.
    
    Args:
        req: Request containing company_id and innovation_id
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        Streaming response with emerging technologies analysis results
        
    Raises:
        HTTPException: If user lacks access or innovation not found
    """
    try:
        # Verify user has access to the innovation
        innovation = check_user_access_to_innovation(
            db, 
            str(current_user.id), 
            req.companyId, 
            req.innovationId
        )
        
        if not innovation:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User does not have access to this innovation or innovation not found"
            )
        
        # Get company details
        company = db.query(Company).filter(Company.id == req.companyId).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        # Format data for AI emerging technologies analysis
        context_data = format_innovation_for_emerging_technologies(innovation, company, db)
        
        # Stream response
        generator_func, response_buffer = await streamer.stream_response(
            context_data, 
            str(current_user.id),
            req.innovationId,
            req.companyId
        )

        async def final_generator():
            full_text_parts = []
            async for chunk in generator_func():
                full_text_parts.append(chunk)
                yield chunk
            
            # Upload full response to GCS after streaming
            full_text = "".join(full_text_parts)

            logger.info("🔄 Emerging technologies streaming completed, response length: %d", len(full_text))

            gcs_path, gcs_url = streamer._upload_to_gcs(
                full_text, 
                req.innovationId, 
                req.companyId
            )
            
            # Try to extract JSON from streaming response - target 'results' key
            logger.info("🔍 Starting JSON extraction from streaming response...")
            parsed_json = extract_json_from_response(full_text, target_key="results")
            
            if parsed_json:
                logger.info("✅ Streaming JSON extraction successful, keys: %s", list(parsed_json.keys()))
                
                # Extract and save results separately
                results_data = extract_results_from_response(full_text)
                if not results_data:
                    results_data = extract_results_from_json(parsed_json)
                
                if results_data:
                    results_gcs_path, results_gcs_url = streamer._save_results_to_gcs(
                        results_data,
                        req.innovationId,
                        req.companyId
                    )
                    yield f"\n📋 Results data saved to: {results_gcs_url}\n"
            else:
                logger.warning("❌ Streaming JSON extraction failed")
            
            yield f"\n\n[Emerging technologies analysis saved to GCS]({gcs_url})"

        return StreamingResponse(final_generator(), media_type="text/plain")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Streaming emerging technologies analysis failed: {str(e)}"
        )