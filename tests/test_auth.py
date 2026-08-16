def test_signup(client):
    # Success Signup
    response = client.post(
        "/users/",
        json={"username": "testuser", "password": "testpassword", "avatar_url": "test_avatar"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data
    
    # Duplicate Signup
    response = client.post(
        "/users/",
        json={"username": "testuser", "password": "newpassword", "avatar_url": "test_avatar2"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already exists"

def test_login(client):
    # Register first
    client.post(
        "/users/",
        json={"username": "testuser", "password": "testpassword", "avatar_url": "test_avatar"}
    )
    
    # Success Login
    response = client.post(
        "/login",
        data={"username": "testuser", "password": "testpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    
    # Failed Login
    response = client.post(
        "/login",
        data={"username": "testuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_get_me(client):
    # Register & Login to get token
    client.post(
        "/users/",
        json={"username": "testuser", "password": "testpassword", "avatar_url": "test_avatar"}
    )
    res = client.post(
        "/login",
        data={"username": "testuser", "password": "testpassword"}
    )
    token = res.json()["access_token"]
    
    # Authorized Get Me
    response = client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"
    
    # Unauthorized Get Me
    response = client.get("/users/me")
    assert response.status_code == 401
