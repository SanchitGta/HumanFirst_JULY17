from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


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


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: Literal["open", "done"] = "open"
    priority: Literal["none", "low", "medium", "high"] = "none"
    due_date: date | None = None
    list_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be empty")
        return stripped


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["open", "done"] | None = None
    priority: Literal["none", "low", "medium", "high"] | None = None
    due_date: date | None = None
    list_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be empty")
        return stripped


class TaskOut(BaseModel):
    id: int
    title: str
    description: str | None
    status: Literal["open", "done"]
    priority: Literal["none", "low", "medium", "high"]
    due_date: date | None
    list_id: int
    tags: list[TagOut]
    created_at: datetime
    updated_at: datetime
