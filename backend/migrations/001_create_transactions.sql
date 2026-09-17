CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID,
    transaction_date DATE NOT NULL,
    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN ('income', 'expense')),
    description TEXT NOT NULL
        CHECK (btrim(description) <> ''),
    category TEXT NOT NULL
        CHECK (btrim(category) <> ''),
    amount_in_cents BIGINT NOT NULL
        CHECK (amount_in_cents > 0)
);

CREATE INDEX idx_transactions_user_date
    ON transactions (user_id, transaction_date DESC);