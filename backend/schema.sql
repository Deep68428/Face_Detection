-- ClickHouse DDL for Attendance System
-- Database: attendance_phase_1
-- Run this file once to create all tables

CREATE DATABASE IF NOT EXISTS attendance_phase_1;

USE attendance_phase_1;

-- ─── Cameras ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cameras
(
    id                  UInt32,
    name                String,
    location            String,
    status              Enum8('Active' = 1, 'Inactive' = 2, 'Error' = 3),
    ip                  String,
    confidence_override UInt8 DEFAULT 75,
    priority            Enum8('High' = 1, 'Medium' = 2, 'Low' = 3),
    work_start          String DEFAULT '09:30',
    work_end            String DEFAULT '19:00',
    last_active         DateTime('Asia/Kolkata') DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY id;

-- ─── Employees ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees
(
    code        String,
    name        String,
    department  String,
    face_status String DEFAULT 'Unmapped',   -- 'Mapped' | 'Unmapped'
    avatar      String,
    created_at  Date DEFAULT today()
)
ENGINE = MergeTree()
ORDER BY code;

-- ─── Movement Logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movement_logs
(
    id          UInt64,
    emp_code    String,
    emp_name    String,
    camera_name String,
    camera_id   UInt32,
    timestamp   DateTime('Asia/Kolkata'),
    direction   Enum8('IN' = 1, 'OUT' = 2),
    confidence  UInt8,
    image_path  String DEFAULT ''
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (emp_code, timestamp);

-- ─── Face Mappings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS face_mappings
(
    face_id      String,
    emp_code     Nullable(String),
    detected_at  String,
    detected_time String,
    confidence   UInt8,
    status       Enum8('New' = 1, 'Reviewed' = 2, 'Assigned' = 3) DEFAULT 'New',
    created_at   DateTime('Asia/Kolkata') DEFAULT now(),
    emp_name     Nullable(String),
    image_path   String DEFAULT ''
)
ENGINE = MergeTree()
ORDER BY (face_id, created_at);

-- ─── Users (system login accounts) ─────────────────────────────────────────
-- roles: 'Super Admin' | 'Admin' | 'Viewer'
-- status: 'active' | 'inactive'
CREATE TABLE IF NOT EXISTS users
(
    id            String,
    name          String,
    role          String,
    department    String,
    status        Enum8('active' = 1, 'inactive' = 2) DEFAULT 'active',
    password_hash String,
    last_login    Nullable(DateTime),
    created_at    Date DEFAULT today()
)
ENGINE = MergeTree()
ORDER BY id;

-- ─── Raw Detections (written by Machine_code) ────────────────────────────────
-- Every face detection event from on-device cameras.
-- Separate from movement_logs; used for audit / debugging.
CREATE TABLE IF NOT EXISTS detections
(
    id               String,
    name             String,
    camera           String,
    camera_id        UInt32,
    timestamp        DateTime('Asia/Kolkata'),
    face_centerpoint String,
    image_path       String,
    confidence       UInt8 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, name);

-- ─── Config Settings ─────────────────────────────────────────────────────────
-- Global settings table (single row where id = 1)
CREATE TABLE IF NOT EXISTS config_settings (
    id UInt8,
    confidence_threshold Int32,
    start_time String,
    end_time String,
    auto_detect_unknown UInt8,
    real_time_processing UInt8,
    track_after_hours UInt8
) ENGINE = MergeTree() ORDER BY id;

-- ─── Machine Registry ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machines (
    machine_id   UInt32,
    location     String
) ENGINE = MergeTree() ORDER BY machine_id;

