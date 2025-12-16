"""
Physical Contradiction Service with Vertex AI Integration.

This service provides AI-powered physical contradiction analysis using Vertex AI
and saves results to Google Cloud Storage. It requires completed problem standardization,
nine windows, and functional analysis as input.
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
if not logger.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

def extract_model_of_problem_from_json(full_json: dict) -> Union[dict, list]:
    """
    Extract only the model_of_problem portion from the full Physical Contradiction JSON response.
    
    Args:
        full_json: Complete Physical Contradiction JSON
        
    Returns:
        dict: Only the model_of_problem section
    """
    if isinstance(full_json, dict) and "model_of_problem" in full_json:
        return full_json["model_of_problem"]
    return {}

def extract_model_of_problem_from_response(text: str) -> Union[dict, list]:
    """
    Extract model_of_problem directly from AI response text.
    
    Args:
        text: The full response text from the AI agent
        
    Returns:
        dict: Only the model_of_problem section if found, empty dict otherwise
    """
    model_of_problem = get_json_value_by_key(text, "model_of_problem")
    return model_of_problem if model_of_problem else {}

from app.database.database import get_db
from app.auth.auth import get_current_user
from app.models.models import User, Innovation, Company, NineWindowsAnalysis, FunctionalAnalysis, ProblemStandardization, AnalysisStatus, PhysicalContradiction

load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
BUCKET_NAME = "triz_bucket"

class PhysicalContradictionRequest(BaseModel):
    companyId: str
    innovationId: str

class PhysicalContradictionResponse(BaseModel):
    message: str
    gcs_url: str
    json_response: Optional[Dict[str, Any]] = None
    json_gcs_url: Optional[str] = None
    model_of_problem_response: Optional[Dict[str, Any]] = None
    model_of_problem_gcs_url: Optional[str] = None
    sub_agents_url: Optional[str] = None
    last_agent_url: Optional[str] = None
    innovationId: str
    companyId: str

class PhysicalContradictionStreamer:
    def __init__(self):
        # Initialize Vertex AI using centralized client
        get_vertexai_client()
        
        # Original bucket logic restored
        self.project_id = PROJECT_ID
        self.location = LOCATION
        self.bucket_name = BUCKET_NAME
        self.resource_id = "2230258181873860608"  # Physical Contradiction Agent

    def initialize_vertex_ai(self):
        # VertexAI already initialized via centralized client
        pass

    async def create_session(self, user_id: str):
        service = VertexAiSessionService(self.project_id, self.location)
        # Generate unique user ID to prevent concurrent session conflicts
        unique_user_id = generate_session_user_id(user_id, prefix="physical_contradiction_user")
        session = await service.create_session(app_name=self.resource_id, user_id=unique_user_id)
        return service, session, unique_user_id

    def get_agent(self):
        return agent_engines.get(self.resource_id)

    def _upload_to_gcs(self, text: str, innovation_id: str, company_id: str, file_suffix: str = "") -> tuple[str, str]:
        analysis_type = f"physical_contradiction{file_suffix}" if file_suffix else "physical_contradiction"
        return gcs_service.upload_text_to_gcs(
            text=text,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type=analysis_type,
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )

    def _save_json_to_gcs(self, json_data: dict, innovation_id: str, company_id: str) -> tuple[str, str]:
        return gcs_service.save_json_to_gcs(
            json_data=json_data,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="physical_contradiction",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )
    
    def _save_model_of_problem_to_gcs(self, model_of_problem_data: dict, innovation_id: str, company_id: str) -> tuple[str, str]:
        """Save only the model_of_problem portion to GCS separately."""
        return gcs_service.save_json_to_gcs(
            json_data=model_of_problem_data,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="physical_contradiction_model",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )

    async def stream_response(self, context_data: dict, user_id: str, innovation_id: str, company_id: str):
        self.initialize_vertex_ai()
        service, session, unique_user_id = await self.create_session(f"user_{user_id}")
        agent = self.get_agent()
        queue = Queue()
        full_response = []
        all_parts = []

        # Convert context data to the expected format for the agent
        query = json.dumps(context_data, indent=2)

        async def generator():
            try:
                async for event in agent.async_stream_query(
                    user_id=unique_user_id,
                    session_id=session.id,
                    message=query
                ):
                    content = event.get("content", {})
                    parts = content.get("parts", [])
                    for part in parts:
                        text_part = part.get("text", "")
                        if text_part:
                            full_response.append(text_part)
                            yield text_part
                all_parts.extend(full_response)
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise
            finally:
                await service.delete_session(app_name=self.resource_id, user_id=unique_user_id, session_id=session.id)

        return generator, full_response, all_parts

def format_analyses_for_physical_contradiction(innovation: Innovation, company: Company, db: Session) -> dict:
    """
    Format problem standardization, nine windows, and functional analysis data for Physical Contradiction Agent.
    
    Args:
        innovation: Innovation database object
        company: Company database object
        db: Database session
        
    Returns:
        Combined analysis data formatted for Physical Contradiction agent
        
    Raises:
        HTTPException: If required analyses are not completed
    """
    
    # Check if problem standardization is completed
    problem_standardization = db.query(ProblemStandardization).filter(
        ProblemStandardization.innovation_id == innovation.id,
        ProblemStandardization.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not problem_standardization or not problem_standardization.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Problem standardization must be completed before generating Physical Contradiction analysis."
        )
    
    # Check if nine windows analysis is completed
    nine_windows_analysis = db.query(NineWindowsAnalysis).filter(
        NineWindowsAnalysis.innovation_id == innovation.id,
        NineWindowsAnalysis.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not nine_windows_analysis or not nine_windows_analysis.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Nine windows analysis must be completed before generating Physical Contradiction analysis."
        )
    
    # Check if functional analysis is completed
    functional_analysis = db.query(FunctionalAnalysis).filter(
        FunctionalAnalysis.innovation_id == innovation.id,
        FunctionalAnalysis.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not functional_analysis or not functional_analysis.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Functional analysis must be completed before generating Physical Contradiction analysis."
        )
    
    try:
        client = get_storage_client()
        
        # Download problem standardization data
        problem_gcs_path = problem_standardization.json_gcs_url.replace("gs://triz_bucket/", "")
        problem_blob = client.bucket("triz_bucket").blob(problem_gcs_path)
        problem_content = problem_blob.download_as_text()
        problem_data = json.loads(problem_content)
        
        # Download nine windows analysis data
        nine_windows_gcs_path = nine_windows_analysis.json_gcs_url.replace("gs://triz_bucket/", "")
        nine_windows_blob = client.bucket("triz_bucket").blob(nine_windows_gcs_path)
        nine_windows_content = nine_windows_blob.download_as_text()
        nine_windows_data = json.loads(nine_windows_content)
        
        # Download functional analysis data
        functional_gcs_path = functional_analysis.json_gcs_url.replace("gs://triz_bucket/", "")
        functional_blob = client.bucket("triz_bucket").blob(functional_gcs_path)
        functional_content = functional_blob.download_as_text()
        functional_data = json.loads(functional_content)
        
        # Format for Physical Contradiction analysis according to the test input structure
        formatted_data = {
            "Company_context": problem_data,  # Maps to problem standardization
            "ideality_improvement_analysis": functional_data,  # Maps to functional analysis
            "window_analysis": nine_windows_data  # Maps to nine windows analysis
        }
        
        return formatted_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analysis results: {str(e)}"
        )


# Import check_user_access_to_innovation from problem_standardisation
from app.services.problem_standardisation import check_user_access_to_innovation

streamer = PhysicalContradictionStreamer()

async def generate_physical_contradiction_analysis(
    req: PhysicalContradictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate Physical Contradiction analysis using Vertex AI.
    
    This function:
    1. Verifies user has access to the specified innovation
    2. Fetches completed problem standardization, nine windows, and functional analysis
    3. Formats the combined data for Physical Contradiction analysis
    4. Processes the data with Vertex AI (Physical Contradiction agent)
    5. Saves outputs (sub-agents and last-agent) separately to GCS
    6. Returns the processed output and GCS URLs
    
    Args:
        req: Request containing companyId and innovationId
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        PhysicalContradictionResponse: Analysis results with GCS URLs
        
    Raises:
        HTTPException: If user lacks access or required analyses not completed
    """
    logger.info("Starting Physical Contradiction analysis for innovation=%s company=%s", req.innovationId, req.companyId)
    
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
    
    # Get company information
    company = db.query(Company).filter(Company.id == req.companyId).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Clear existing analysis and start fresh
    existing_analysis = db.query(PhysicalContradiction).filter(
        PhysicalContradiction.innovation_id == innovation.id
    ).first()
    
    if existing_analysis:
        logger.info("Clearing existing Physical Contradiction analysis for innovation=%s", innovation.innovation_name)
        db.delete(existing_analysis)
        db.commit()
    
    # Create new analysis record
    analysis_record = PhysicalContradiction(
        innovation_id=innovation.id,
        status=AnalysisStatus.IN_PROGRESS
    )
    db.add(analysis_record)
    db.commit()
    
    try:
        # Format combined analysis data for Physical Contradiction
        context_data = format_analyses_for_physical_contradiction(innovation, company, db)
        
        # Generate Physical Contradiction analysis using the streamer
        generator, full_response_parts, all_parts = await streamer.stream_response(
            context_data=context_data,
            user_id=str(current_user.id),
            innovation_id=str(innovation.id),
            company_id=req.companyId
        )
        
        # Collect the full response
        full_response = ""
        async for chunk in generator():
            full_response += chunk
        
        if not full_response:
            analysis_record.status = AnalysisStatus.FAILED
            analysis_record.error = "No response received from Physical Contradiction analysis agent"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No response received from Physical Contradiction analysis agent"
            )
        
        # Save full response to GCS
        gcs_url, signed_url = streamer._upload_to_gcs(
            text=full_response,
            innovation_id=str(innovation.id),
            company_id=req.companyId
        )

        # Save sub-agents output (all except last) and last agent output separately
        sub_agents_url = None
        last_agent_url = None
        sub_agents_signed_url = None
        last_agent_signed_url = None
        
        if all_parts and len(all_parts) > 1:
            # Sub-agents output (all except last)
            sub_output = "".join(all_parts[:-1])
            if sub_output.strip():
                sub_agents_url, sub_agents_signed_url = streamer._upload_to_gcs(
                    text=sub_output,
                    innovation_id=str(innovation.id),
                    company_id=req.companyId,
                    file_suffix="_sub_agents"
                )
            
            # Last agent output (only last part)
            last_output = all_parts[-1]
            if last_output.strip():
                last_agent_url, last_agent_signed_url = streamer._upload_to_gcs(
                    text=last_output,
                    innovation_id=str(innovation.id),
                    company_id=req.companyId,
                    file_suffix="_last_agent"
                )
        
        # Extract and save JSON if available - always get the last JSON
        json_gcs_url = None
        model_of_problem_gcs_url = None
        json_response = None
        model_of_problem_response = None
        json_signed_url = None
        model_of_problem_signed_url = None
        
        # Extract JSON from final_json_string
        extracted_json = extract_json_from_response(full_response, target_key="model_of_problem")
        
        if extracted_json:
            # Save full JSON
            json_gcs_url, json_signed_url = streamer._save_json_to_gcs(
                json_data=extracted_json,
                innovation_id=str(innovation.id),
                company_id=req.companyId
            )
            json_response = extracted_json
            
           
            model_of_problem_gcs_url, model_of_problem_signed_url = streamer._save_model_of_problem_to_gcs(
                model_of_problem_data=extracted_json,
                innovation_id=str(innovation.id),
                company_id=req.companyId
            )
            model_of_problem_response = extracted_json
        
        # Update analysis record with results
        analysis_record.status = AnalysisStatus.COMPLETED
        analysis_record.gcs_url = gcs_url
        analysis_record.json_gcs_url = json_gcs_url
        analysis_record.model_of_problem_gcs_url = model_of_problem_gcs_url
        analysis_record.model_of_problem_response = model_of_problem_response
        analysis_record.sub_agents_gcs_url = sub_agents_url
        analysis_record.last_agent_gcs_url = last_agent_url
        analysis_record.last_agent_gcs_url = None
        db.commit()
        
        logger.info("Physical Contradiction analysis completed for innovation=%s", innovation.innovation_name)
        
        return PhysicalContradictionResponse(
            message="Physical Contradiction analysis completed successfully",
            gcs_url=signed_url,
            json_response=json_response,
            json_gcs_url=json_signed_url,
            model_of_problem_response=model_of_problem_response,
            model_of_problem_gcs_url=model_of_problem_signed_url,
            sub_agents_url=sub_agents_url,
            last_agent_url=last_agent_url,
            innovationId=req.innovationId,
            companyId=req.companyId
        )
        
    except HTTPException:
        # Update status to failed
        analysis_record.status = AnalysisStatus.FAILED
        analysis_record.error = "HTTP error occurred during analysis"
        db.commit()
        raise
    except Exception as e:
        logger.exception("Error in Physical Contradiction analysis: %s", e)
        
        # Update status to failed
        analysis_record.status = AnalysisStatus.FAILED
        analysis_record.error = str(e)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Physical Contradiction analysis failed: {str(e)}"
        )


async def generate_physical_contradiction_analysis_stream(
    req: PhysicalContradictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream Physical Contradiction analysis results in real-time.
    
    Args:
        req: Request containing companyId and innovationId
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        StreamingResponse: Real-time Physical Contradiction analysis results
        
    Raises:
        HTTPException: If user lacks access or required analyses not completed
    """
    logger.info("Starting Physical Contradiction analysis (streaming) for innovation=%s company=%s", req.innovationId, req.companyId)
    
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
    
    # Get company information
    company = db.query(Company).filter(Company.id == req.companyId).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Clear existing analysis and start fresh
    existing_analysis = db.query(PhysicalContradiction).filter(
        PhysicalContradiction.innovation_id == innovation.id
    ).first()
    
    if existing_analysis:
        logger.info("Clearing existing Physical Contradiction analysis for innovation=%s", innovation.innovation_name)
        db.delete(existing_analysis)
        db.commit()
    
    # Create new analysis record
    analysis_record = PhysicalContradiction(
        innovation_id=innovation.id,
        status=AnalysisStatus.IN_PROGRESS
    )
    db.add(analysis_record)
    db.commit()
    
    async def stream_physical_contradiction_analysis():
        try:
            # Format combined analysis data for Physical Contradiction
            context_data = format_analyses_for_physical_contradiction(innovation, company, db)
            
            # Generate Physical Contradiction analysis using the streamer
            generator, full_response_parts, all_parts = await streamer.stream_response(
                context_data=context_data,
                user_id=str(current_user.id),
                innovation_id=str(innovation.id),
                company_id=req.companyId
            )
            
            # Stream the response and collect full response
            full_response = ""
            async for chunk in generator():
                full_response += chunk
                yield chunk
            
            if full_response:
                # Save full response to GCS
                gcs_url, signed_url = streamer._upload_to_gcs(
                    text=full_response,
                    innovation_id=str(innovation.id),
                    company_id=req.companyId
                )
                
                # Save separate outputs
                sub_agents_url = None
                last_agent_url = None
                
                if all_parts and len(all_parts) > 1:
                    # Sub-agents output
                    sub_output = "".join(all_parts[:-1])
                    if sub_output.strip():
                        sub_agents_url, _ = streamer._upload_to_gcs(
                            text=sub_output,
                            innovation_id=str(innovation.id),
                            company_id=req.companyId,
                            file_suffix="_sub_agents"
                        )
                    
                    # Last agent output
                    last_output = all_parts[-1]
                    if last_output.strip():
                        last_agent_url, _ = streamer._upload_to_gcs(
                            text=last_output,
                            innovation_id=str(innovation.id),
                            company_id=req.companyId,
                            file_suffix="_last_agent"
                        )
                
                # Extract and save JSON if available - always get the last JSON
                json_gcs_url = None
                model_of_problem_gcs_url = None
                
                # First try to get JSON with model_of_problem key, then fallback to last JSON
                extracted_json = extract_json_from_response(full_response, target_key="model_of_problem")
                
                if extracted_json:
                    # Save full JSON
                    json_gcs_url, _ = streamer._save_json_to_gcs(
                        json_data=extracted_json,
                        innovation_id=str(innovation.id),
                        company_id=req.companyId
                    )
                    
                    # Extract and save model_of_problem separately
                    model_of_problem_data = extract_model_of_problem_from_response(full_response)
                    if not model_of_problem_data:
                        model_of_problem_data = extract_model_of_problem_from_json(extracted_json)
                    
                    if model_of_problem_data:
                        model_of_problem_gcs_url, model_of_problem_signed_url = streamer._save_model_of_problem_to_gcs(
                            model_of_problem_data=model_of_problem_data,
                            innovation_id=str(innovation.id),
                            company_id=req.companyId
                        )
                
                # Update analysis record with results
                analysis_record.status = AnalysisStatus.COMPLETED
                analysis_record.gcs_url = gcs_url
                analysis_record.json_gcs_url = json_gcs_url
                analysis_record.model_of_problem_gcs_url = model_of_problem_gcs_url
                analysis_record.model_of_problem_response = model_of_problem_response
                analysis_record.sub_agents_gcs_url = sub_agents_url
                analysis_record.last_agent_gcs_url = last_agent_url
                analysis_record.last_agent_gcs_url = None
                db.commit()
                
                yield f"\n\n📊 Physical Contradiction analysis completed and saved to GCS: {signed_url}\n"
                if json_gcs_url:
                    yield f"📄 JSON results saved\n"
                if model_of_problem_gcs_url:
                    yield f"🎩 Model of problem saved to: {model_of_problem_signed_url}\n"
            else:
                # Update status to failed
                analysis_record.status = AnalysisStatus.FAILED
                analysis_record.error = "No response received from agent"
                db.commit()
                yield "❌ Error: No response received from Physical Contradiction analysis agent\n"
                
        except Exception as e:
            logger.exception("Error in Physical Contradiction analysis streaming: %s", e)
            
            # Update status to failed
            analysis_record.status = AnalysisStatus.FAILED
            analysis_record.error = str(e)
            db.commit()
            
            yield f"❌ Error: {str(e)}\n"
    
    return StreamingResponse(stream_physical_contradiction_analysis(), media_type="text/plain")