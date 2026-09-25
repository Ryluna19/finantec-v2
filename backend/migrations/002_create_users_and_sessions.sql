CREATE TABLE users (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,

    CONSTRAINT users_username_length
        CHECK (char_length(username) BETWEEN 3 AND 50),

    CONSTRAINT users_username_trimmed
        CHECK (username = btrim(username)),

    CONSTRAINT users_username_format
        CHECK (username ~ '^[A-Za-z0-9._-]+$')
);

CREATE UNIQUE INDEX idx_users_username_lower
    ON users (lower(username));

CREATE TABLE sessions (
    token_hash BYTEA PRIMARY KEY,
    user_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT sessions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);