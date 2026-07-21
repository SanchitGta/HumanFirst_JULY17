from app.models import task_tags


def _inbox_id(client):
    return client.get("/api/lists").json()[0]["id"]


def _create_task(client, title):
    return client.post("/api/tasks", json={"title": title}).json()


def _create_tag(client, name):
    return client.post("/api/tags", json={"name": name}).json()


# --- CRUD: GET ---


def test_get_tags_empty(client):
    response = client.get("/api/tags")
    assert response.status_code == 200
    assert response.json() == []


def test_get_tags_returns_all_in_creation_order(client):
    first = _create_tag(client, "alpha")
    second = _create_tag(client, "beta")
    third = _create_tag(client, "gamma")

    body = client.get("/api/tags").json()
    assert [t["id"] for t in body] == [first["id"], second["id"], third["id"]]
    assert [t["name"] for t in body] == ["alpha", "beta", "gamma"]


# --- CRUD: POST ---


def test_create_tag(client):
    response = client.post("/api/tags", json={"name": "urgent"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "urgent"
    assert "id" in body


def test_create_tag_duplicate_exact_name_409(client):
    _create_tag(client, "urgent")
    response = client.post("/api/tags", json={"name": "urgent"})
    assert response.status_code == 409


def test_create_tag_duplicate_case_insensitive_409(client):
    _create_tag(client, "Urgent")
    response = client.post("/api/tags", json={"name": "URGENT"})
    assert response.status_code == 409


def test_create_tag_wildcard_characters_do_not_false_positive(client):
    _create_tag(client, "50X")
    response = client.post("/api/tags", json={"name": "50%"})
    assert response.status_code == 201


def test_create_tag_blank_name_422(client):
    response = client.post("/api/tags", json={"name": "   "})
    assert response.status_code == 422


# --- CRUD: PATCH ---


def test_patch_tag_rename_to_free_name(client):
    tag = _create_tag(client, "old-name")
    response = client.patch(f"/api/tags/{tag['id']}", json={"name": "new-name"})
    assert response.status_code == 200
    assert response.json()["name"] == "new-name"


def test_patch_tag_rename_conflicts_with_different_tag_409(client):
    _create_tag(client, "taken")
    other = _create_tag(client, "free")
    response = client.patch(f"/api/tags/{other['id']}", json={"name": "TAKEN"})
    assert response.status_code == 409


def test_patch_tag_rename_to_own_current_name_recased_200(client):
    tag = _create_tag(client, "Urgent")
    response = client.patch(f"/api/tags/{tag['id']}", json={"name": "urgent"})
    assert response.status_code == 200
    assert response.json()["name"] == "urgent"


def test_patch_tag_nonexistent_404(client):
    response = client.patch("/api/tags/9999", json={"name": "whatever"})
    assert response.status_code == 404


# --- CRUD: DELETE ---


def test_delete_tag_removes_associations_but_not_tasks(client):
    task = _create_task(client, "Tagged task")
    tag = _create_tag(client, "temp")
    assign = client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert assign.status_code == 201

    response = client.delete(f"/api/tags/{tag['id']}")
    assert response.status_code == 204

    task_after = client.get(f"/api/tasks/{task['id']}")
    assert task_after.status_code == 200
    assert task_after.json()["tags"] == []

    remaining_tags = client.get("/api/tags").json()
    assert tag["id"] not in [t["id"] for t in remaining_tags]


def test_delete_tag_removes_task_tags_rows(client, db_session):
    task = _create_task(client, "Tagged task")
    tag = _create_tag(client, "temp")
    client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")

    response = client.delete(f"/api/tags/{tag['id']}")
    assert response.status_code == 204

    remaining_links = db_session.execute(
        task_tags.select().where(task_tags.c.tag_id == tag["id"])
    ).fetchall()
    assert remaining_links == []


def test_delete_tag_nonexistent_404(client):
    response = client.delete("/api/tags/9999")
    assert response.status_code == 404


# --- Task-tag assignment: GET ---


def test_get_task_tags_with_assigned_tags(client):
    task = _create_task(client, "Task")
    tag_a = _create_tag(client, "a")
    tag_b = _create_tag(client, "b")
    client.post(f"/api/tasks/{task['id']}/tags/{tag_a['id']}")
    client.post(f"/api/tasks/{task['id']}/tags/{tag_b['id']}")

    response = client.get(f"/api/tasks/{task['id']}/tags")
    assert response.status_code == 200
    names = {t["name"] for t in response.json()}
    assert names == {"a", "b"}


def test_get_task_tags_empty(client):
    task = _create_task(client, "Task")
    response = client.get(f"/api/tasks/{task['id']}/tags")
    assert response.status_code == 200
    assert response.json() == []


def test_get_task_tags_nonexistent_task_404(client):
    response = client.get("/api/tasks/9999/tags")
    assert response.status_code == 404


# --- Task-tag assignment: POST ---


def test_assign_tag_first_time_201(client):
    task = _create_task(client, "Task")
    tag = _create_tag(client, "urgent")

    response = client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert response.status_code == 201
    assert response.json() == {"id": tag["id"], "name": "urgent"}

    task_after = client.get(f"/api/tasks/{task['id']}").json()
    assert task_after["tags"] == [{"id": tag["id"], "name": "urgent"}]


def test_assign_tag_repeated_is_idempotent_200(client, db_session):
    task = _create_task(client, "Task")
    tag = _create_tag(client, "urgent")

    first = client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert first.status_code == 201

    second = client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert second.status_code == 200

    rows = db_session.execute(
        task_tags.select().where(
            task_tags.c.task_id == task["id"], task_tags.c.tag_id == tag["id"]
        )
    ).fetchall()
    assert len(rows) == 1


def test_assign_tag_nonexistent_task_404(client):
    tag = _create_tag(client, "urgent")
    response = client.post(f"/api/tasks/9999/tags/{tag['id']}")
    assert response.status_code == 404


def test_assign_tag_nonexistent_tag_404(client):
    task = _create_task(client, "Task")
    response = client.post(f"/api/tasks/{task['id']}/tags/9999")
    assert response.status_code == 404


# --- Task-tag assignment: DELETE ---


def test_unassign_tag_removes_association(client):
    task = _create_task(client, "Task")
    tag = _create_tag(client, "urgent")
    client.post(f"/api/tasks/{task['id']}/tags/{tag['id']}")

    response = client.delete(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert response.status_code == 204

    task_after = client.get(f"/api/tasks/{task['id']}")
    assert task_after.status_code == 200
    assert task_after.json()["tags"] == []


def test_unassign_tag_never_assigned_is_idempotent_204(client):
    task = _create_task(client, "Task")
    tag = _create_tag(client, "urgent")

    response = client.delete(f"/api/tasks/{task['id']}/tags/{tag['id']}")
    assert response.status_code == 204


def test_unassign_tag_nonexistent_task_404(client):
    tag = _create_tag(client, "urgent")
    response = client.delete(f"/api/tasks/9999/tags/{tag['id']}")
    assert response.status_code == 404


def test_unassign_tag_nonexistent_tag_404(client):
    task = _create_task(client, "Task")
    response = client.delete(f"/api/tasks/{task['id']}/tags/9999")
    assert response.status_code == 404
