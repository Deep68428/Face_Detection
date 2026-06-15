import os
import glob
from config import settings
from core.clickhouse_manager import ClickHouseManager

def sync_employees_to_db():
    print("🔄 Connecting to Remote ClickHouse Database...")
    ch = ClickHouseManager()
    if not ch.ensure_connection():
        print("❌ Failed to connect to database.")
        return

    print("📁 Scanning local Face Database for names...")
    # Find all unique names from the Face_Database folder
    db_path = settings.DATABASE_ROOT
    
    unique_names = set()
    # The structure is Date/Camera/PersonName
    # We will just look at all directories 2 levels deep from dates
    for date_folder in os.listdir(db_path):
        date_path = os.path.join(db_path, date_folder)
        if not os.path.isdir(date_path): continue
        
        for camera_folder in os.listdir(date_path):
            camera_path = os.path.join(date_path, camera_folder)
            if not os.path.isdir(camera_path): continue
            
            for person_name in os.listdir(camera_path):
                if person_name.lower() == "unknown" or person_name.startswith("Unknown"):
                    continue
                if os.path.isdir(os.path.join(camera_path, person_name)):
                    unique_names.add(person_name)

    print(f"✅ Found {len(unique_names)} unique names locally.")

    # Get existing names from server
    result = ch.client.query("SELECT name FROM employees")
    existing_names = {row[0] for row in result.result_rows}
    print(f"✅ Found {len(existing_names)} names currently in the server database.")

    # Find missing names
    missing_names = unique_names - existing_names
    if not missing_names:
        print("✨ Server database is already up to date! No new employees to add.")
        return

    print(f"➕ Preparing to add {len(missing_names)} missing employees to the server...")

    # Get max EMP code to increment from
    max_emp_res = ch.client.query("SELECT max(substring(code, 4)) FROM employees WHERE code LIKE 'EMP%'")
    try:
        last_id = int(max_emp_res.result_rows[0][0])
    except (ValueError, TypeError, IndexError):
        last_id = 0

    # Prepare insert data
    # Sort names alphabetically before assigning EMP codes
    sorted_missing_names = sorted(list(missing_names))
    
    insert_data = []
    for name in sorted_missing_names:
        last_id += 1
        new_code = f"EMP{last_id:03d}"
        
        # Create avatar initials
        parts = name.split()
        avatar = "".join([p[0].upper() for p in parts[:2]]) if parts else "X"
        
        # code, name, department, avatar, created_at, face_status
        insert_data.append([
            new_code, name, "General", avatar, "Mapped"
        ])
    
    # Run the insert query
    try:
        query = "INSERT INTO employees (code, name, department, avatar, created_at, face_status) VALUES"
        
        # ClickHouse connect driver supports direct tuple insertion
        # But we'll build the values string for clarity
        for row in insert_data:
            code, name, dept, avatar, status = row
            # Format: ('EMP123', 'Name', 'Dept', 'Avatar', today(), 'Status')
            query += f"\n('{code}', '{name}', '{dept}', '{avatar}', today(), '{status}'),"
            
        # Remove trailing comma
        query = query.rstrip(',')
        
        ch.client.command(query)
        print(f"🎉 Successfully added {len(missing_names)} employees to the remote server!")
        
    except Exception as e:
        print(f"❌ Failed to insert: {e}")

if __name__ == "__main__":
    sync_employees_to_db()
