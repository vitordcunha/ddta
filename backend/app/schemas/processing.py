from pydantic import BaseModel, Field


class ProcessRequest(BaseModel):
    preset: str = Field(default="standard")
    options: dict = Field(default_factory=dict)


class ProcessingStatus(BaseModel):
    project_id: str
    status: str
    progress: int
    assets: dict | None = None
    task_uuid: str | None = None
