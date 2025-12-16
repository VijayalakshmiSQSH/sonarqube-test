"""
Market Research Ideas Service with Vertex AI Integration.

This service provides AI-powered market research-based idea generation using Vertex AI.
It combines problem standardization data with deep research market research results
to generate targeted innovation ideas and market opportunities.
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
from app.utils.json_utils import extract_json_from_response, extract_json_with_key, get_json_value_by_key, is_ideas_empty

def extract_ideas_from_json(full_json: dict) -> Union[str, dict, list]:
    """
    Extract only the ideas portion from the full Market Research Ideas JSON response.
    
    Args:
        full_json: Complete Market Research Ideas JSON
        
    Returns:
        Union[str, dict, list]: The ideas section (can be string, dict, or list)
    """
    if isinstance(full_json, dict) and "ideas" in full_json:
        return full_json["ideas"]
    return {}

def extract_ideas_from_response(text: str) -> Union[str, dict, list]:
    """
    Extract ideas directly from AI response text.
    
    Args:
        text: The full response text from the AI agent
        
    Returns:
        Union[str, dict, list]: The ideas section if found, empty dict otherwise
    """
    ideas = get_json_value_by_key(text, "ideas")
    return ideas if ideas is not None else {}

from app.database.database import get_db, SessionLocal
from app.auth.auth import get_current_user
from app.models.models import User, Innovation, Company, ProblemStandardization, MarketResearch, AnalysisStatus, MarketResearchIdeas

load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
BUCKET_NAME = "triz_bucket"

class MarketResearchIdeasRequest(BaseModel):
    companyId: str
    innovationId: str

class MarketResearchIdeasResponse(BaseModel):
    message: str
    gcs_url: str
    json_response: Optional[Dict[str, Any]] = None
    json_gcs_url: Optional[str] = None
    ideas_response: Optional[Union[str, Dict[str, Any], List[Any]]] = None
    ideas_gcs_url: Optional[str] = None
    sub_agents_url: Optional[str] = None
    last_agent_url: Optional[str] = None
    innovationId: str
    companyId: str

class MarketResearchIdeasStreamer:
    def __init__(self):
        # Initialize Vertex AI using centralized client
        get_vertexai_client()
        
        # Original bucket logic restored
        self.project_id = PROJECT_ID
        self.location = LOCATION
        self.bucket_name = BUCKET_NAME
        self.resource_id = "6891496990341857280"  # Market Research Ideas Agent

    def initialize_vertex_ai(self):
        # VertexAI already initialized via centralized client
        pass

    async def create_session(self, user_id: str):
        service = VertexAiSessionService(self.project_id, self.location)
        # Generate unique user ID to prevent concurrent session conflicts
        unique_user_id = generate_session_user_id(user_id, prefix="market_research_ideas_user")
        session = await service.create_session(app_name=self.resource_id, user_id=unique_user_id)
        return service, session, unique_user_id

    def get_agent(self):
        return agent_engines.get(self.resource_id)

    def _upload_to_gcs(self, text: str, innovation_id: str, company_id: str, file_suffix: str = "") -> tuple[str, str]:
        analysis_type = f"market_research_ideas{file_suffix}" if file_suffix else "market_research_ideas"
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
            analysis_type="market_research_ideas",
            bucket_name=self.bucket_name,
            project_id=self.project_id
        )
    
    def _save_ideas_to_gcs(self, ideas_data: Union[str, dict, list], innovation_id: str, company_id: str) -> tuple[str, str]:
        """Save only the ideas portion to GCS separately."""
        # If it's a string, wrap it in a dict for consistent JSON structure
        if isinstance(ideas_data, str):
            ideas_data = {"ideas": ideas_data}
            
        return gcs_service.save_json_to_gcs(
            json_data=ideas_data,
            innovation_id=innovation_id,
            company_id=company_id,
            analysis_type="market_research_ideas_ideas",
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
                    if "content" in event and "parts" in event["content"]:
                        for part in event["content"]["parts"]:
                            if "text" in part:
                                text_part = part["text"]
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

def format_dual_input_for_market_research_ideas(innovation: Innovation, company: Company, db: Session) -> dict:
    """
    Format problem standardization data and deep research market research data for Market Research Ideas Agent.
    
    Args:
        innovation: Innovation database object
        company: Company database object
        db: Database session
        
    Returns:
        Combined data formatted for Market Research Ideas agent
        
    Raises:
        HTTPException: If required analyses are not completed
    """
    
    # Check if problem standardization analysis is completed
    problem_standardization = db.query(ProblemStandardization).filter(
        ProblemStandardization.innovation_id == innovation.id,
        ProblemStandardization.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not problem_standardization or not problem_standardization.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Problem standardization analysis must be completed before generating market research ideas."
        )
    
    # Check if deep research market research analysis is completed
    market_research = db.query(MarketResearch).filter(
        MarketResearch.innovation_id == innovation.id,
        MarketResearch.status == AnalysisStatus.COMPLETED
    ).first()
    
    if not market_research or not market_research.json_gcs_url:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Deep research market research analysis must be completed before generating market research ideas."
        )
    
    try:
        client = get_storage_client()
        
        # Download problem standardization data
        problem_gcs_path = problem_standardization.json_gcs_url.replace("gs://triz_bucket/", "")
        problem_blob = client.bucket("triz_bucket").blob(problem_gcs_path)
        problem_content = problem_blob.download_as_text()
        problem_data = json.loads(problem_content)
        
        # Download market research data
        market_gcs_path = market_research.json_gcs_url.replace("gs://triz_bucket/", "")
        market_blob = client.bucket("triz_bucket").blob(market_gcs_path)
        market_content = market_blob.download_as_text()
        market_data = json.loads(market_content)
        
        # Format for Market Research Ideas analysis
        # The agent expects combined problem context and market research insights
        formatted_data = {
            "problem_standardization": problem_data,
            "market_research_results": market_data.get("results", market_data),
            "innovation_context": {
                "innovation_name": innovation.innovation_name,
                "industry": innovation.industry,
                "business_unit": innovation.business_unit_name,
                "company_name": company.name
            }
        }
        
        return formatted_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch required analysis results: {str(e)}"
        )


# Import check_user_access_to_innovation from problem_standardisation
from app.services.problem_standardisation import check_user_access_to_innovation

streamer = MarketResearchIdeasStreamer()

def run_market_research_ideas_analysis_in_background(
    innovation_id: str,
    company_id: str,
    user_id: str,
    analysis_id: str
):
    """
    Background function to run market research ideas analysis.
    This runs in a separate thread to avoid blocking the main event loop.
    """
    background_db = SessionLocal()
    try:
        print(f"🔄 Starting background market research ideas analysis for innovation {innovation_id}")
        
        # Get the analysis record
        analysis = background_db.query(MarketResearchIdeas).filter(MarketResearchIdeas.id == analysis_id).first()
        if not analysis:
            print(f"❌ Analysis record not found: {analysis_id}")
            return
        
        # Get innovation and company
        innovation = background_db.query(Innovation).filter(Innovation.id == innovation_id).first()
        if not innovation:
            analysis.status = AnalysisStatus.FAILED
            analysis.error = "Innovation not found"
            background_db.commit()
            return
        
        company = background_db.query(Company).filter(Company.id == company_id).first()
        if not company:
            analysis.status = AnalysisStatus.FAILED
            analysis.error = "Company not found"
            background_db.commit()
            return
        
        # Format combined data for Market Research Ideas
        context_data = format_dual_input_for_market_research_ideas(innovation, company, background_db)
        
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Generate Market Research Ideas analysis using the streamer
            generator, full_response_parts, all_parts = loop.run_until_complete(
                streamer.stream_response(
                    context_data=context_data,
                    user_id=user_id,
                    innovation_id=innovation_id,
                    company_id=company_id
                )
            )
            
            # Collect the full response
            full_response = ""
            async def collect_response():
                nonlocal full_response
                async for chunk in generator():
                    full_response += chunk
            
            loop.run_until_complete(collect_response())
            
            if not full_response:
                analysis.status = AnalysisStatus.FAILED
                analysis.error = "No response received from Market Research Ideas analysis agent"
                background_db.commit()
                return
            
            # Save full response to GCS
            gcs_url, signed_url = streamer._upload_to_gcs(
                text=full_response,
                innovation_id=innovation_id,
                company_id=company_id
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
                        innovation_id=innovation_id,
                        company_id=company_id,
                        file_suffix="_sub_agents"
                    )
                
                # Last agent output (only last part)
                last_output = all_parts[-1]
                if last_output.strip():
                    last_agent_url, last_agent_signed_url = streamer._upload_to_gcs(
                        text=last_output,
                        innovation_id=innovation_id,
                        company_id=company_id,
                        file_suffix="_last_agent"
                    )
            
            # Extract and save JSON if available - always get the last JSON
            json_gcs_url = None
            ideas_gcs_url = None
            
            # Extract JSON from full_response
            extracted_json = extract_json_from_response(full_response, target_key="ideas")
            
            if extracted_json:
                # Ensure extracted_json is a dict for saving
                json_data_for_save = extracted_json if isinstance(extracted_json, dict) else {"ideas": extracted_json}
                
                # Save full JSON
                json_gcs_url, _ = streamer._save_json_to_gcs(
                    json_data=json_data_for_save,
                    innovation_id=innovation_id,
                    company_id=company_id
                )
                
                # Extract and save ideas separately
                ideas_data = extract_ideas_from_response(full_response)
                if not ideas_data:
                    ideas_data = extract_ideas_from_json(extracted_json)
                
                if ideas_data:
                    ideas_gcs_url, _ = streamer._save_ideas_to_gcs(
                        ideas_data=ideas_data,
                        innovation_id=innovation_id,
                        company_id=company_id
                    )
            
            # Update analysis record with results
            analysis.status = AnalysisStatus.COMPLETED
            analysis.gcs_url = gcs_url
            analysis.json_gcs_url = json_gcs_url
            analysis.ideas_gcs_url = ideas_gcs_url
            analysis.sub_agents_gcs_url = sub_agents_url
            analysis.last_agent_gcs_url = last_agent_url
            analysis.error = None
            
            background_db.commit()
            
            print(f"✅ Market Research Ideas analysis completed for innovation {innovation_id}")
            
        except Exception as vertex_error:
            print(f"❌ Error in vertex AI processing: {vertex_error}")
            analysis.status = AnalysisStatus.FAILED
            analysis.error = f"Vertex AI error: {str(vertex_error)}"
            background_db.commit()
        finally:
            loop.close()
            
    except Exception as e:
        print(f"❌ Error in background market research ideas analysis: {e}")
        
        # Update analysis status to failed
        try:
            analysis = background_db.query(MarketResearchIdeas).filter(MarketResearchIdeas.id == analysis_id).first()
            if analysis:
                analysis.status = AnalysisStatus.FAILED
                analysis.error = str(e)
                background_db.commit()
        except Exception as update_error:
            print(f"❌ Error updating failed status: {update_error}")
    finally:
        background_db.close()


async def generate_market_research_ideas_analysis(
    req: MarketResearchIdeasRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate Market Research Ideas analysis using Vertex AI.
    
    This function:
    1. Verifies user has access to the specified innovation
    2. Fetches completed problem standardization and deep research market research analyses
    3. Formats the combined data for Market Research Ideas analysis
    4. Processes the data with Vertex AI (Market Research Ideas agent)
    5. Saves outputs (sub-agents and last-agent) separately to GCS
    6. Returns the processed output and GCS URLs
    
    Args:
        req: Request containing companyId and innovationId
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        MarketResearchIdeasResponse: Analysis results with GCS URLs
        
    Raises:
        HTTPException: If user lacks access or required analyses not completed
    """
    print("🚀 Starting Market Research Ideas analysis")
    
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
    existing_analysis = db.query(MarketResearchIdeas).filter(
        MarketResearchIdeas.innovation_id == innovation.id
    ).first()
    
    if existing_analysis:
        print(f"🗑️ Clearing existing Market Research Ideas analysis for innovation {innovation.innovation_name}")
        db.delete(existing_analysis)
        db.commit()
    
    # Create new analysis record
    analysis_record = MarketResearchIdeas(
        innovation_id=innovation.id,
        status=AnalysisStatus.IN_PROGRESS
    )
    db.add(analysis_record)
    db.commit()
    
    try:
        # Format combined data for Market Research Ideas
        context_data = format_dual_input_for_market_research_ideas(innovation, company, db)
        
        # Retry loop for empty ideas detection
        max_retries = 3
        full_response = ""
        gcs_url = None
        signed_url = None
        sub_agents_url = None
        last_agent_url = None
        sub_agents_signed_url = None
        last_agent_signed_url = None
        json_gcs_url = None
        ideas_gcs_url = None
        json_response = None
        ideas_response = None
        json_signed_url = None
        ideas_signed_url = None
        all_parts = []
        
        for attempt in range(max_retries):
            if attempt > 0:
                print(f"🔄 Retry attempt {attempt}/{max_retries - 1} for market research ideas analysis (no ideas found in previous attempt)")
                await asyncio.sleep(2)  # Brief delay before retry
            
            # Generate Market Research Ideas analysis using the streamer
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
                if attempt < max_retries - 1:
                    print(f"⚠️ No response received, retrying... (attempt {attempt + 1}/{max_retries})")
                    continue
                analysis_record.status = AnalysisStatus.FAILED
                analysis_record.error = "No response received from Market Research Ideas analysis agent"
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No response received from Market Research Ideas analysis agent"
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
            
            # Extract and save JSON if available
            json_gcs_url = None
            ideas_gcs_url = None
            json_response = None
            ideas_response = None
            json_signed_url = None
            ideas_signed_url = None
            
            # Extract JSON from full_response
            extracted_json = extract_json_from_response(full_response, target_key="ideas")
            
            if extracted_json:
                # Ensure extracted_json is a dict for saving
                json_data_for_save = extracted_json if isinstance(extracted_json, dict) else {"ideas": extracted_json}
                
                # Save full JSON
                json_gcs_url, json_signed_url = streamer._save_json_to_gcs(
                    json_data=json_data_for_save,
                    innovation_id=str(innovation.id),
                    company_id=req.companyId
                )
                json_response = json_data_for_save
                
                # Extract and save ideas separately
                ideas_data = extract_ideas_from_response(full_response)
                if not ideas_data:
                    ideas_data = extract_ideas_from_json(extracted_json)
                
                # Check if ideas are empty (matching UI parsing logic)
                if is_ideas_empty(ideas_data):
                    if attempt < max_retries - 1:
                        print(f"⚠️ No ideas found in response (matching UI parsing logic), retrying... (attempt {attempt + 1}/{max_retries})")
                        continue
                    else:
                        print(f"⚠️ No ideas found after {max_retries} attempts, proceeding with empty ideas")
                
                if ideas_data:
                    ideas_gcs_url, ideas_signed_url = streamer._save_ideas_to_gcs(
                        ideas_data=ideas_data,
                        innovation_id=str(innovation.id),
                        company_id=req.companyId
                    )
                    ideas_response = ideas_data
            else:
                # No JSON extracted - retry if attempts remaining
                if attempt < max_retries - 1:
                    print(f"⚠️ No JSON extracted from response, retrying... (attempt {attempt + 1}/{max_retries})")
                    continue
            
            # If we got here and have ideas (or exhausted retries), break the retry loop
            if not is_ideas_empty(ideas_response) or attempt == max_retries - 1:
                break
        
        # Update analysis record with results
        analysis_record.status = AnalysisStatus.COMPLETED
        analysis_record.gcs_url = gcs_url
        analysis_record.json_gcs_url = json_gcs_url
        analysis_record.sub_agents_gcs_url = sub_agents_url
        analysis_record.last_agent_gcs_url = last_agent_url
        analysis_record.ideas_gcs_url = ideas_gcs_url
        db.commit()
        
        print(f"✅ Market Research Ideas analysis completed for innovation {innovation.innovation_name}")
        
        return MarketResearchIdeasResponse(
            message="Market Research Ideas analysis completed successfully",
            gcs_url=signed_url,
            json_response=json_response,
            json_gcs_url=json_signed_url,
            ideas_response=ideas_response,
            ideas_gcs_url=ideas_signed_url,
            sub_agents_url=sub_agents_signed_url,
            last_agent_url=last_agent_signed_url,
            innovationId=req.innovationId,
            companyId=req.companyId
        )
        
    except HTTPException:
        # Update status to failed
        analysis_record.status = AnalysisStatus.FAILED
        analysis_record.error = "HTTP error occurred during analysis setup"
        db.commit()
        raise
    except Exception as e:
        print(f"❌ Error in Market Research Ideas analysis: {e}")
        
        # Update status to failed
        analysis_record.status = AnalysisStatus.FAILED
        analysis_record.error = str(e)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Market Research Ideas analysis failed: {str(e)}"
        )


async def generate_market_research_ideas_analysis_stream(
    req: MarketResearchIdeasRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream Market Research Ideas analysis results in real-time.
    
    Args:
        req: Request containing companyId and innovationId
        current_user: Authenticated user from JWT token
        db: Database session
        
    Returns:
        StreamingResponse: Real-time Market Research Ideas analysis results
        
    Raises:
        HTTPException: If user lacks access or required analyses not completed
    """
    print("🚀 Starting Market Research Ideas analysis (streaming)")
    
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
    existing_analysis = db.query(MarketResearchIdeas).filter(
        MarketResearchIdeas.innovation_id == innovation.id
    ).first()
    
    if existing_analysis:
        print(f"🗑️ Clearing existing Market Research Ideas analysis for innovation {innovation.innovation_name}")
        db.delete(existing_analysis)
        db.commit()
    
    # Create new analysis record
    analysis_record = MarketResearchIdeas(
        innovation_id=innovation.id,
        status=AnalysisStatus.IN_PROGRESS
    )
    db.add(analysis_record)
    db.commit()
    
    async def stream_market_research_ideas_analysis():
        try:
            # Format combined data for Market Research Ideas
            context_data = format_dual_input_for_market_research_ideas(innovation, company, db)
            
            # Generate Market Research Ideas analysis using the streamer
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
                ideas_gcs_url = None
                ideas_signed_url = None
                
                # First try to get JSON with ideas key, then fallback to last JSON
                extracted_json = extract_json_from_response(full_response, target_key="ideas")
                
                if extracted_json:
                    # Ensure extracted_json is a dict for saving
                    json_data_for_save = extracted_json if isinstance(extracted_json, dict) else {"ideas": extracted_json}
                    
                    # Save full JSON
                    json_gcs_url, _ = streamer._save_json_to_gcs(
                        json_data=json_data_for_save,
                        innovation_id=str(innovation.id),
                        company_id=req.companyId
                    )
                    
                    # Extract and save ideas separately
                    ideas_data = extract_ideas_from_response(full_response)
                    if not ideas_data:
                        ideas_data = extract_ideas_from_json(extracted_json)
                    
                    if ideas_data:
                        ideas_gcs_url, ideas_signed_url = streamer._save_ideas_to_gcs(
                            ideas_data=ideas_data,
                            innovation_id=str(innovation.id),
                            company_id=req.companyId
                        )
                
                # Update analysis record with results
                analysis_record.status = AnalysisStatus.COMPLETED
                analysis_record.gcs_url = gcs_url
                analysis_record.json_gcs_url = json_gcs_url
                analysis_record.sub_agents_gcs_url = sub_agents_url
                analysis_record.last_agent_gcs_url = last_agent_url
                analysis_record.ideas_gcs_url = ideas_gcs_url
                db.commit()
                
                yield f"\n\n📊 Market Research Ideas analysis completed and saved to GCS: {signed_url}\n"
                if json_gcs_url:
                    yield f"📄 JSON results saved\n"
                if ideas_gcs_url:
                    yield f"💡 Ideas data saved to: {ideas_signed_url}\n"
                if sub_agents_url:
                    yield f"📝 Sub-agents output saved\n"
                if last_agent_url:
                    yield f"📋 Last agent output saved\n"
            else:
                # Update status to failed
                analysis_record.status = AnalysisStatus.FAILED
                analysis_record.error = "No response received from agent"
                db.commit()
                yield "❌ Error: No response received from Market Research Ideas analysis agent\n"
                
        except Exception as e:
            print(f"❌ Error in Market Research Ideas analysis streaming: {e}")
            
            # Update status to failed
            analysis_record.status = AnalysisStatus.FAILED
            analysis_record.error = str(e)
            db.commit()
            
            yield f"❌ Error: {str(e)}\n"
    
    return StreamingResponse(stream_market_research_ideas_analysis(), media_type="text/plain")