from pathlib import Path
import shutil

script_dir = Path(__file__).parent
source_dir = script_dir / "dataset" / "old-dataset" / "UTKFace"
destination_dir = script_dir / "dataset" / "new-dataset"

image_files = list(source_dir.glob("*.jpg"))

for image_file in image_files:
    filename = image_file.stem
    parts = filename.split("_")
    
    if len(parts) >= 1:
        age = parts[0]
        age_folder = destination_dir / age
        age_folder.mkdir(parents=True, exist_ok=True)
        
        destination_path = age_folder / image_file.name
        shutil.copy2(image_file, destination_path)
        
        print(f"Copied {image_file.name} to age folder: {age}")
        

print("\nDone! All images have been organized by age.")