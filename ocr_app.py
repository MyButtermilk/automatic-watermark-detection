import os
import uvicorn
import tempfile
import base64
import requests
import io
import subprocess
import pytesseract
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from pdf2image import convert_from_path
from PyPDF2 import PdfMerger
from PIL import Image
from enum import Enum

# Initialize the FastAPI app
app = FastAPI()

class OCRModel(str, Enum):
    NVIDIA = "nvidia"
    TESSERACT = "tesseract"

# Get the NVIDIA OCR service URL from environment variables, with a default
NVIDIA_OCR_URL = os.getenv("NVIDIA_OCR_URL", "http://localhost:8080/v1/infer")

def call_nvidia_ocr_service(image: Image.Image):
    """
    Calls the NVIDIA OCR service to extract text from an image.
    """
    # Convert PIL Image to bytes
    with io.BytesIO() as output:
        image.save(output, format="PNG")
        image_bytes = output.getvalue()

    # Encode the image to base64
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    # Prepare the payload for the NVIDIA OCR service
    payload = {
        "input": [
            {
                "type": "image_url",
                "url": f"data:image/png;base64,{base64_image}"
            }
        ],
        "merge_levels": ["word"]
    }

    # Make the request to the NVIDIA OCR service
    try:
        response = requests.post(NVIDIA_OCR_URL, json=payload)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error calling NVIDIA OCR service: {e}")

def generate_hocr(ocr_result: dict, image_width: int, image_height: int) -> str:
    """
    Generates an hOCR string from the NVIDIA OCR service's JSON output.
    """
    hocr_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
    <title>hOCR output</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name='ocr-system' content='NVIDIA NeMo Retriever OCR' />
    <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word'/>
</head>
<body>
    <div class='ocr_page' id='page_1' title='image "page_1"; bbox 0 0 {width} {height}; ppageno 0'>
        <div class='ocr_carea' id='block_1_1' title='bbox 0 0 {width} {height}'>
""".format(width=image_width, height=image_height)

    for detection in ocr_result.get("data", []):
        for text_detection in detection.get("text_detections", []):
            text = text_detection.get("text_prediction", {}).get("text", "")
            bbox = text_detection.get("bounding_box", {}).get("points", [])
            if not bbox:
                continue

            x_coords = [p["x"] for p in bbox]
            y_coords = [p["y"] for p in bbox]
            x_min = int(min(x_coords) * image_width)
            y_min = int(min(y_coords) * image_height)
            x_max = int(max(x_coords) * image_width)
            y_max = int(max(y_coords) * image_height)

            hocr_content += f"""<span class='ocrx_word' id='word_1_1' title='bbox {x_min} {y_min} {x_max} {y_max}'>{text}</span>
"""

    hocr_content += """
        </div>
    </div>
</body>
</html>"""
    return hocr_content

@app.post("/ocr-pdf/")
async def ocr_pdf(file: UploadFile = File(...), ocr_model: OCRModel = Form(...), lang: str = Form("eng")):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        # Use a temporary directory to handle files
        with tempfile.TemporaryDirectory() as temp_dir:
            input_pdf_path = os.path.join(temp_dir, file.filename)

            # Save the uploaded PDF to the temp directory
            with open(input_pdf_path, "wb") as f:
                f.write(await file.read())

            # 1. Convert PDF to a list of images
            print("Converting PDF pages to images...")
            images = convert_from_path(input_pdf_path)

            searchable_pdf_pages = []

            # Process each page
            for i, image in enumerate(images):
                page_num = i + 1
                print(f"Processing page {page_num}...")

                if ocr_model == OCRModel.NVIDIA:
                    # Create a subdirectory for each page
                    page_dir = os.path.join(temp_dir, f"page_{page_num}")
                    os.makedirs(page_dir)

                    # Save image as JPEG
                    image_path = os.path.join(page_dir, f"page_{page_num}.jpg")
                    image.save(image_path, "JPEG")

                    # Get OCR results from NVIDIA service
                    ocr_result = call_nvidia_ocr_service(image)

                    # Generate hOCR content
                    hocr_content = generate_hocr(ocr_result, image.width, image.height)

                    # Save hOCR to a temporary file
                    hocr_file_path = os.path.join(page_dir, f"page_{page_num}.hocr")
                    with open(hocr_file_path, "w", encoding="utf-8") as f:
                        f.write(hocr_content)

                    # Create searchable PDF for the page
                    page_pdf_path = os.path.join(temp_dir, f"page_{page_num}.pdf")
                    subprocess.run(
                        ["hocr-pdf", "--savefile", page_pdf_path, page_dir],
                        check=True,
                    )
                    searchable_pdf_pages.append(page_pdf_path)

                elif ocr_model == OCRModel.TESSERACT:
                    page_pdf_bytes = pytesseract.image_to_pdf_or_hocr(image, lang=lang, extension='pdf')
                    page_pdf_path = os.path.join(temp_dir, f"page_{page_num}.pdf")
                    with open(page_pdf_path, "wb") as f:
                        f.write(page_pdf_bytes)
                    searchable_pdf_pages.append(page_pdf_path)

            # 3. Merge the searchable pages into a single PDF
            print("Merging pages...")
            merger = PdfMerger()
            for page_pdf in searchable_pdf_pages:
                merger.append(page_pdf)

            output_pdf_path = os.path.join(temp_dir, f"searchable_{file.filename}")
            merger.write(output_pdf_path)
            merger.close()

            # Return the generated file
            return FileResponse(
                path=output_pdf_path,
                media_type="application/pdf",
                filename=f"searchable_{file.filename}"
            )

    except Exception as e:
        # Log the exception for debugging
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("ocr_app:app", host="0.0.0.0", port=8000)
