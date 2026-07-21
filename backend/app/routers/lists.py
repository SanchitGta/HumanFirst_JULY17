from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import List, Task
from app.schemas import ListCreate, ListCreateOut, ListOut, ListUpdate

router = APIRouter(prefix="/api/lists", tags=["lists"])


def _list_with_counts_query(db: Session):
    return db.query(List, func.count(Task.id).label("task_count")).outerjoin(
        Task, Task.list_id == List.id
    ).group_by(List.id)


def _get_list_or_404(db: Session, list_id: int) -> List:
    list_ = db.query(List).filter(List.id == list_id).first()
    if list_ is None:
        raise HTTPException(status_code=404, detail="List not found")
    return list_


@router.get("", response_model=list[ListOut])
def get_lists(db: Session = Depends(get_db)):
    rows = _list_with_counts_query(db).order_by(List.created_at.asc()).all()
    return [
        ListOut(id=list_.id, name=list_.name, task_count=count, created_at=list_.created_at)
        for list_, count in rows
    ]


@router.post("", response_model=ListCreateOut, status_code=201)
def create_list(payload: ListCreate, db: Session = Depends(get_db)):
    list_ = List(name=payload.name, is_protected=False)
    db.add(list_)
    db.commit()
    db.refresh(list_)
    return ListCreateOut(id=list_.id, name=list_.name, created_at=list_.created_at)


@router.patch("/{list_id}", response_model=ListOut)
def update_list(list_id: int, payload: ListUpdate, db: Session = Depends(get_db)):
    list_ = _get_list_or_404(db, list_id)
    list_.name = payload.name
    db.commit()
    db.refresh(list_)
    row = _list_with_counts_query(db).filter(List.id == list_id).first()
    list_, count = row
    return ListOut(id=list_.id, name=list_.name, task_count=count, created_at=list_.created_at)


@router.delete("/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    list_ = _get_list_or_404(db, list_id)
    if list_.is_protected:
        raise HTTPException(status_code=403, detail="Cannot delete the Inbox list")
    inbox = db.query(List).filter(List.is_protected.is_(True)).one()
    db.query(Task).filter(Task.list_id == list_id).update({Task.list_id: inbox.id})
    db.delete(list_)
    db.commit()
    return Response(status_code=204)
