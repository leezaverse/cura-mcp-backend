-- Chat history table to store user interactions with the Service
CREATE TABLE chat_history (
    id BIGSERIAL PRIMARY KEY,

    conversation_id UUID NOT NULL,

    google_user_id VARCHAR(255) NOT NULL,
    input_text TEXT NOT NULL,
    output_text TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);