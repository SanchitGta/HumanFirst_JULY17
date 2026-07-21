from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag
from app.schemas import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/api/tags", tags=["tags"])


def _get_tag_or_404(db: Session, tag_id: int) -> Tag:
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


def _name_conflicts(db: Session, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(Tag).filter(func.lower(Tag.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(Tag.id != exclude_id)
    return query.first() is not None


@router.get("", response_model=list[TagOut])
def get_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).order_by(Tag.created_at.asc()).all()
    return [TagOut(id=tag.id, name=tag.name) for tag in tags]


@router.post("", response_model=TagOut, status_code=201)
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    if _name_conflicts(db, payload.name):
        raise HTTPException(status_code=409, detail="Tag name already exists")
    tag = Tag(name=payload.name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name)


@router.patch("/{tag_id}", response_model=TagOut)
def update_tag(tag_id: int, payload: TagUpdate, db: Session = Depends(get_db)):
    tag = _get_tag_or_404(db, tag_id)
    if _name_conflicts(db, payload.name, exclude_id=tag_id):
        raise HTTPException(status_code=409, detail="Tag name already exists")
    tag.name = payload.name
    db.commit()
    db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = _get_tag_or_404(db, tag_id)
    db.delete(tag)
    db.commit()
    return Response(status_code=204)
