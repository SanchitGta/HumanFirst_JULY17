from sqlalchemy.orm import Session

from app.models import List


def seed_inbox(db: Session) -> None:
    existing = db.query(List).filter(List.is_protected.is_(True)).first()
    if existing is not None:
        return
    inbox = List(name="Inbox", is_protected=True)
    db.add(inbox)
    db.commit()
