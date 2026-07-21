from datetime import datetime

from pydantic import BaseModel, field_validator


class ListCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be empty")
        return stripped


class ListUpdate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be empty")
        return stripped


class ListCreateOut(BaseModel):
    id: int
    name: str
    created_at: datetime


class ListOut(BaseModel):
    id: int
    name: str
    task_count: int
    created_at: datetime
