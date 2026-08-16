def test_create_and_list_conversations(client):
    # 1. Create two test users
    client.post("/users/", json={"username": "user1", "password": "password", "avatar_url": "url1"})
    client.post("/users/", json={"username": "user2", "password": "password", "avatar_url": "url2"})
    
    # Login as user1
    res1 = client.post("/login", data={"username": "user1", "password": "password"})
    token1 = res1.json()["access_token"]
    
    # Get user2 ID
    res_me = client.get("/users/me", headers={"Authorization": f"Bearer {token1}"})
    user1_id = res_me.json()["id"]
    
    # Get user2 details to get their ID
    res_users = client.get("/users/", headers={"Authorization": f"Bearer {token1}"})
    user2_id = [u["id"] for u in res_users.json() if u["username"] == "user2"][0]
    
    # 2. Create a 1-on-1 conversation
    headers = {"Authorization": f"Bearer {token1}"}
    res_conv = client.post(
        "/conversations/",
        json={"participant_ids": [user2_id], "is_group": False},
        headers=headers
    )
    assert res_conv.status_code == 200
    conv_data = res_conv.json()
    assert conv_data["is_group"] is False
    assert len(conv_data["participants"]) == 2
    
    # 3. Create a Group conversation
    res_group = client.post(
        "/conversations/",
        json={"participant_ids": [user2_id], "is_group": True, "name": "Test Group"},
        headers=headers
    )
    assert res_group.status_code == 200
    group_data = res_group.json()
    assert group_data["is_group"] is True
    assert group_data["name"] == "Test Group"
    
    # 4. List conversations
    res_list = client.get("/conversations/", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 2

def test_add_group_member(client):
    # Create three test users
    client.post("/users/", json={"username": "user1", "password": "password", "avatar_url": "url"})
    client.post("/users/", json={"username": "user2", "password": "password", "avatar_url": "url"})
    client.post("/users/", json={"username": "user3", "password": "password", "avatar_url": "url"})
    
    # Login as user1
    res1 = client.post("/login", data={"username": "user1", "password": "password"})
    token1 = res1.json()["access_token"]
    headers = {"Authorization": f"Bearer {token1}"}
    
    # Get other user IDs
    res_users = client.get("/users/", headers=headers)
    users_data = res_users.json()
    user2_id = [u["id"] for u in users_data if u["username"] == "user2"][0]
    user3_id = [u["id"] for u in users_data if u["username"] == "user3"][0]
    
    # Create group with user1 and user2
    res_group = client.post(
        "/conversations/",
        json={"participant_ids": [user2_id], "is_group": True, "name": "Sync Group"},
        headers=headers
    )
    group_id = res_group.json()["id"]
    
    # Add user3 to group
    res_add = client.post(
        f"/conversations/{group_id}/add-member?user_id={user3_id}",
        headers=headers
    )
    assert res_add.status_code == 200
    
    # Verify group now has 3 participants
    res_list = client.get("/conversations/", headers=headers)
    conv = [c for c in res_list.json() if c["id"] == group_id][0]
    assert len(conv["participants"]) == 3

def test_delete_conversation(client):
    client.post("/users/", json={"username": "user1", "password": "password", "avatar_url": "url"})
    client.post("/users/", json={"username": "user2", "password": "password", "avatar_url": "url"})
    
    res1 = client.post("/login", data={"username": "user1", "password": "password"})
    token1 = res1.json()["access_token"]
    headers = {"Authorization": f"Bearer {token1}"}
    
    res_users = client.get("/users/", headers=headers)
    user2_id = [u["id"] for u in res_users.json() if u["username"] == "user2"][0]
    
    # Create conversation
    res_conv = client.post(
        "/conversations/",
        json={"participant_ids": [user2_id], "is_group": False},
        headers=headers
    )
    conv_id = res_conv.json()["id"]
    
    # Delete it
    res_del = client.delete(f"/conversations/{conv_id}", headers=headers)
    assert res_del.status_code == 200
    
    # Verify it is removed
    res_list = client.get("/conversations/", headers=headers)
    assert len(res_list.json()) == 0
