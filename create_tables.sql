CREATE DATABASE questionai_db;
USE questionai_db;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('teacher', 'student') NOT NULL,
    grade VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Papers Table
CREATE TABLE papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade VARCHAR(20),
    topics TEXT,
    exam_title VARCHAR(200),
    school_name VARCHAR(200),
    total_marks INT DEFAULT 100,
    duration INT DEFAULT 180,
    difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Medium',
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Bloom Distribution Table
CREATE TABLE bloom_distribution (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL,
    remember_pct INT DEFAULT 0,
    understand_pct INT DEFAULT 0,
    apply_pct INT DEFAULT 0,
    analyze_pct INT DEFAULT 0,
    evaluate_pct INT DEFAULT 0,
    create_pct INT DEFAULT 0,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- Questions Table
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL,
    question_num INT,
    question_text TEXT NOT NULL,
    question_type ENUM('mcq', 'short', 'long', 'tf', 'fill') NOT NULL,
    bloom_level ENUM('remember','understand','apply','analyze','evaluate','create') NOT NULL,
    marks INT DEFAULT 2,
    option_a VARCHAR(300),
    option_b VARCHAR(300),
    option_c VARCHAR(300),
    option_d VARCHAR(300),
    correct_answer TEXT,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- Attempts Table
CREATE TABLE attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    paper_id INT NOT NULL,
    scored INT DEFAULT 0,
    total_marks INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    percentage FLOAT DEFAULT 0,
    grade CHAR(2),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- Attempt Answers Table
CREATE TABLE attempt_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    given_answer TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    marks_awarded INT DEFAULT 0,
    FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);