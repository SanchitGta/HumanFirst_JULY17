from app.models import List, Task


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_fresh_app_has_only_inbox(client):
    response = client.get("/api/lists")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["name"] == "Inbox"
    assert body[0]["task_count"] == 0


def test_create_list(client):
    response = client.post("/api/lists", json={"name": "Groceries"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Groceries"
    assert "id" in body
    assert "created_at" in body
    assert "task_count" not in body


def test_duplicate_list_names_allowed(client):
    first = client.post("/api/lists", json={"name": "Chores"})
    second = client.post("/api/lists", json={"name": "Chores"})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


def test_create_list_blank_name_rejected(client):
    response = client.post("/api/lists", json={"name": "   "})
    assert response.status_code == 422


def test_patch_non_inbox_list(client):
    created = client.post("/api/lists", json={"name": "Old Name"}).json()
    response = client.patch(f"/api/lists/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New Name"
    assert body["task_count"] == 0


def test_patch_inbox_list_allowed(client):
    inbox = client.get("/api/lists").json()[0]
    response = client.patch(f"/api/lists/{inbox['id']}", json={"name": "My Inbox"})
    assert response.status_code == 200
    assert response.json()["name"] == "My Inbox"


def test_patch_nonexistent_list(client):
    response = client.patch("/api/lists/9999", json={"name": "Nope"})
    assert response.status_code == 404


def test_delete_inbox_forbidden(client):
    inbox = client.get("/api/lists").json()[0]
    response = client.delete(f"/api/lists/{inbox['id']}")
    assert response.status_code == 403

    lists_after = client.get("/api/lists").json()
    assert any(l["id"] == inbox["id"] for l in lists_after)


def test_delete_nonexistent_list(client):
    response = client.delete("/api/lists/9999")
    assert response.status_code == 404


def test_delete_list_moves_tasks_to_inbox(client, db_session):
    inbox = db_session.query(List).filter(List.is_protected.is_(True)).one()
    created = client.post("/api/lists", json={"name": "Work"}).json()
    other_list_id = created["id"]

    task = Task(title="Do the thing", list_id=other_list_id)
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    response = client.delete(f"/api/lists/{other_list_id}")
    assert response.status_code == 204

    db_session.refresh(task)
    assert task.list_id == inbox.id

    remaining_lists = client.get("/api/lists").json()
    assert all(l["id"] != other_list_id for l in remaining_lists)


def test_task_count_reflects_inserted_tasks(client, db_session):
    created = client.post("/api/lists", json={"name": "Errands"}).json()
    list_id = created["id"]

    db_session.add(Task(title="One", list_id=list_id))
    db_session.add(Task(title="Two", list_id=list_id))
    db_session.commit()

    lists = client.get("/api/lists").json()
    target = next(l for l in lists if l["id"] == list_id)
    assert target["task_count"] == 2
