from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import case, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import List, Task, task_tags
from app.schemas import TagOut, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _get_list_or_404(db: Session, list_id: int) -> List:
    list_ = db.query(List).filter(List.id == list_id).first()
    if list_ is None:
        raise HTTPException(status_code=404, detail="List not found")
    return list_


def _resolve_list_id(db: Session, list_id: int | None) -> int:
    if list_id is not None:
        _get_list_or_404(db, list_id)
        return list_id
    inbox = db.query(List).filter(List.is_protected.is_(True)).one()
    return inbox.id


def _status_to_completed(status: str) -> bool:
    return status == "done"


def _completed_to_status(completed: bool) -> str:
    return "done" if completed else "open"


def _to_task_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        status=_completed_to_status(task.completed),
        priority=task.priority,
        due_date=task.due_date,
        list_id=task.list_id,
        tags=[TagOut(id=tag.id, name=tag.name) for tag in task.tags],
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _apply_task_filters(query, list_id, status, priority, tag_id, search):
    if list_id is not None:
        query = query.filter(Task.list_id == list_id)
    if status is not None:
        query = query.filter(Task.completed == _status_to_completed(status))
    if priority is not None:
        query = query.filter(Task.priority == priority)
    if tag_id is not None:
        query = query.join(task_tags, Task.id == task_tags.c.task_id).filter(
            task_tags.c.tag_id == tag_id
        )
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Task.title.ilike(term), Task.description.ilike(term)))
    return query


def _apply_task_sort(query, sort, order):
    if sort == "due_date":
        null_last = case((Task.due_date.is_(None), 1), else_=0)
        direction = Task.due_date.asc() if order == "asc" else Task.due_date.desc()
        return query.order_by(null_last.asc(), direction)
    if sort == "priority":
        rank = case(
            (Task.priority == "none", 0),
            (Task.priority == "low", 1),
            (Task.priority == "medium", 2),
            (Task.priority == "high", 3),
            else_=4,
        )
        return query.order_by(rank.asc() if order == "asc" else rank.desc())
    if sort == "created_at":
        return query.order_by(
            Task.created_at.asc() if order == "asc" else Task.created_at.desc()
        )
    return query.order_by(Task.title.asc() if order == "asc" else Task.title.desc())


@router.get("", response_model=list[TaskOut])
def get_tasks(
    list_id: int | None = None,
    status: Literal["open", "done"] | None = None,
    priority: Literal["none", "low", "medium", "high"] | None = None,
    tag_id: int | None = None,
    search: str | None = None,
    sort: Literal["due_date", "priority", "created_at", "title"] = "due_date",
    order: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
):
    query = db.query(Task).options(selectinload(Task.tags))
    query = _apply_task_filters(query, list_id, status, priority, tag_id, search)
    query = _apply_task_sort(query, sort, order)
    tasks = query.all()
    return [_to_task_out(task) for task in tasks]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    list_id = _resolve_list_id(db, payload.list_id)
    task = Task(
        title=payload.title,
        description=payload.description,
        list_id=list_id,
        priority=payload.priority,
        due_date=payload.due_date,
        completed=_status_to_completed(payload.status),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _to_task_out(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    return _to_task_out(task)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    updates = payload.model_dump(exclude_unset=True)
    if "list_id" in updates:
        list_id = updates.pop("list_id")
        _get_list_or_404(db, list_id)
        task.list_id = list_id
    if "status" in updates:
        task.completed = _status_to_completed(updates.pop("status"))
    for key, value in updates.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return _to_task_out(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id)
    db.delete(task)
    db.commit()
    return Response(status_code=204)
