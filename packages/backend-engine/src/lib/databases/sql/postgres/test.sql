-- Select the desired database
\c test_db;

-- Drop tables if they exist
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;

-- Create the 'users' table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL
    -- Add other user-related columns as needed
);

-- Create the 'orders' table with a foreign key reference to 'users'
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL,
    user_id INT REFERENCES users(user_id),
    order_date TIMESTAMP NOT NULL
    -- Add other order-related columns as needed
);

-- Insert sample data into the 'users' table
INSERT INTO users (username, email) VALUES
    ('JohnDoe', 'john.doe@example.com'),
    ('JaneSmith', 'jane.smith@example.com'),
    ('BobJohnson', 'bob.johnson@example.com');

-- Insert sample data into the 'orders' table
INSERT INTO orders (order_number, user_id, order_date) VALUES
    ('ORD001', 1, '2023-01-01 10:00:00'),
    ('ORD002', 2, '2023-01-02 12:30:00'),
    ('ORD004', 2, '2023-01-02 12:30:00'),
    ('ORD003', 3, '2023-01-03 15:45:00');


-- 


CREATE OR REPLACE PROCEDURE raise_an_error(
    -- fake in/out args
    in_user_id INTEGER,
    in_project_name VARCHAR(100),
    out new_project_id INTEGER
)
AS $$
DECLARE
BEGIN
    BEGIN
        -- Intentionally raise an exception for testing
        RAISE EXCEPTION 'artificial_exception';
    END;
    -- never return
    RETURN;
END;
$$ LANGUAGE plpgsql;


--

CREATE OR REPLACE PROCEDURE return_values(
    -- fake in/out args
    in_user_id INTEGER,
    in_project_name VARCHAR(100),
    out new_project_id INTEGER,
    out what_time_is_it TIMESTAMP,
    out some_text VARCHAR,
    out json_data JSON
)
AS $$
DECLARE
BEGIN
    BEGIN
        new_project_id := 42;
        what_time_is_it := TIMESTAMP '2042-12-24 11:42:59';
        some_text := 'Hello, this is some dummy text for testing.';
        json_data := '{"key": "value", "array": [1, 2, 3]}';
    END;
    RETURN;
END;
$$ LANGUAGE plpgsql;

--

CREATE OR REPLACE FUNCTION get_orders_by_user_id(
    in_user_id INTEGER
)
RETURNS TABLE (
    order_id INTEGER,
    order_number VARCHAR(20),
    order_date TIMESTAMP
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.order_id,
        o.order_number,
        o.order_date
    FROM
        orders o
    WHERE
        user_id = in_user_id;
END;
$$ LANGUAGE plpgsql;
