import os


target_dir = "frontend/src"
old_url = "http://localhost:8000"
new_url = "http://216.48.180.4:8000"
count = 0

for root, _, files in os.walk(target_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if old_url in content:
                content = content.replace(old_url, new_url)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {path}")
                count += 1
print(f"Done! Updated {count} files.")
