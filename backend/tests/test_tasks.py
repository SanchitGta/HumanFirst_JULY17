from app.models import Tag, Task, task_tags


def _create_list(client, name):
    return client.post("/api/lists", json={"name": name}).json()


def _inbox_id(client):
    return client.get("/api/lists").json()[0]["id"]


# --- CREATE ---


def test_create_task_minimal_defaults(client):
    response = client.post("/api/tasks", json={"title": "Buy milk"})
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Buy milk"
    assert body["status"] == "open"
    assert body["priority"] == "none"
    assert body["due_date"] is None
    assert body["list_id"] == _inbox_id(client)
    assert body["tags"] == []


def test_create_task_explicit_fields(client):
    list_ = _create_list(client, "Work")
    response = client.post(
        "/api/tasks",
        json={
            "title": "Ship report",
            "description": "Quarterly report",
            "status": "done",
            "priority": "high",
            "due_date": "2026-08-01",
            "list_id": list_["id"],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Ship report"
    assert body["description"] == "Quarterly report"
    assert body["status"] == "done"
    assert body["priority"] == "high"
    assert body["due_date"] == "2026-08-01"
    assert body["list_id"] == list_["id"]


def test_create_task_nonexistent_list_404(client):
    response = client.post("/api/tasks", json={"title": "Orphan", "list_id": 9999})
    assert response.status_code == 404


def test_create_task_blank_title_422(client):
    response = client.post("/api/tasks", json={"title": "   "})
    assert response.status_code == 422


# --- READ (single) ---


def test_get_task_with_tags(client, db_session):
    task = Task(title="Tagged task", list_id=_inbox_id(client))
    tag_a = Tag(name="urgent")
    tag_b = Tag(name="home")
    db_session.add_all([task, tag_a, tag_b])
    db_session.commit()
    db_session.execute(
        task_tags.insert().values(
            [{"task_id": task.id, "tag_id": tag_a.id}, {"task_id": task.id, "tag_id": tag_b.id}]
        )
    )
    db_session.commit()

    response = client.get(f"/api/tasks/{task.id}")
    assert response.status_code == 200
    body = response.json()
    tag_names = {tag["name"] for tag in body["tags"]}
    assert tag_names == {"urgent", "home"}


def test_get_task_nonexistent_404(client):
    response = client.get("/api/tasks/9999")
    assert response.status_code == 404


# --- UPDATE ---


def test_patch_task_updates_all_fields(client):
    created = client.post("/api/tasks", json={"title": "Original"}).json()
    response = client.patch(
        f"/api/tasks/{created['id']}",
        json={
            "title": "Updated",
            "description": "New description",
            "priority": "medium",
            "due_date": "2026-09-01",
            "status": "done",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Updated"
    assert body["description"] == "New description"
    assert body["priority"] == "medium"
    assert body["due_date"] == "2026-09-01"
    assert body["status"] == "done"
    assert body["updated_at"] != created["updated_at"]


def test_patch_task_partial_update_leaves_other_fields(client):
    created = client.post(
        "/api/tasks",
        json={"title": "Keep me", "priority": "low", "due_date": "2026-08-15"},
    ).json()
    response = client.patch(f"/api/tasks/{created['id']}", json={"description": "Added later"})
    assert response.status_code == 200
    body = response.json()
    assert body["description"] == "Added later"
    assert body["title"] == "Keep me"
    assert body["priority"] == "low"
    assert body["due_date"] == "2026-08-15"
    assert body["status"] == "open"


def test_patch_task_nonexistent_list_404(client):
    created = client.post("/api/tasks", json={"title": "Task"}).json()
    response = client.patch(f"/api/tasks/{created['id']}", json={"list_id": 9999})
    assert response.status_code == 404

    unchanged = client.get(f"/api/tasks/{created['id']}").json()
    assert unchanged["list_id"] == created["list_id"]


def test_patch_task_nonexistent_task_404(client):
    response = client.patch("/api/tasks/9999", json={"title": "Nope"})
    assert response.status_code == 404


# --- DELETE ---


def test_delete_task_hard_delete_and_removes_tag_links(client, db_session):
    task = Task(title="To delete", list_id=_inbox_id(client))
    tag = Tag(name="temp")
    db_session.add_all([task, tag])
    db_session.commit()
    db_session.execute(task_tags.insert().values(task_id=task.id, tag_id=tag.id))
    db_session.commit()
    task_id = task.id

    response = client.delete(f"/api/tasks/{task_id}")
    assert response.status_code == 204

    assert client.get(f"/api/tasks/{task_id}").status_code == 404
    assert db_session.query(Task).filter(Task.id == task_id).first() is None
    remaining_links = db_session.execute(
        task_tags.select().where(task_tags.c.task_id == task_id)
    ).fetchall()
    assert remaining_links == []


def test_delete_task_nonexistent_404(client):
    response = client.delete("/api/tasks/9999")
    assert response.status_code == 404


# --- SORTING ---


def test_default_sort_due_date_asc_null_last(client):
    client.post("/api/tasks", json={"title": "No date"})
    client.post("/api/tasks", json={"title": "Later", "due_date": "2026-09-01"})
    client.post("/api/tasks", json={"title": "Sooner", "due_date": "2026-08-01"})

    body = client.get("/api/tasks").json()
    titles = [t["title"] for t in body]
    assert titles == ["Sooner", "Later", "No date"]


def test_sort_due_date_desc_still_null_last(client):
    client.post("/api/tasks", json={"title": "No date"})
    client.post("/api/tasks", json={"title": "Later", "due_date": "2026-09-01"})
    client.post("/api/tasks", json={"title": "Sooner", "due_date": "2026-08-01"})

    body = client.get("/api/tasks?sort=due_date&order=desc").json()
    titles = [t["title"] for t in body]
    assert titles == ["Later", "Sooner", "No date"]


def test_sort_priority_asc_and_desc_by_severity(client):
    for priority in ["medium", "none", "high", "low"]:
        client.post("/api/tasks", json={"title": priority, "priority": priority})

    asc_body = client.get("/api/tasks?sort=priority&order=asc").json()
    assert [t["priority"] for t in asc_body] == ["none", "low", "medium", "high"]

    desc_body = client.get("/api/tasks?sort=priority&order=desc").json()
    assert [t["priority"] for t in desc_body] == ["high", "medium", "low", "none"]


def test_sort_created_at_both_orders(client):
    client.post("/api/tasks", json={"title": "First"})
    client.post("/api/tasks", json={"title": "Second"})
    client.post("/api/tasks", json={"title": "Third"})

    asc_body = client.get("/api/tasks?sort=created_at&order=asc").json()
    assert [t["title"] for t in asc_body] == ["First", "Second", "Third"]

    desc_body = client.get("/api/tasks?sort=created_at&order=desc").json()
    assert [t["title"] for t in desc_body] == ["Third", "Second", "First"]


def test_sort_title_both_orders(client):
    client.post("/api/tasks", json={"title": "Banana"})
    client.post("/api/tasks", json={"title": "Apple"})
    client.post("/api/tasks", json={"title": "Cherry"})

    asc_body = client.get("/api/tasks?sort=title&order=asc").json()
    assert [t["title"] for t in asc_body] == ["Apple", "Banana", "Cherry"]

    desc_body = client.get("/api/tasks?sort=title&order=desc").json()
    assert [t["title"] for t in desc_body] == ["Cherry", "Banana", "Apple"]


# --- FILTERS ---


def test_filter_by_list_id(client):
    list_a = _create_list(client, "List A")
    list_b = _create_list(client, "List B")
    client.post("/api/tasks", json={"title": "In A", "list_id": list_a["id"]})
    client.post("/api/tasks", json={"title": "In B", "list_id": list_b["id"]})

    body = client.get(f"/api/tasks?list_id={list_a['id']}").json()
    assert [t["title"] for t in body] == ["In A"]


def test_filter_by_status(client):
    open_task = client.post("/api/tasks", json={"title": "Open task"}).json()
    done_task = client.post("/api/tasks", json={"title": "Done task"}).json()
    client.patch(f"/api/tasks/{done_task['id']}", json={"status": "done"})

    open_body = client.get("/api/tasks?status=open").json()
    assert [t["title"] for t in open_body] == ["Open task"]

    done_body = client.get("/api/tasks?status=done").json()
    assert [t["title"] for t in done_body] == ["Done task"]

    assert open_task["status"] == "open"


def test_filter_by_priority(client):
    client.post("/api/tasks", json={"title": "Low one", "priority": "low"})
    client.post("/api/tasks", json={"title": "High one", "priority": "high"})

    body = client.get("/api/tasks?priority=high").json()
    assert [t["title"] for t in body] == ["High one"]


def test_filter_by_tag_id(client, db_session):
    tagged = Task(title="Tagged", list_id=_inbox_id(client))
    other_tagged = Task(title="Other tag", list_id=_inbox_id(client))
    untagged = Task(title="Untagged", list_id=_inbox_id(client))
    tag = Tag(name="focus")
    other_tag = Tag(name="later")
    db_session.add_all([tagged, other_tagged, untagged, tag, other_tag])
    db_session.commit()
    db_session.execute(task_tags.insert().values(task_id=tagged.id, tag_id=tag.id))
    db_session.execute(task_tags.insert().values(task_id=other_tagged.id, tag_id=other_tag.id))
    db_session.commit()

    body = client.get(f"/api/tasks?tag_id={tag.id}").json()
    assert [t["title"] for t in body] == ["Tagged"]


def test_search_case_insensitive_title_or_description(client):
    client.post("/api/tasks", json={"title": "Buy Milk", "description": "from the store"})
    client.post("/api/tasks", json={"title": "Clean house", "description": "Vacuum LIVING room"})
    client.post("/api/tasks", json={"title": "Unrelated task"})

    by_title = client.get("/api/tasks?search=milk").json()
    assert [t["title"] for t in by_title] == ["Buy Milk"]

    by_description = client.get("/api/tasks?search=living").json()
    assert [t["title"] for t in by_description] == ["Clean house"]

    no_match = client.get("/api/tasks?search=xyz-nomatch").json()
    assert no_match == []


def test_combined_filters_return_intersection(client):
    list_a = _create_list(client, "Filter List")
    list_b = _create_list(client, "Other List")

    match = client.post(
        "/api/tasks",
        json={"title": "Find me shopping", "list_id": list_a["id"]},
    ).json()
    # same list, wrong search term
    client.post("/api/tasks", json={"title": "Different text", "list_id": list_a["id"]})
    # matching search term, wrong list
    client.post("/api/tasks", json={"title": "Find me too", "list_id": list_b["id"]})
    # matching list and search, but done status
    done_task = client.post(
        "/api/tasks",
        json={"title": "Find me done", "list_id": list_a["id"]},
    ).json()
    client.patch(f"/api/tasks/{done_task['id']}", json={"status": "done"})

    body = client.get(
        f"/api/tasks?list_id={list_a['id']}&status=open&search=find me"
    ).json()
    assert [t["title"] for t in body] == [match["title"]]


def test_no_pagination_returns_all_tasks(client):
    for i in range(7):
        client.post("/api/tasks", json={"title": f"Task {i}"})

    body = client.get("/api/tasks").json()
    assert len(body) == 7
