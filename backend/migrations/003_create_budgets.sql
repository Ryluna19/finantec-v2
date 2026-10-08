BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE budgets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    start_period DATE NOT NULL,
    end_period DATE,
    category TEXT NOT NULL,
    category_key TEXT NOT NULL,
    planned_amount_in_cents BIGINT NOT NULL,

    CONSTRAINT budgets_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES users (id),

    CONSTRAINT budgets_start_period_first_day
        CHECK (
            EXTRACT(DAY FROM start_period) = 1
        ),

    CONSTRAINT budgets_end_period_first_day
        CHECK (
            end_period IS NULL
            OR EXTRACT(DAY FROM end_period) = 1
        ),

    CONSTRAINT budgets_period_order
        CHECK (
            end_period IS NULL
            OR end_period >= start_period
        ),

    CONSTRAINT budgets_category_not_empty
        CHECK (
            btrim(category) <> ''
        ),

    CONSTRAINT budgets_category_length
        CHECK (
            char_length(category) <= 100
        ),

    CONSTRAINT budgets_category_key_not_empty
        CHECK (
            btrim(category_key) <> ''
        ),

    CONSTRAINT budgets_reserved_category
        CHECK (
            category_key <> 'reserva'
        ),

    CONSTRAINT budgets_planned_amount_positive
        CHECK (
            planned_amount_in_cents > 0
        ),

    CONSTRAINT budgets_planned_amount_safe_integer
        CHECK (
            planned_amount_in_cents <= 9007199254740991
        ),

    CONSTRAINT budgets_no_overlapping_periods
        EXCLUDE USING gist (
            user_id WITH =,
            category_key WITH =,
            daterange(
                start_period,
                CASE
                    WHEN end_period IS NULL
                        THEN NULL
                    ELSE (
                        end_period
                        + INTERVAL '1 month'
                    )::date
                END,
                '[)'
            ) WITH &&
        )
);

COMMIT;